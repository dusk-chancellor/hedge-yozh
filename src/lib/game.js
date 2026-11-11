import { bsPrice, randn, round2 } from './math.js'
import { money, pp, rateFmt } from './format.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// vol = standard deviation of the random price move per round (before news)
export const ASSET_DEFS = [
  { id: 'TECH', ticker: 'ТЕХ', name: 'Акции TechNova', price: 120, vol: 0.09 },
  { id: 'OIL', ticker: 'НЕФТЬ', name: 'Нефть Brent', price: 80, vol: 0.1 },
  { id: 'GOLD', ticker: 'ЗОЛОТО', name: 'Золото', price: 190, vol: 0.04 },
  { id: 'WHEAT', ticker: 'ПШЕНО', name: 'Пшеница', price: 55, vol: 0.07 },
]

export const DEFAULT_SETTINGS = {
  rounds: 6,
  startCash: 5000,
  volLevel: 1,
  marginRate: 0.1,
  futuresLot: 10,
  maxMaturity: 3,
  maxLeverage: 2,
  maxOpenContracts: 12,
  loan: 3000, // floating-rate loan every player starts with (0 = no loan, no swaps)
  loanSpread: 0.02, // loan rate = key rate + spread
  startRate: 0.08, // key rate, per year
  rateVol: 0.0025, // random key rate move per round (one standard deviation)
  timer: 0, // seconds of trading per round, 0 = off
}

export const VOL_LEVELS = [
  { label: 'Спокойно', value: 0.5 },
  { label: 'Обычно', value: 1 },
  { label: 'Бурно', value: 1.6 },
]

export const TIMER_OPTIONS = [0, 60, 90, 120, 180]
export const STRIKES = [0.9, 0.95, 1, 1.05, 1.1]
export const ROUNDS_PER_YEAR = 4 // each round is a quarter for interest purposes
export const AVATAR_COUNT = 24

// rate = change of the key rate in percentage points (as a decimal: 0.01 = 1 п.п.)
export const NEWS_PRESETS = [
  { headline: 'Высокая нестабильность на Ближнем Востоке', assetId: 'OIL', impact: 0.18, rate: 0 },
  { headline: 'Дешёвые электрокары и уменьшение роли нефтяных электростанций', assetId: 'OIL', impact: -0.16, rate: 0 },
  { headline: 'Юридические разбирательства с технологическими компаниями', assetId: 'TECH', impact: -0.22, rate: 0 },
  { headline: 'Вышла революционная модель ИИ', assetId: 'TECH', impact: 0.2, rate: 0 },
  { headline: 'Госзакупки золота и замедление экспорта', assetId: 'GOLD', impact: 0.08, rate: 0 },
  { headline: 'Укрепление криптовалют и акций на рынке', assetId: 'GOLD', impact: -0.09, rate: 0 },
  { headline: 'Засуха в насыщенных регионах', assetId: 'WHEAT', impact: 0.2, rate: 0 },
  { headline: 'Рекордное количество урожая', assetId: 'WHEAT', impact: -0.15, rate: 0 },
  { headline: 'Частичная рецессия', assetId: 'ALL', impact: -0.12, rate: 0 },
  { headline: 'Снижение ключевой ставки сразу в нескольких странах', assetId: 'ALL', impact: 0.07, rate: -0.01 },
  { headline: 'ЦБ неожиданно повышает ключевую ставку', assetId: 'NONE', impact: 0, rate: 0.02 },
  { headline: 'Инфляция замедляется, ЦБ снижает ставку', assetId: 'NONE', impact: 0, rate: -0.015 },
  { headline: 'ЦБ сигнализирует о долгом периоде высоких ставок', assetId: 'NONE', impact: 0, rate: 0.01 },
]

