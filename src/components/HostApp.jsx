import { useEffect, useRef, useState } from 'react'
import {
  NEWS_PRESETS,
  NEWS_TYPES,
  TIMER_OPTIONS,
  VOL_LEVELS,
  addNews,
  addTime,
  applyAction,
  createGame,
  finishGame,
  hedgePnl,
  joinPlayer,
  kickPlayer,
  leaderboard,
  nextRound,
  openContracts,
  portfolioValue,
  publicState,
  removeNews,
  resolveRound,
  startGame,
  swapsEnabled,
  tickerOf,
  updateSettings,
} from '../lib/game.js'
import { DEMO, connectRoom } from '../lib/transport.js'
import { clearGame, loadGame, saveGame, saveLastHost } from '../lib/storage.js'
import { money0, pct, pp, rateFmt, signedMoney0, tone } from '../lib/format.js'
import { joinUrl } from './Board.jsx'
import { APP_NAME, Avatar, Seg, useRemaining, mmss } from './ui.jsx'

const THROTTLE_MS = 300

export default function HostApp({ session, onLeave }) {
  const code = session.code
  const [state, setState] = useState(() => loadGame(code) || createGame(code))
  const [status, setStatus] = useState('connecting')
  const [tab, setTab] = useState(() => (state.phase === 'lobby' ? 'settings' : 'news'))
  const transport = useRef(null)
  const latest = useRef(state)
  const timer = useRef(null)
  const lastSent = useRef(0)

  const sendNow = () => {
    timer.current = null
    lastSent.current = Date.now()
    transport.current?.broadcast('state', publicState(latest.current))
  }

  useEffect(() => {
    saveLastHost(code)
    const t = connectRoom(code, {
      host: true,
      onStatus: setStatus,
      onMessage: (event, payload) => {
        if (event === 'join') setState((s) => joinPlayer(s, payload || {}))
        else if (event === 'action') setState((s) => applyAction(s, payload?.id, payload?.action))
        else if (event === 'hello') setState((s) => ({ ...s }))
      },
    })
    transport.current = t
    const heartbeat = setInterval(sendNow, 5000)
    return () => {
      clearInterval(heartbeat)
      clearTimeout(timer.current)
      t.close()
    }
  }, [code])

  useEffect(() => {
    latest.current = state
    saveGame(state)
    if (timer.current) return
    timer.current = setTimeout(sendNow, Math.max(0, THROTTLE_MS - (Date.now() - lastSent.current)))
  }, [state])

  useEffect(() => {
    if (status === 'live') sendNow()
  }, [status])

  // Round timer: close the market automatically when time runs out
  useEffect(() => {
    if (state.phase !== 'trading' || !state.deadline) return
    const t = setInterval(() => {
      if (Date.now() >= latest.current.deadline && latest.current.phase === 'trading') setState((s) => resolveRound(s))
    }, 400)
    return () => clearInterval(t)
  }, [state.phase, state.deadline])

  useEffect(() => {
    if (state.phase !== 'lobby' && tab === 'settings') setTab('news')
  }, [state.phase])

  const leave = () => {
    if (!confirm('Закрыть комнату? Студенты отключатся, игру нельзя будет продолжить.')) return
    clearGame(code)
    saveLastHost(null)
    onLeave()
  }

  const players = Object.values(state.players)
  const traders = players.filter((p) => p.role === 'player')

  return (
    <div className="hostc">
      <header className="hostc-top">
        <p className="hostc-brand">{APP_NAME}</p>
        <p className="hostc-room">
          Комната <strong>{code}</strong>
        </p>
        <ConnectionLine status={status} />
        <div className="hostc-top-actions">
          <a className="btn primary" href={`${joinUrl(code)}&board=1`} target="_blank" rel="noreferrer">
            Открыть экран для проектора ↗
          </a>
          <button type="button" className="btn ghost danger" onClick={leave}>
            Закрыть комнату
          </button>
        </div>
      </header>

      <NextStep state={state} setState={setState} traders={traders.length} />

      <div className="hostc-main">
        <section className="hostc-work">
          <Seg
            label="Разделы ведущего"
            value={tab}
            onChange={setTab}
            size="big"
            options={[
              { value: 'news', label: 'Новости', disabled: state.phase === 'lobby' || state.phase === 'finished' },
              { value: 'players', label: `Игроки (${traders.length})` },
              { value: 'settings', label: state.phase === 'lobby' ? 'Настройки' : 'Настройки (только просмотр)' },
            ]}
          />
          {tab === 'news' && <NewsDesk state={state} setState={setState} />}
          {tab === 'players' && <PlayersTab state={state} setState={setState} />}
          {tab === 'settings' && <Settings state={state} setState={setState} />}
        </section>
        <aside className="hostc-side">
          <MarketNow state={state} />
        </aside>
      </div>
    </div>
  )
}

