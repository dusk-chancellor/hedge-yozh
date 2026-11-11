import { useEffect, useState } from 'react'
import {
  AVATAR_COUNT,
  ROUNDS_PER_YEAR,
  STRIKES,
  contractResult,
  getAsset,
  hedgePnl,
  holdingsValue,
  isOption,
  leaderboard,
  loanRate,
  maxMaturityNow,
  maxSwapMaturityNow,
  openContracts,
  optionPremium,
  portfolioValue,
  protects,
  remaining,
  swapsEnabled,
  takenAvatars,
} from '../lib/game.js'
import { money, money0, num, pct, pp, rateFmt, rounds, signedMoney, tone } from '../lib/format.js'
import { Avatar, InfoTip, QtyInput, Seg, Timer } from './ui.jsx'
import { Standings } from './Board.jsx'
import { AssetIcon, EventStrips, Takeover, Tag } from './events.jsx'
import { AVATARS } from './avatars.jsx'

export default function PlayerView({ state, me, send }) {
  const [tab, setTab] = useState('market')
  const trading = state.phase === 'trading'
  const value = portfolioValue(state, me)
  const ret = value / me.start - 1

  useEffect(() => {
    if (state.phase === 'results') setTab('positions')
    if (state.phase === 'trading' && state.round > 1) setTab(Object.values(me.holdings).some((q) => q > 0) ? 'hedge' : 'market')
  }, [state.phase, state.round])

  const phaseLabel =
    state.phase === 'lobby'
      ? 'Ожидание начала игры'
      : state.phase === 'finished'
        ? 'Игра окончена'
        : `Раунд ${state.round} из ${state.settings.rounds} · ${trading ? 'торги открыты' : 'рынок закрыт'}`
  const marginCall = me.cash < 0

  return (
    <div className="player">
      <header className="p-head">
        <div className="p-me">
          <Avatar id={me.avatar} size={40} />
          <span className="p-name">{me.name}</span>
        </div>
        <dl className="p-stats">
          <div>
            <dt>Портфель</dt>
            <dd className="num">
              {money(value)} <span className={`small ${tone(ret)}`}>{pct(ret)}</span>
            </dd>
          </div>
          <div>
            <dt>Наличные</dt>
            <dd className={`num ${marginCall ? 'down' : ''}`}>{money(me.cash)}</dd>
          </div>
        </dl>
        <p className={`p-phase ${trading ? 'open' : ''}`}>
          {phaseLabel}
          {trading && <Timer deadline={state.deadline} offset={state._offset} />}
        </p>
        <div className="p-events">
          <EventStrips state={state} />
        </div>
      </header>
      <Takeover flash={state.flash} offset={state._offset} />

      {state.phase === 'lobby' && <LobbyWait state={state} me={me} send={send} />}
      {state.phase === 'finished' && <FinalCard state={state} me={me} />}

      {(state.phase === 'trading' || state.phase === 'results') && (
        <>
          {state.phase === 'results' && <RoundResult me={me} />}
          {marginCall && trading && (
            <p className="alert" role="alert">
              <strong>Маржин-колл.</strong> На счёте {money(me.cash)}. Покупки и новые контракты недоступны, пока вы не продадите
              активы или не закроете фьючерсы.
            </p>
          )}
          <nav className="tabs" aria-label="Разделы">
            <Seg
              label="Разделы"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'market', label: 'Купить / продать' },
                { value: 'hedge', label: 'Хеджирование' },
                { value: 'positions', label: `Мои позиции (${openContracts(me).length})` },
              ]}
            />
          </nav>
          {!trading && tab !== 'positions' && <p className="notice">Торги откроются, когда ведущий начнёт раунд {state.round + 1}.</p>}
          {tab === 'market' && <MarketTab state={state} me={me} send={send} locked={!trading} marginCall={marginCall} />}
          {tab === 'hedge' && <HedgeTab state={state} me={me} send={send} locked={!trading} marginCall={marginCall} />}
          {tab === 'positions' && <PositionsTab state={state} me={me} send={send} locked={!trading} />}
        </>
      )}
    </div>
  )
}