export const NEWS_TYPES = {
  shock: { label: 'Шок', hint: 'Заголовок и движение цен — прямо сейчас.' },
  rumor: { label: 'Слух', hint: 'Заголовок видят сейчас, цены изменятся при закрытии рынка.' },
  surprise: { label: 'Сюрприз', hint: 'Тайна до закрытия рынка: заголовок и движение — вместе с итогами.' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clone = (x) => JSON.parse(JSON.stringify(x))
const uid = () => Math.random().toString(36).slice(2, 10)
class GameError extends Error {}
const fail = (m) => {
  throw new GameError(m)
}

export const getAsset = (s, id) => s.assets.find((a) => a.id === id)
export const tickerOf = (s, id) => (id === 'ALL' ? 'РЫНОК' : id === 'NONE' ? 'СТАВКА' : getAsset(s, id)?.ticker || id)
export const sigma = (s, a) => a.vol * s.settings.volLevel
export const dir = (c) => (c.side === 'short' || c.side === 'recfixed' ? -1 : 1)
export const openContracts = (p) => p.contracts.filter((c) => c.status === 'open')
export const isLinear = (c) => c.type === 'forward' || c.type === 'future'
export const isOption = (c) => c.type === 'put' || c.type === 'call'
export const loanRate = (s) => s.rate.value + s.settings.loanSpread
export const swapsEnabled = (s) => s.settings.loan > 0

export const maxMaturityNow = (s) => Math.max(1, Math.min(s.settings.maxMaturity, s.settings.rounds - s.round + 1))
export const maxSwapMaturityNow = (s) => Math.max(1, s.settings.rounds - s.round + 1)

// Market closes left before the contract ends (including the coming one while trading)
export const remaining = (s, c) => c.expiry - s.round + (s.phase === 'trading' ? 1 : 0)

export const optionPremium = (s, a, type, strike, T) => bsPrice(type, a.price, strike, T, sigma(s, a))

// Swap: holder of pay-fixed receives (rate − fixed) × notional / 4 at each close
const swapPeriod = (s, c) => ((s.rate.value - c.fixed) * c.qty * dir(c)) / ROUNDS_PER_YEAR

export function contractValue(s, c) {
  if (c.type === 'swap') return swapPeriod(s, c) * Math.max(0, remaining(s, c))
  const a = getAsset(s, c.assetId)
  const S = a.price
  if (c.type === 'forward') return (S - c.price) * c.qty * dir(c)
  if (c.type === 'future') return c.margin + (S - c.last) * c.qty * dir(c)
  return bsPrice(c.type, S, c.strike, remaining(s, c), sigma(s, a)) * c.qty
}

export const contractUnrealized = (s, c) => (c.type === 'future' ? contractValue(s, c) - c.margin : contractValue(s, c))

// Result of a contract so far: what has been paid or received plus what it is worth now
export function contractResult(s, c) {
  if (c.status !== 'open') return c.pnl
  if (c.type === 'future') return c.pnl + contractUnrealized(s, c)
  if (isOption(c)) return contractValue(s, c) - c.premium
  if (c.type === 'swap') return c.pnl + contractValue(s, c)
  return contractValue(s, c)
}

// How many units of the player's exposure this contract offsets (0 if it adds risk)
export function protects(s, p, c) {
  if (c.type === 'swap') return c.side === 'payfixed' ? Math.min(c.qty, p.loan) : 0
  const protective = (isLinear(c) && c.side === 'short') || c.type === 'put'
  return protective ? c.qty : 0
}

export const holdingsValue = (s, p) => s.assets.reduce((t, a) => t + (p.holdings[a.id] || 0) * a.price, 0)

export const portfolioValue = (s, p) =>
  p.cash + holdingsValue(s, p) + openContracts(p).reduce((t, c) => t + contractValue(s, c), 0) - p.loan

export const hedgePnl = (s, p) => p.hedgePnl + openContracts(p).reduce((t, c) => t + contractUnrealized(s, c), 0)

export const linearNotional = (s, p) =>
  openContracts(p)
    .filter(isLinear)
    .reduce((t, c) => t + c.qty * getAsset(s, c.assetId).price, 0)

export const swapNotional = (p) =>
  openContracts(p)
    .filter((c) => c.type === 'swap')
    .reduce((t, c) => t + c.qty, 0)

export const maxSwapNotional = (s) => 2 * Math.max(s.settings.loan, 1000)

export function leaderboard(s) {
  return Object.values(s.players)
    .filter((p) => p.role === 'player')
    .map((p) => {
      const value = portfolioValue(s, p)
      return { id: p.id, name: p.name, avatar: p.avatar, value, ret: value / p.start - 1, hedge: hedgePnl(s, p) }
    })
    .sort((a, b) => b.value - a.value)
}

export const takenAvatars = (s, exceptId) =>
  new Set(
    Object.values(s.players)
      .filter((p) => p.id !== exceptId)
      .map((p) => p.avatar),
  )

// ---------------------------------------------------------------------------
// Lifecycle (host side)
// ---------------------------------------------------------------------------

export function createGame(code, settings = {}) {
  const st = { ...DEFAULT_SETTINGS, ...settings }
  return {
    code,
    phase: 'lobby', // lobby → trading ⇄ results → finished
    round: 0,
    settings: st,
    assets: ASSET_DEFS.map((a) => ({ ...a, open: a.price, start: a.price, history: [{ t: 'Старт', p: a.price }] })),
    rate: { value: st.startRate, open: st.startRate, start: st.startRate, history: [{ t: 'Старт', p: st.startRate }] },
    news: [],
    players: {},
    kicked: [],
    lastMoves: null,
    flash: null,
    deadline: null,
  }
}

function resetPlayerMoney(s, p) {
  p.loan = s.settings.loan
  p.cash = s.settings.startCash + s.settings.loan
  p.start = s.settings.startCash
  p.history = [s.settings.startCash]
}

export function updateSettings(state, patch) {
  if (state.phase !== 'lobby') return state
  const s = clone(state)
  const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d)
  const n = { ...s.settings, ...patch }
  n.rounds = Math.round(num(n.rounds, 1, 15, 6))
  n.startCash = Math.round(num(n.startCash, 500, 1000000, 5000))
  n.marginRate = num(n.marginRate, 0.05, 0.5, 0.1)
  n.maxMaturity = Math.round(num(n.maxMaturity, 1, 5, 3))
  n.loan = Math.round(num(n.loan, 0, 1000000, 3000))
  n.startRate = num(n.startRate, 0, 0.3, 0.08)
  n.timer = TIMER_OPTIONS.includes(Number(n.timer)) ? Number(n.timer) : 0
  s.settings = n
  s.rate = { value: n.startRate, open: n.startRate, start: n.startRate, history: [{ t: 'Старт', p: n.startRate }] }
  for (const p of Object.values(s.players)) resetPlayerMoney(s, p)
  return s
}

export function joinPlayer(state, { id, name, role }) {
  if (!id || state.kicked.includes(id)) return state
  const s = clone(state)
  if (s.players[id]) return s // reconnect: the fresh copy triggers a rebroadcast
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Трейдер'
  const taken = new Set(Object.values(s.players).map((p) => p.name.toLowerCase()))
  let n = clean
  for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${clean} ${i}`
  const used = takenAvatars(s)
  const free = Array.from({ length: AVATAR_COUNT }, (_, i) => i).filter((i) => !used.has(i))
  const avatar = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * AVATAR_COUNT)
  const p = {
    id,
    name: n,
    avatar,
    role: role === 'spectator' ? 'spectator' : 'player',
    holdings: Object.fromEntries(s.assets.map((a) => [a.id, 0])),
    contracts: [],
    hedgePnl: 0,
    interestPaid: 0,
    last: null,
    open: null,
    msg: null,
  }
  resetPlayerMoney(s, p)
  s.players[id] = p
  if (s.phase !== 'lobby') snapshot(s, p)
  return s
}

export function kickPlayer(state, id) {
  const s = clone(state)
  delete s.players[id]
  s.kicked.push(id)
  return s
}

function snapshot(s, p) {
  p.open = { value: round2(portfolioValue(s, p)), hedge: round2(hedgePnl(s, p)) }
}

function openRound(s) {
  s.phase = 'trading'
  for (const a of s.assets) a.open = a.price
  s.rate.open = s.rate.value
  s.deadline = s.settings.timer ? Date.now() + s.settings.timer * 1000 : null
  for (const p of Object.values(s.players)) if (p.role === 'player') snapshot(s, p)
}

export function startGame(state) {
  if (state.phase !== 'lobby') return state
  const s = clone(state)
  s.round = 1
  openRound(s)
  return s
}

export function nextRound(state) {
  if (state.phase !== 'results' || state.round >= state.settings.rounds) return state
  const s = clone(state)
  s.round += 1
  openRound(s)
  return s
}

export function finishGame(state) {
  const s = clone(state)
  s.phase = 'finished'
  s.deadline = null
  return s
}

export function addTime(state, seconds) {
  if (state.phase !== 'trading' || !state.deadline) return state
  const s = clone(state)
  s.deadline = Math.max(s.deadline, Date.now()) + seconds * 1000
  return s
}

const targets = (n, a) => n.assetId === 'ALL' || n.assetId === a.id
const clampRate = (r) => Math.round(Math.min(0.3, Math.max(0.005, r)) * 10000) / 10000

// type: 'shock' (now), 'rumor' (headline now, move at close), 'surprise' (both at close)
export function addNews(state, { headline, assetId, impact, rate = 0, type }) {
  if (state.phase === 'finished') return state
  if (type === 'shock' && state.phase !== 'trading') return state
  const s = clone(state)
  const n = { id: uid(), headline, assetId, impact: assetId === 'NONE' ? 0 : impact, rate, type, status: 'queued', round: null }
  if (type === 'shock') {
    n.status = 'fired'
    n.round = s.round
    for (const a of s.assets) {
      if (!targets(n, a) || !n.impact) continue
      a.price = round2(Math.max(1, a.price * (1 + n.impact)))
      a.history.push({ t: `Р${s.round} новость`, p: a.price })
    }
    if (n.rate) {
      s.rate.value = clampRate(s.rate.value + n.rate)
      s.rate.history.push({ t: `Р${s.round} новость`, p: s.rate.value })
    }
    s.flash = {
      id: n.id,
      kind: 'shock',
      headlines: [headline],
      items: [{ headline, assetId: n.assetId, impact: n.impact, rate: n.rate }],
      t: Date.now(),
    }
  } else if (type === 'rumor') {
    s.flash = { id: n.id, kind: 'rumor', headlines: [headline], t: Date.now() }
  }
  s.news.push(n)
  return s
}

export function removeNews(state, id) {
  const s = clone(state)
  s.news = s.news.filter((n) => !(n.id === id && n.status === 'queued'))
  return s
}

function settle(s, p) {
  for (const c of p.contracts) {
    if (c.status !== 'open') continue
    if (c.type === 'swap') {
      const v = round2(swapPeriod(s, c))
      p.cash = round2(p.cash + v)
      p.hedgePnl = round2(p.hedgePnl + v)
      c.pnl = round2(c.pnl + v)
      if (c.expiry <= s.round) {
        c.status = 'settled'
        c.settle = s.rate.value
      }
      continue
    }
    const S = getAsset(s, c.assetId).price
    const d = dir(c)
    if (c.type === 'future') {
      const v = round2((S - c.last) * c.qty * d)
      p.cash = round2(p.cash + v)
      p.hedgePnl = round2(p.hedgePnl + v)
      c.pnl = round2(c.pnl + v)
      c.last = S
      if (c.expiry <= s.round) {
        p.cash = round2(p.cash + c.margin)
        c.status = 'settled'
        c.settle = S
      }
    } else if (c.expiry <= s.round) {
      let v
      if (c.type === 'forward') {
        v = round2((S - c.price) * c.qty * d)
        c.pnl = v
      } else {
        v = round2(Math.max(0, c.type === 'call' ? S - c.strike : c.strike - S) * c.qty)
        c.pnl = round2(v - c.premium)
      }
      p.cash = round2(p.cash + v)
      p.hedgePnl = round2(p.hedgePnl + v)
      c.status = 'settled'
      c.settle = S
    }
  }
  if (p.loan > 0) {
    const interest = round2((p.loan * loanRate(s)) / ROUNDS_PER_YEAR)
    p.cash = round2(p.cash - interest)
    p.interestPaid = round2(p.interestPaid + interest)
  }
}

export function resolveRound(state, rng = Math.random) {
  if (state.phase !== 'trading') return state
  const s = clone(state)
  const players = Object.values(s.players).filter((p) => p.role === 'player')
  const before = Object.fromEntries(players.map((p) => [p.id, p.open || { value: portfolioValue(s, p), hedge: hedgePnl(s, p) }]))

  const due = s.news.filter((n) => n.status === 'queued')
  const firedThisRound = s.news.filter((n) => n.status === 'fired' && n.round === s.round)
  s.lastMoves = {}
  for (const a of s.assets) {
    const sig = sigma(s, a)
    const noise = Math.exp(sig * randn(rng) - 0.5 * sig * sig)
    let shock = 1
    for (const n of due) if (targets(n, a)) shock *= 1 + n.impact
    let newsTotal = shock
    for (const n of firedThisRound) if (targets(n, a)) newsTotal *= 1 + n.impact
    a.price = round2(Math.max(1, a.price * noise * shock))
    a.history.push({ t: `Р${s.round}`, p: a.price })
    const total = a.price / a.open
    s.lastMoves[a.id] = { pct: total - 1, newsPct: newsTotal - 1, noisePct: total / newsTotal - 1 }
  }
  const rateNews = due.reduce((t, n) => t + (n.rate || 0), 0)
  s.rate.value = clampRate(s.rate.value + rateNews + s.settings.rateVol * s.settings.volLevel * randn(rng))
  s.rate.history.push({ t: `Р${s.round}`, p: s.rate.value })
  s.lastMoves.RATE = { change: s.rate.value - s.rate.open }

  for (const n of due) {
    n.status = 'fired'
    n.round = s.round
  }
  const surprises = due.filter((n) => n.type === 'surprise')
  if (surprises.length)
    s.flash = {
      id: uid(),
      kind: 'surprise',
      headlines: surprises.map((n) => n.headline),
      items: surprises.map((n) => ({ headline: n.headline, assetId: n.assetId, impact: n.impact, rate: n.rate })),
      t: Date.now(),
    }

  s.phase = 'results'
  s.deadline = null
  for (const p of players) {
    settle(s, p)
    const value = portfolioValue(s, p)
    p.history.push(round2(value))
    p.last = {
      round: s.round,
      before: round2(before[p.id].value),
      after: round2(value),
      hedge: round2(hedgePnl(s, p) - before[p.id].hedge),
    }
  }
  return s
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export function applyAction(state, pid, action) {
  if (!state.players[pid] || !action) return state
  const s = clone(state)
  const p = s.players[pid]
  try {
    const text = doAction(s, p, action)
    p.msg = { ok: true, text, t: Date.now() }
    return s
  } catch (e) {
    const s2 = clone(state)
    if (!(e instanceof GameError)) console.error(e)
    s2.players[pid].msg = { ok: false, text: e instanceof GameError ? e.message : 'Не удалось выполнить операцию.', t: Date.now() }
    return s2
  }
}

const units = (n) => `${n} шт.`

function doAction(s, p, a) {
  if (a.type === 'setRole') {
    if (s.phase !== 'lobby') fail('Роль можно сменить только до начала игры.')
    p.role = a.role === 'spectator' ? 'spectator' : 'player'
    return p.role === 'player' ? 'Теперь вы игрок.' : 'Теперь вы зритель.'
  }
  if (a.type === 'setAvatar') {
    const i = Math.floor(Number(a.avatar))
    if (!(i >= 0 && i < AVATAR_COUNT)) fail('Такого аватара нет.')
    if (takenAvatars(s, p.id).has(i)) fail('Этот аватар уже занят.')
    p.avatar = i
    return 'Аватар выбран.'
  }
  if (s.phase !== 'trading') fail('Торги закрыты. Дождитесь следующего раунда.')
  if (p.role !== 'player') fail('Зрители не могут торговать.')

  if (a.type === 'closeFuture') {
    const c = p.contracts.find((x) => x.id === a.contractId && x.status === 'open' && x.type === 'future')
    if (!c) fail('Этот фьючерс уже закрыт.')
    const S = getAsset(s, c.assetId).price
    const v = round2((S - c.last) * c.qty * dir(c))
    p.cash = round2(p.cash + v + c.margin)
    p.hedgePnl = round2(p.hedgePnl + v)
    c.pnl = round2(c.pnl + v)
    c.status = 'closed'
    c.settle = S
    c.closedRound = s.round
    return `Фьючерс закрыт по ${money(S)}. Маржа ${money(c.margin)} вернулась на счёт.`
  }

  const isSwap = a.type === 'swap'
  const asset = isSwap ? null : getAsset(s, a.assetId)
  if (!isSwap && !asset) fail('Сначала выберите актив.')
  const S = asset?.price
  const qty = Math.floor(Number(a.qty))
  if (!Number.isFinite(qty) || qty < 1) fail('Укажите количество не меньше 1.')
  if (qty > 1000000) fail('Слишком большое количество.')

  if (a.type === 'sell') {
    const held = p.holdings[asset.id] || 0
    if (held < qty) fail(`У вас только ${units(held)} ${asset.ticker}.`)
    p.holdings[asset.id] = held - qty
    p.cash = round2(p.cash + qty * S)
    return `Продано ${units(qty)} ${asset.ticker} по ${money(S)}.`
  }

  if (p.cash < 0) fail('Маржин-колл: на счёте меньше 0 $. Сначала продайте активы или закройте фьючерсы.')

  if (a.type === 'buy') {
    const cost = round2(qty * S)
    if (cost > p.cash + 1e-9) fail(`Не хватает денег: ${units(qty)} ${asset.ticker} стоят ${money(cost)}, у вас ${money(p.cash)}.`)
    p.cash = round2(p.cash - cost)
    p.holdings[asset.id] = (p.holdings[asset.id] || 0) + qty
    return `Куплено ${units(qty)} ${asset.ticker} по ${money(S)}.`
  }

  if (openContracts(p).length >= s.settings.maxOpenContracts)
    fail(`Можно держать не больше ${s.settings.maxOpenContracts} открытых контрактов.`)
  const m = Math.floor(Number(a.maturity))
  const maxM = isSwap ? maxSwapMaturityNow(s) : maxMaturityNow(s)
  if (!(m >= 1 && m <= maxM)) fail(`Выберите срок от 1 до ${maxM} раундов.`)
  const expiry = s.round + m - 1
  const base = { id: uid(), assetId: asset?.id || 'RATE', openedRound: s.round, expiry, status: 'open', pnl: 0 }

  if (isSwap) {
    if (!swapsEnabled(s)) fail('Свопы выключены в этой игре.')
    const side = a.side === 'recfixed' ? 'recfixed' : 'payfixed'
    const limit = maxSwapNotional(s)
    if (swapNotional(p) + qty > limit) fail(`Общая сумма свопов не может превышать ${money(limit)}.`)
    p.contracts.push({ ...base, type: 'swap', side, qty, fixed: s.rate.value })
    return `Своп открыт: ${side === 'payfixed' ? 'платите' : 'получаете'} фиксированную ставку ${rateFmt(s.rate.value)} на ${money(qty)} до конца раунда ${expiry}.`
  }

  if (a.type === 'forward' || a.type === 'future') {
    const side = a.side === 'long' ? 'long' : 'short'
    const n = a.type === 'future' ? qty * s.settings.futuresLot : qty
    const limit = s.settings.maxLeverage * Math.max(0, portfolioValue(s, p))
    const after = linearNotional(s, p) + n * S
    if (after > limit + 1e-9)
      fail(`Объём форвардов и фьючерсов стал бы ${money(after)}. Лимит — ${money(limit)} (${s.settings.maxLeverage}× стоимости портфеля).`)
    if (a.type === 'forward') {
      p.contracts.push({ ...base, type: 'forward', side, qty: n, price: S })
      return `Форвард открыт: вы ${side === 'short' ? 'продадите' : 'купите'} ${units(n)} ${asset.ticker} по ${money(S)} в конце раунда ${expiry}.`
    }
    const margin = round2(n * S * s.settings.marginRate)
    if (margin > p.cash) fail(`Нужна маржа ${money(margin)}, а у вас ${money(p.cash)}.`)
    p.cash = round2(p.cash - margin)
    p.contracts.push({ ...base, type: 'future', side, qty: n, lots: qty, price: S, last: S, margin })
    return `Фьючерс открыт: ${side === 'short' ? 'шорт' : 'лонг'} ${qty} лот. (${units(n)} ${asset.ticker}) по ${money(S)}. Маржа ${money(margin)}.`
  }

  if (a.type === 'call' || a.type === 'put') {
    const k = Number(a.strikePct)
    if (!STRIKES.includes(k)) fail('Выберите страйк из списка.')
    const K = round2(S * k)
    const prem = Math.max(round2(0.01 * qty), round2(optionPremium(s, asset, a.type, K, m) * qty))
    if (prem > p.cash) fail(`Премия ${money(prem)}, а у вас ${money(p.cash)}.`)
    p.cash = round2(p.cash - prem)
    p.hedgePnl = round2(p.hedgePnl - prem)
    p.contracts.push({ ...base, type: a.type, side: 'long', qty, strike: K, premium: prem })
    return `Куплено ${qty} опц. ${a.type === 'put' ? 'пут' : 'колл'} на ${asset.ticker}, страйк ${money(K)}, премия ${money(prem)}.`
  }

  fail('Неизвестная операция.')
}

// ---------------------------------------------------------------------------
// What gets broadcast to screens: hides surprises and old contracts
// ---------------------------------------------------------------------------

export function publicState(state) {
  const s = clone(state)
  s.news = s.news
    .filter((n) => n.status === 'fired' || n.type === 'rumor')
    .map((n) => (n.status === 'fired' ? n : { ...n, impact: null, rate: null, movesRate: !!n.rate }))
  for (const p of Object.values(s.players)) {
    const done = p.contracts.filter((c) => c.status !== 'open')
    p.contracts = [...p.contracts.filter((c) => c.status === 'open'), ...done.slice(-8)]
  }
  s.sentAt = Date.now()
  return s
}

export { pp }