function ConnectionLine({ status }) {
  const text = DEMO
    ? 'Демо-режим: подключиться можно только из вкладок этого браузера'
    : status === 'live'
      ? 'Онлайн'
      : status === 'error'
        ? 'Нет связи с Supabase: проверьте ключи'
        : 'Подключение…'
  return <p className={`conn conn-${DEMO ? 'demo' : status}`}>{text}</p>
}

const STEPS = [
  { key: 'trading', label: 'Торги' },
  { key: 'close', label: 'Закрытие рынка' },
  { key: 'results', label: 'Итоги раунда' },
]

function NextStep({ state, setState, traders }) {
  const left = useRemaining(state.deadline, 0)
  const queued = state.news.filter((n) => n.status === 'queued')
  const settling = Object.values(state.players).reduce(
    (t, p) => t + openContracts(p).filter((c) => c.expiry <= state.round).length,
    0,
  )
  let label, action, preview
  if (state.phase === 'lobby') {
    label = 'Начать раунд 1'
    action = startGame
    preview = traders ? `Игроков: ${traders}. Опоздавшие смогут подключиться и во время игры.` : 'Пока никто не подключился.'
  } else if (state.phase === 'trading') {
    label = 'Закрыть торги'
    action = (s) => resolveRound(s)
    const parts = ['цены сделают случайный шаг']
    if (queued.length) parts.push(`сработает новостей: ${queued.length}`)
    if (settling) parts.push(`исполнится контрактов: ${settling}`)
    preview = `Дальше: ${parts.join(', ')}.`
  } else if (state.phase === 'results' && state.round < state.settings.rounds) {
    label = `Начать раунд ${state.round + 1}`
    action = nextRound
    preview = 'Дайте студентам прочитать итоги раунда.'
  } else if (state.phase === 'results') {
    label = 'Показать итоги игры'
    action = finishGame
    preview = 'Это был последний раунд.'
  }
  const stepIndex = state.phase === 'trading' ? 0 : state.phase === 'results' ? 2 : -1
  return (
    <section className="nextstep">
      <div className="ns-round">
        <p className="ns-round-n">
          {state.phase === 'lobby' ? 'Лобби' : state.phase === 'finished' ? 'Игра окончена' : `Раунд ${state.round} из ${state.settings.rounds}`}
        </p>
        {stepIndex >= 0 && (
          <ol className="stepper">
            {STEPS.map((s, i) => (
              <li key={s.key} className={i === stepIndex ? 'now' : i < stepIndex ? 'done' : ''}>
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </div>
      {state.phase === 'trading' && left !== null && (
        <div className={`ns-timer ${left <= 10 ? 'urgent' : ''}`}>
          <span className="num">{mmss(left)}</span>
          <button type="button" className="btn ghost" onClick={() => setState((s) => addTime(s, 30))}>
            +30 с
          </button>
        </div>
      )}
      {action ? (
        <div className="ns-action">
          <button type="button" className="btn primary huge" onClick={() => setState(action)}>
            {label} ▶
          </button>
          <p className="muted small">{preview}</p>
        </div>
      ) : (
        <div className="ns-action">
          <p>Игра окончена. Итоги — на экране проектора.</p>
        </div>
      )}
    </section>
  )
}

function NewsDesk({ state, setState }) {
  const [draft, setDraft] = useState(null)
  const queued = state.news.filter((n) => n.status === 'queued')
  const open = (preset) =>
    setDraft(
      preset
        ? { headline: preset.headline, assetId: preset.assetId, impact: Math.round(preset.impact * 100), rate: preset.rate * 100 }
        : { headline: '', assetId: 'OIL', impact: -10, rate: 0 },
    )
  const presets = NEWS_PRESETS.filter((p) => swapsEnabled(state) || !p.rate)

  return (
    <div className="newsdesk">
      {draft && <Composer state={state} draft={draft} setDraft={setDraft} setState={setState} />}

      {queued.length > 0 && (
        <section className="queued">
          <h3>Ждут закрытия рынка</h3>
          <ul>
            {queued.map((n) => (
              <li key={n.id}>
                <span className={`type-badge type-${n.type}`}>{NEWS_TYPES[n.type].label}</span>
                <span className={`tag asset-${n.assetId}`}>{tickerOf(state, n.assetId)}</span>
                <span className="q-headline">{n.headline}</span>
                <span className="num small">{effectText(n.assetId, n.impact, n.rate)}</span>
                <button type="button" className="icon-btn" aria-label={`Убрать «${n.headline}»`} onClick={() => setState((s) => removeNews(s, n.id))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h3>Готовые новости</h3>
      <ul className="news-cards">
        <li>
          <button type="button" className="news-card own" onClick={() => open(null)}>
            <span className="plus">+</span>
            <span>Своя новость</span>
          </button>
        </li>
        {presets.map((p, i) => (
          <li key={i}>
            <button type="button" className={`news-card asset-${p.assetId}`} onClick={() => open(p)}>
              <span className={`tag asset-${p.assetId}`}>{tickerOf(state, p.assetId)}</span>
              <span className="nc-headline">{p.headline}</span>
              <span className="nc-effect num">{effectText(p.assetId, p.impact, p.rate)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function effectText(assetId, impact, rate) {
  const parts = []
  if (assetId !== 'NONE' && impact) parts.push(pct(impact, 0))
  if (rate) parts.push(`ставка ${pp(rate)}`)
  return parts.join(', ')
}

function Composer({ state, draft, setDraft, setState }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const canShock = state.phase === 'trading'
  const ready = draft.headline.trim().length > 0
  const send = (type) => {
    if (!ready) return
    setState((s) =>
      addNews(s, {
        headline: draft.headline.trim(),
        assetId: draft.assetId,
        impact: draft.impact / 100,
        rate: swapsEnabled(state) ? draft.rate / 100 : 0,
        type,
      }),
    )
    setDraft(null)
  }
  return (
    <section className="composer">
      <div className="composer-head">
        <h3>Новость</h3>
        <button type="button" className="icon-btn" aria-label="Закрыть" onClick={() => setDraft(null)}>
          ×
        </button>
      </div>
      <label>
        Заголовок
        <input value={draft.headline} maxLength={120} placeholder="Например: взрыв на нефтепроводе" onChange={(e) => set({ headline: e.target.value })} autoFocus />
      </label>
      <div className="composer-grid">
        <div className="field">
          <span className="field-label">Что двигает</span>
          <Seg
            label="Актив"
            value={draft.assetId}
            onChange={(v) => set({ assetId: v })}
            options={[
              ...state.assets.map((a) => ({ value: a.id, label: a.ticker })),
              { value: 'ALL', label: 'Весь рынок' },
              ...(swapsEnabled(state) ? [{ value: 'NONE', label: 'Только ставку' }] : []),
            ]}
          />
        </div>
        {draft.assetId !== 'NONE' && (
          <label className="slider">
            <span>
              Влияние на цену{' '}
              <strong className={draft.impact > 0 ? 'up' : draft.impact < 0 ? 'down' : ''}>{pct(draft.impact / 100, 0)}</strong>
            </span>
            <input type="range" min="-40" max="40" step="1" value={draft.impact} onChange={(e) => set({ impact: Number(e.target.value) })} />
          </label>
        )}
        {swapsEnabled(state) && (
          <label className="slider">
            <span>
              Изменение ключевой ставки <strong>{pp(draft.rate / 100)}</strong>
            </span>
            <input type="range" min="-3" max="3" step="0.25" value={draft.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
          </label>
        )}
      </div>
      <div className="type-buttons">
        {Object.entries(NEWS_TYPES).map(([type, t]) => (
          <button
            key={type}
            type="button"
            className={`type-btn type-${type}`}
            disabled={!ready || (type === 'shock' && !canShock)}
            onClick={() => send(type)}
          >
            <strong>{t.label}</strong>
            <span>{type === 'shock' && !canShock ? 'Доступно только во время торгов.' : t.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function PlayersTab({ state, setState }) {
  const rows = leaderboard(state)
  const watchers = Object.values(state.players).filter((p) => p.role === 'spectator')
  const kick = (p) => {
    if (confirm(`Удалить игрока ${p.name}?`)) setState((s) => kickPlayer(s, p.id))
  }
  return (
    <div className="players-tab">
      {rows.length === 0 ? (
        <p className="muted">Пока никто не подключился. Код комнаты — на экране проектора.</p>
      ) : (
        <table className="ptable">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Игрок</th>
              <th scope="col" className="r">
                Портфель
              </th>
              <th scope="col" className="r">
                Доходность
              </th>
              <th scope="col" className="r">
                Деривативы
              </th>
              <th scope="col" className="r">
                Контракты
              </th>
              <th scope="col">
                <span className="sr">Удалить</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = state.players[r.id]
              return (
                <tr key={r.id}>
                  <td className="rank">{i + 1}</td>
                  <td className="who">
                    <Avatar id={p.avatar} size={32} />
                    <span>{p.name}</span>
                    {p.cash < 0 && <span className="badge-mc">маржин-колл</span>}
                  </td>
                  <td className="r num">{money0(r.value)}</td>
                  <td className={`r num ${tone(r.ret)}`}>{pct(r.ret)}</td>
                  <td className={`r num ${tone(r.hedge)}`}>{signedMoney0(hedgePnl(state, p))}</td>
                  <td className="r num">{openContracts(p).length}</td>
                  <td className="r">
                    <button type="button" className="icon-btn" aria-label={`Удалить ${p.name}`} onClick={() => kick(p)}>
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {watchers.length > 0 && (
        <>
          <h3>Зрители ({watchers.length})</h3>
          <ul className="watchers">
            {watchers.map((p) => (
              <li key={p.id}>
                <Avatar id={p.avatar} size={28} /> {p.name}
                <button type="button" className="icon-btn" aria-label={`Удалить ${p.name}`} onClick={() => kick(p)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Settings({ state, setState }) {
  const s = state.settings
  const locked = state.phase !== 'lobby'
  const set = (patch) => setState((st) => updateSettings(st, patch))
  return (
    <div className="settings">
      {locked && <p className="notice">Игра уже идёт, поэтому правила зафиксированы.</p>}
      <fieldset disabled={locked}>
        <div className="form-grid">
          <label>
            Раундов
            <input type="number" min="1" max="15" value={s.rounds} onChange={(e) => set({ rounds: e.target.value })} />
          </label>
          <label>
            Стартовый капитал, $
            <input type="number" min="500" step="500" value={s.startCash} onChange={(e) => set({ startCash: e.target.value })} />
          </label>
          <label>
            Кредит каждому, $ (0 — без кредита и свопов)
            <input type="number" min="0" step="500" value={s.loan} onChange={(e) => set({ loan: e.target.value })} />
          </label>
          <label>
            Ключевая ставка на старте, %
            <input
              type="number"
              min="0"
              max="30"
              step="0.25"
              value={Math.round(s.startRate * 10000) / 100}
              onChange={(e) => set({ startRate: Number(e.target.value) / 100 })}
            />
          </label>
          <label>
            Маржа по фьючерсам, %
            <input type="number" min="5" max="50" value={Math.round(s.marginRate * 100)} onChange={(e) => set({ marginRate: Number(e.target.value) / 100 })} />
          </label>
          <label>
            Самый долгий контракт, раундов
            <input type="number" min="1" max="5" value={s.maxMaturity} onChange={(e) => set({ maxMaturity: e.target.value })} />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Случайное движение цен</span>
          <Seg label="Волатильность" value={s.volLevel} onChange={(v) => set({ volLevel: v })} options={VOL_LEVELS.map((v) => ({ value: v.value, label: v.label }))} />
        </div>
        <div className="field">
          <span className="field-label">Таймер торгов в каждом раунде</span>
          <Seg
            label="Таймер"
            value={s.timer}
            onChange={(v) => set({ timer: v })}
            options={TIMER_OPTIONS.map((t) => ({ value: t, label: t ? `${t} с` : 'Выкл.' }))}
          />
          <p className="muted small">Когда время выходит, торги закрываются сами. Закрыть раньше можно в любой момент.</p>
        </div>
      </fieldset>
    </div>
  )
}

function MarketNow({ state }) {
  const rows = leaderboard(state).slice(0, 5)
  return (
    <div className="market-now">
      <h3>Рынок сейчас</h3>
      <ul className="mini-prices">
        {state.assets.map((a) => {
          const ch = a.price / a.open - 1
          return (
            <li key={a.id} className={`asset-${a.id}`}>
              <span className="tag">{a.ticker}</span>
              <span className="num">{money0(a.price)}</span>
              <span className={`num small ${tone(ch)}`}>{pct(ch)}</span>
            </li>
          )
        })}
        {swapsEnabled(state) && (
          <li className="asset-RATE">
            <span className="tag">СТАВКА</span>
            <span className="num">{rateFmt(state.rate.value)}</span>
            <span className="num small">{pp(state.rate.value - state.rate.open)}</span>
          </li>
        )}
      </ul>
      <h3>Лидеры</h3>
      {rows.length === 0 ? (
        <p className="muted small">Нет игроков.</p>
      ) : (
        <ol className="mini-leaders">
          {rows.map((r) => (
            <li key={r.id}>
              <Avatar id={r.avatar} size={24} />
              <span className="ml-name">{r.name}</span>
              <span className="num small">{money0(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
      <h3>Последние новости</h3>
      {state.news.filter((n) => n.status === 'fired').length === 0 ? (
        <p className="muted small">Пока без новостей.</p>
      ) : (
        <ul className="mini-news">
          {[...state.news]
            .filter((n) => n.status === 'fired')
            .reverse()
            .slice(0, 4)
            .map((n) => (
              <li key={n.id}>
                <span className={`tag asset-${n.assetId}`}>{tickerOf(state, n.assetId)}</span> {n.headline}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