function LobbyWait({ state, me, send }) {
  const taken = takenAvatars(state, me.id)
  return (
    <section className="p-card">
      <div className="center">
        <h2>Вы в игре, {me.name}!</h2>
        <p>
          Смотрите на большой экран. Когда ведущий начнёт раунд 1, у вас будет {money0(me.start)}
          {me.loan > 0 && ` и кредит ${money0(me.loan)}`} на покупку активов.
        </p>
      </div>
      <h3>Выберите аватар</h3>
      <ul className="avatar-pick">
        {Array.from({ length: AVATAR_COUNT }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              aria-pressed={me.avatar === i}
              aria-label={AVATARS[i].label}
              disabled={taken.has(i)}
              onClick={() => send({ type: 'setAvatar', avatar: i })}
            >
              <Avatar id={i} size={52} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn ghost" onClick={() => send({ type: 'setRole', role: 'spectator' })}>
        Стать зрителем
      </button>
    </section>
  )
}

function RoundResult({ me }) {
  if (!me.last) return null
  const { round, before, after, hedge } = me.last
  const change = after - before
  const without = change - hedge
  return (
    <section className="p-card result">
      <h2>Раунд {round} закрыт</h2>
      <p className="result-big num">
        <span className={tone(change)}>{signedMoney(change)}</span>
      </p>
      <p>
        Портфель: {money(before)} → {money(after)}.
        {Math.abs(hedge) >= 0.01 ? (
          <>
            {' '}
            Деривативы дали <strong className={tone(hedge)}>{signedMoney(hedge)}</strong>. Без хеджирования было бы{' '}
            <strong className={tone(without)}>{signedMoney(without)}</strong>.
          </>
        ) : (
          ' В этом раунде у вас не было хеджей.'
        )}
      </p>
    </section>
  )
}

function FinalCard({ state, me }) {
  const rows = leaderboard(state)
  const rank = rows.findIndex((r) => r.id === me.id) + 1
  const value = portfolioValue(state, me)
  const h = hedgePnl(state, me)
  return (
    <>
      <section className="p-card center">
        <Avatar id={me.avatar} size={84} />
        <h2>
          {rank} место из {rows.length}
        </h2>
        <p className="result-big num">{money(value)}</p>
        <p>
          Доходность <strong className={tone(value / me.start - 1)}>{pct(value / me.start - 1)}</strong>. Деривативы за игру:{' '}
          <strong className={tone(h)}>{signedMoney(h)}</strong>.
        </p>
      </section>
      <Standings rows={rows} title="Итоговый рейтинг" meId={me.id} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Buy & sell
// ---------------------------------------------------------------------------

function MarketTab({ state, me, send, locked, marginCall }) {
  return (
    <section className="market" aria-label="Покупка и продажа">
      {state.assets.map((a) => (
        <SpotBlock key={a.id} a={a} me={me} send={send} locked={locked} marginCall={marginCall} />
      ))}
    </section>
  )
}

function SpotBlock({ a, me, send, locked, marginCall }) {
  const [q, setQ] = useState(10)
  const held = me.holdings[a.id] || 0
  const maxBuy = Math.max(0, Math.floor(Math.max(0, me.cash) / a.price))
  const ch = a.price / a.open - 1
  return (
    <article className={`spot asset-${a.id}`}>
      <div className="spot-top">
        <p className="spot-title">
          <Tag id={a.id} label={a.ticker} /> <span className="asset-name">{a.name}</span>
        </p>
        <p className="spot-total num">
          <span className="muted">
            {num(q || 0)} × {money(a.price)} =
          </span>{' '}
          {money((q || 0) * a.price)}
        </p>
      </div>
      <p className="spot-price num">
        {money(a.price)} <span className={`small ${tone(ch)}`}>{pct(ch)}</span>
      </p>
      <p className={`held ${held ? 'has' : ''}`}>
        {held ? (
          <>
            В портфеле: <strong>{num(held)} шт.</strong> · {money(held * a.price)}
          </>
        ) : (
          'Нет в портфеле'
        )}
      </p>
      <QtyInput
        value={q}
        onChange={setQ}
        label={`Количество ${a.ticker}`}
        extra={[{ label: `Макс (${maxBuy})`, value: Math.max(1, maxBuy), disabled: maxBuy < 1 }]}
      />
      <div className="spot-buttons">
        <button
          type="button"
          className="btn buy"
          disabled={locked || q < 1 || marginCall}
          title={marginCall ? 'Недоступно при маржин-колле' : undefined}
          onClick={() => send({ type: 'buy', assetId: a.id, qty: q })}
        >
          Купить
        </button>
        <button type="button" className="btn sell" disabled={locked || held < 1 || q < 1} onClick={() => send({ type: 'sell', assetId: a.id, qty: q })}>
          Продать
        </button>
      </div>
      {marginCall && !locked && <p className="small down">Покупка недоступна при маржин-колле.</p>}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Hedge desk
// ---------------------------------------------------------------------------

const EXPLAIN = {
  forward: (
    <>
      Договор купить или продать актив позже по сегодняшней цене. Сейчас ничего не платите. Когда срок закончится, вы получите
      или заплатите разницу между рыночной ценой и зафиксированной. Закрыть досрочно нельзя.
    </>
  ),
  future: (lot, rate) => (
    <>
      Как форвард, но стандартный: лотами по {lot} шт. Сейчас вносите маржу {Math.round(rate * 100)}%. Прибыль и убыток
      начисляются на счёт после каждого раунда, поэтому неудачное движение может вызвать маржин-колл. Можно закрыть досрочно в
      любом раунде.
    </>
  ),
  option: (
    <>
      <strong>Пут</strong> — право продать по страйку: выплата, если цена упадёт ниже страйка. Защищает купленные активы.
      <br />
      <strong>Колл</strong> — право купить по страйку: выплата, если цена вырастет выше страйка.
      <br />
      За право платите премию сразу.
    </>
  ),
  swap: (
    <>
      Обмен процентных платежей. «Платить фиксированную» превращает ваш плавающий кредит в кредит с фиксированной ставкой: если
      ключевая ставка вырастет, своп заплатит вам разницу. Расчёт после каждого раунда, без оплаты сейчас.
    </>
  ),
}

const INST_LABEL = { forward: 'Форвард', future: 'Фьючерс', option: 'Опцион', swap: 'Процентный своп' }

function HedgeTab({ state, me, send, locked, marginCall }) {
  const firstHeld = state.assets.find((a) => (me.holdings[a.id] || 0) > 0)?.id
  const [inst, setInst] = useState('forward')
  const [assetId, setAssetId] = useState(firstHeld || state.assets[0].id)
  const [side, setSide] = useState('short')
  const [optType, setOptType] = useState('put')
  const [swapSide, setSwapSide] = useState('payfixed')
  const [qty, setQty] = useState(() => Math.max(1, me.holdings[firstHeld] || 10))
  const [notional, setNotional] = useState(me.loan || 1000)
  const [maturity, setMaturity] = useState(1)
  const [strikePct, setStrikePct] = useState(0.95)

  const swap = inst === 'swap'
  const a = getAsset(state, assetId)
  const { futuresLot: lot, marginRate } = state.settings
  const held = me.holdings[assetId] || 0
  const maxM = swap ? maxSwapMaturityNow(state) : maxMaturityNow(state)
  const m = Math.min(maturity, maxM)
  const expiry = state.round + m - 1
  const option = inst === 'option'
  const units = inst === 'future' ? qty * lot : qty
  const K = Math.round(a.price * strikePct * 100) / 100
  const premium = option ? Math.max(0.01 * qty, optionPremium(state, a, optType, K, m) * qty) : 0
  const margin = inst === 'future' ? units * a.price * marginRate : 0
  const d = side === 'short' ? -1 : 1

  const hedgeAll = () => {
    if (inst === 'future') setQty(Math.max(1, Math.round(held / lot)))
    else setQty(Math.max(1, held))
    if (option) setOptType('put')
    else setSide('short')
  }

  const payoffAt = (ST) => {
    if (inst === 'forward' || inst === 'future') return (ST - a.price) * units * d
    const intrinsic = optType === 'call' ? Math.max(ST - K, 0) : Math.max(K - ST, 0)
    return intrinsic * qty - premium
  }
  const addsRisk = !swap && held > 0 && ((!option && side === 'long') || (option && optType === 'call'))

  const submit = () => {
    if (swap) send({ type: 'swap', side: swapSide, qty: notional, maturity: m })
    else if (option) send({ type: optType, assetId, qty, maturity: m, strikePct })
    else send({ type: inst, assetId, side, qty, maturity: m })
  }

  const actionLabel = swap
    ? 'Открыть своп'
    : option
      ? `Купить ${qty} ${optType === 'put' ? 'пут' : 'колл'} за ${money(premium)}`
      : inst === 'forward'
        ? `Открыть ${side === 'short' ? 'шорт' : 'лонг'} форвард`
        : `Открыть ${side === 'short' ? 'шорт' : 'лонг'} фьючерс`

  const instOptions = [
    { value: 'forward', label: 'Форвард' },
    { value: 'future', label: 'Фьючерс' },
    { value: 'option', label: 'Опцион' },
    ...(swapsEnabled(state) ? [{ value: 'swap', label: 'Своп' }] : []),
  ]

  return (
    <section className="hedge" aria-label="Хеджирование">
      <Seg label="Инструмент" value={inst} onChange={setInst} options={instOptions} size="big" />
      <div className="inst-title">
        <h3>{INST_LABEL[inst]}</h3>
        <InfoTip title={INST_LABEL[inst]}>{inst === 'future' ? EXPLAIN.future(lot, marginRate) : EXPLAIN[inst]}</InfoTip>
      </div>

      {option && (
        <Seg
          label="Тип опциона"
          value={optType}
          onChange={setOptType}
          options={[
            { value: 'put', label: 'Пут: защита от падения' },
            { value: 'call', label: 'Колл: заработок на росте' },
          ]}
        />
      )}

      {swap ? (
        <SwapForm
          state={state}
          me={me}
          swapSide={swapSide}
          setSwapSide={setSwapSide}
          notional={notional}
          setNotional={setNotional}
        />
      ) : (
        <>
          <div className="field">
            <span className="field-label">Базовый актив</span>
            <Seg
              label="Базовый актив"
              value={assetId}
              onChange={setAssetId}
              options={state.assets.map((x) => ({
                value: x.id,
                label: (
                  <>
                    <AssetIcon id={x.id} /> {x.ticker}
                    {me.holdings[x.id] ? ` (${me.holdings[x.id]})` : ''}
                  </>
                ),
              }))}
            />
            <p className="muted small">
              {a.name}: {money(a.price)}. У вас {num(held)} шт.
            </p>
          </div>

          {!option && (
            <div className="field">
              <span className="field-label">Направление</span>
              <Seg
                label="Направление"
                value={side}
                onChange={setSide}
                options={[
                  { value: 'short', label: 'Шорт (продать позже)' },
                  { value: 'long', label: 'Лонг (купить позже)' },
                ]}
              />
            </div>
          )}

          <div className="field">
            <span className="field-label">
              {inst === 'future' ? `Лоты (по ${lot} шт.)` : option ? 'Количество опционов' : 'Количество, шт.'}
            </span>
            <QtyInput
              value={qty}
              onChange={setQty}
              steps={inst === 'future' ? [-5, -1, 1, 5] : [-10, -5, 5, 10]}
              extra={held > 0 ? [{ label: `Захеджировать все ${held}`, value: inst === 'future' ? Math.max(1, Math.round(held / lot)) : held }] : []}
            />
            {inst === 'future' && <p className="muted small">{num(units)} шт.</p>}
          </div>

          {option && (
            <div className="field">
              <span className="field-label">Страйк</span>
              <Seg
                label="Страйк"
                value={strikePct}
                onChange={setStrikePct}
                options={STRIKES.map((s) => ({ value: s, label: money0(a.price * s) }))}
              />
              <p className="muted small">
                {strikePct === 1
                  ? 'Равен текущей цене.'
                  : `На ${Math.round(Math.abs(strikePct - 1) * 100)}% ${strikePct < 1 ? 'ниже' : 'выше'} текущей цены.`}{' '}
                Премия {money(premium / Math.max(qty, 1))} за опцион.
              </p>
            </div>
          )}
        </>
      )}

      <div className="field">
        <span className="field-label">Срок</span>
        <Seg
          label="Срок"
          value={m}
          onChange={setMaturity}
          options={Array.from({ length: maxM }, (_, i) => ({ value: i + 1, label: rounds(i + 1) }))}
        />
        <p className="muted small">Расчёт при закрытии раунда {expiry}</p>
      </div>

      <div className="quote">
        {swap ? (
          <SwapQuote state={state} me={me} swapSide={swapSide} notional={notional} expiry={expiry} />
        ) : (
          <>
            <p className="quote-line">
              {inst === 'forward' &&
                `Вы ${side === 'short' ? 'продадите' : 'купите'} ${num(units)} шт. ${a.ticker} по ${money(a.price)} при закрытии раунда ${expiry}. Сейчас — бесплатно.`}
              {inst === 'future' &&
                `${side === 'short' ? 'Шорт' : 'Лонг'} ${num(units)} шт. ${a.ticker} от ${money(a.price)}. Маржа сейчас: ${money(margin)}.`}
              {option &&
                `${qty} ${optType === 'put' ? 'пут' : 'колл'}, страйк ${money(K)}. Премия сейчас: ${money(premium)}.`}
            </p>
            {addsRisk && (
              <p className="warn small">
                У вас уже есть {a.ticker}. Эта позиция зарабатывает на росте цены, то есть добавляет риск, а не защищает.
              </p>
            )}
            <table className="scenarios">
              <caption>Если в конце раунда {expiry} цена {a.ticker} будет…</caption>
              <thead>
                <tr>
                  <th scope="col">Цена</th>
                  <th scope="col" className="r">
                    Контракт
                  </th>
                  <th scope="col" className="r">
                    Ваши {num(held)} шт.
                  </th>
                  <th scope="col" className="r">
                    Вместе
                  </th>
                </tr>
              </thead>
              <tbody>
                {[-0.2, -0.1, 0, 0.1, 0.2].map((r) => {
                  const ST = a.price * (1 + r)
                  const c = payoffAt(ST)
                  const h = held * (ST - a.price)
                  return (
                    <tr key={r}>
                      <th scope="row" className="num">
                        {money0(ST)} <span className="muted small">{pct(r, 0)}</span>
                      </th>
                      <td className={`r num ${tone(c)}`}>{signedMoney(c)}</td>
                      <td className={`r num ${tone(h)}`}>{signedMoney(h)}</td>
                      <td className={`r num strong ${tone(c + h)}`}>{signedMoney(c + h)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
        <button
          type="button"
          className="btn primary wide big"
          disabled={locked || marginCall || (swap ? notional < 1 : qty < 1)}
          onClick={submit}
        >
          {actionLabel}
        </button>
        {marginCall && !locked && <p className="small down">Новые контракты недоступны при маржин-колле.</p>}
      </div>
    </section>
  )
}

function SwapForm({ state, me, swapSide, setSwapSide, notional, setNotional }) {
  return (
    <>
      <p className="loan-line">
        Ваш кредит: <strong>{money(me.loan)}</strong> под {rateFmt(loanRate(state))} (ключевая {rateFmt(state.rate.value)} +{' '}
        {Math.round(state.settings.loanSpread * 100)} п.п.). Проценты за раунд сейчас: {money((me.loan * loanRate(state)) / ROUNDS_PER_YEAR)}.
      </p>
      <div className="field">
        <span className="field-label">Сторона</span>
        <Seg
          label="Сторона свопа"
          value={swapSide}
          onChange={setSwapSide}
          options={[
            { value: 'payfixed', label: 'Платить фиксированную' },
            { value: 'recfixed', label: 'Получать фиксированную' },
          ]}
        />
        <p className="muted small">
          {swapSide === 'payfixed'
            ? 'Защита от роста ставки: если ставка вырастет, своп заплатит вам.'
            : 'Ставка на снижение ставки: если ставка упадёт, своп заплатит вам.'}
        </p>
      </div>
      <div className="field">
        <span className="field-label">Сумма (номинал), $</span>
        <QtyInput
          value={notional}
          onChange={setNotional}
          label="Номинал свопа"
          steps={[-1000, -500, 500, 1000]}
          format={num}
          extra={me.loan > 0 ? [{ label: 'Как мой кредит', value: me.loan }] : []}
        />
      </div>
    </>
  )
}

function SwapQuote({ state, me, swapSide, notional, expiry }) {
  const fixed = state.rate.value
  const d = swapSide === 'payfixed' ? 1 : -1
  return (
    <>
      <p className="quote-line">
        Фиксированная ставка {rateFmt(fixed)} на {money(notional)} до закрытия раунда {expiry}. Сейчас — бесплатно.
      </p>
      <table className="scenarios">
        <caption>Если ключевая ставка станет… (выплаты за один раунд)</caption>
        <thead>
          <tr>
            <th scope="col">Ставка</th>
            <th scope="col" className="r">
              Своп
            </th>
            <th scope="col" className="r">
              Проценты по кредиту
            </th>
            <th scope="col" className="r">
              Вместе
            </th>
          </tr>
        </thead>
        <tbody>
          {[-0.02, -0.01, 0, 0.01, 0.02].map((ch) => {
            const r = Math.max(0.005, fixed + ch)
            const sw = ((r - fixed) * notional * d) / ROUNDS_PER_YEAR
            const loan = -(me.loan * (r + state.settings.loanSpread)) / ROUNDS_PER_YEAR
            return (
              <tr key={ch}>
                <th scope="row" className="num">
                  {rateFmt(r)} <span className="muted small">{pp(ch).replace(' п.п.', '')}</span>
                </th>
                <td className={`r num ${tone(sw)}`}>{signedMoney(sw)}</td>
                <td className={`r num ${tone(loan)}`}>{signedMoney(loan)}</td>
                <td className={`r num strong ${tone(sw + loan)}`}>{signedMoney(sw + loan)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

const SIDE = { short: 'Шорт', long: 'Лонг' }

function contractTitle(state, c) {
  if (c.type === 'swap') return `Своп · ${c.side === 'payfixed' ? 'платить фикс.' : 'получать фикс.'}`
  const t = getAsset(state, c.assetId).ticker
  if (c.type === 'forward') return `${SIDE[c.side]} форвард · ${t}`
  if (c.type === 'future') return `${SIDE[c.side]} фьючерс · ${t}`
  return `Опцион ${c.type === 'put' ? 'пут' : 'колл'} · ${t}`
}

function contractDetail(c) {
  if (c.type === 'swap') return `${money(c.qty)}, фикс. ставка ${rateFmt(c.fixed)}`
  if (c.type === 'forward') return `${c.side === 'short' ? 'Продать' : 'Купить'} ${num(c.qty)} шт. по ${money(c.price)}`
  if (c.type === 'future') return `${c.lots} лот. (${num(c.qty)} шт.) от ${money(c.price)}, маржа ${money(c.margin)}`
  return `${num(c.qty)} шт., страйк ${money(c.strike)}, премия ${money(c.premium)}`
}

function PositionsTab({ state, me, send, locked }) {
  const open = openContracts(me)
  const done = me.contracts.filter((c) => c.status !== 'open').reverse()
  const held = state.assets.filter((a) => (me.holdings[a.id] || 0) > 0)
  const hp = hedgePnl(state, me)
  return (
    <section className="positions">
      <dl className="summary">
        <div>
          <dt>Активы</dt>
          <dd className="num">{money(holdingsValue(state, me))}</dd>
        </div>
        <div>
          <dt>Наличные</dt>
          <dd className={`num ${me.cash < 0 ? 'down' : ''}`}>{money(me.cash)}</dd>
        </div>
        <div>
          <dt>Деривативы</dt>
          <dd className={`num ${tone(hp)}`}>{signedMoney(hp)}</dd>
        </div>
      </dl>

      <h3>Мои активы</h3>
      {held.length === 0 ? (
        <p className="muted">Пока пусто. Купите активы во вкладке «Купить / продать».</p>
      ) : (
        <ul className="holdings">
          {held.map((a) => (
            <li key={a.id} className={`asset-${a.id}`}>
              <Tag id={a.id} label={a.ticker} />
              <span className="num qty-col">{num(me.holdings[a.id])}</span>
              <span className="sep">|</span>
              <span className="num">{money(me.holdings[a.id] * a.price)}</span>
            </li>
          ))}
        </ul>
      )}
      {me.loan > 0 && (
        <p className="loan-line">
          Кредит <strong>{money(me.loan)}</strong> под {rateFmt(loanRate(state))}. Уплачено процентов: {money(me.interestPaid)}.
        </p>
      )}

      <h3>Открытые контракты</h3>
      {open.length === 0 ? (
        <p className="muted">Хеджей нет: ваши активы полностью открыты следующему движению рынка.</p>
      ) : (
        <ul className="contracts">
          {open.map((c) => (
            <ContractCard key={c.id} state={state} me={me} c={c} send={send} locked={locked} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="done">
          <summary>Завершённые контракты ({done.length})</summary>
          <ul className="contracts">
            {done.map((c) => (
              <li key={c.id} className={`contract done-card asset-${c.assetId}`}>
                <div className="c-top">
                  <span className="c-title">{contractTitle(state, c)}</span>
                  <span className={`c-result num ${tone(c.pnl)}`}>{signedMoney(c.pnl)}</span>
                </div>
                <p className="small muted">
                  {contractDetail(c)}. {c.status === 'closed' ? `Закрыт досрочно в раунде ${c.closedRound}` : `Исполнен в раунде ${c.expiry}`}.
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function ContractCard({ state, me, c, send, locked }) {
  const res = contractResult(state, c)
  const left = remaining(state, c)
  const prot = protects(state, me, c)
  const exposure = c.type === 'swap' ? me.loan : me.holdings[c.assetId] || 0
  const covered = Math.min(prot, exposure)
  const unit = c.type === 'swap' ? '' : ` шт. ${getAsset(state, c.assetId).ticker}`
  return (
    <li className={`contract asset-${c.assetId}`}>
      <div className="c-top">
        <span className="c-title">
          <AssetIcon id={c.assetId} /> {contractTitle(state, c)}
        </span>
        <span className={`c-result num ${tone(res)}`}>{signedMoney(res)}</span>
      </div>
      <p className="c-detail">{contractDetail(c)}</p>
      <p className="c-detail muted">
        Истекает после раунда {c.expiry}
        {state.phase === 'trading' ? (left === 1 ? ' (в этом раунде)' : ` (осталось ${rounds(left)})`) : ` (осталось ${rounds(left)})`}
      </p>
      {prot > 0 && exposure > 0 ? (
        <div className="cover">
          <span className="small">
            Защищает {c.type === 'swap' ? `${money0(covered)} из ${money0(exposure)} кредита` : `${num(covered)} из ваших ${num(exposure)}${unit}`}
          </span>
          <span className="cover-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((covered / exposure) * 100)}%` }} />
          </span>
        </div>
      ) : (
        prot === 0 && <p className="small warn-text">Эта позиция добавляет риск, а не защищает.</p>
      )}
      {c.type === 'future' && (
        <button type="button" className="btn ghost small-btn" disabled={locked} onClick={() => send({ type: 'closeFuture', contractId: c.id })}>
          Закрыть досрочно по {money(getAsset(state, c.assetId).price)}
        </button>
      )}
    </li>
  )
}
