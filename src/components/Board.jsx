import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { leaderboard, swapsEnabled, tickerOf } from '../lib/game.js'
import { money, money0, pct, pp, rateFmt, signedMoney, signedMoney0, tone } from '../lib/format.js'
import { APP_NAME, Avatar, Chart, Timer } from './ui.jsx'

export const joinUrl = (code) => `${location.origin}${location.pathname}?room=${code}`

export default function Board({ state }) {
  return (
    <div className="board">
      <FlashBanner flash={state.flash} />
      {state.phase === 'lobby' ? <Lobby state={state} /> : state.phase === 'finished' ? <Final state={state} /> : <Live state={state} />}
    </div>
  )
}

const FLASH_LABEL = { shock: 'Шок: цены уже движутся', rumor: 'Слух: рынок отреагирует при закрытии', close: 'Новости при закрытии рынка' }

function FlashBanner({ flash }) {
  const [shown, setShown] = useState(null)
  useEffect(() => {
    if (!flash || Date.now() - flash.t > 60000) return
    setShown(flash)
    const t = setTimeout(() => setShown(null), 8000)
    return () => clearTimeout(t)
  }, [flash?.id])
  if (!shown) return null
  return (
    <div className={`flash flash-${shown.kind}`} role="status" onClick={() => setShown(null)}>
      <p className="flash-label">{FLASH_LABEL[shown.kind]}</p>
      {shown.headlines.map((h, i) => (
        <p className="flash-headline" key={i}>
          {h}
        </p>
      ))}
    </div>
  )
}

function Lobby({ state }) {
  const url = joinUrl(state.code)
  const [qr, setQr] = useState(null)
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 360, color: { dark: '#13213A', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [url])
  const people = Object.values(state.players)
  const traders = people.filter((p) => p.role === 'player')
  const watchers = people.filter((p) => p.role === 'spectator')
  return (
    <section className="lobby">
      <div className="lobby-join">
        <p className="lobby-brand">{APP_NAME}</p>
        <p className="lobby-how">
          Откройте <strong>{url.replace(/^https?:\/\//, '').replace(/\?.*/, '')}</strong> и введите код
        </p>
        <p className="room-code" aria-label={`Код комнаты ${state.code.split('').join(' ')}`}>
          {state.code}
        </p>
        {qr && <img className="qr" src={qr} alt="QR-код со ссылкой на игру" />}
      </div>
      <div className="lobby-floor">
        <h2 className="floor-count">
          Игроков: {traders.length}
          {watchers.length > 0 && <span className="muted">, зрителей: {watchers.length}</span>}
        </h2>
        {traders.length === 0 ? (
          <p className="muted">Имена появятся здесь, как только студенты подключатся.</p>
        ) : (
          <ul className="avatar-wall">
            {traders.map((p) => (
              <li key={p.id}>
                <Avatar id={p.avatar} size={72} />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="lobby-rules muted">
          У каждого {money0(state.settings.startCash)}
          {state.settings.loan > 0 && ` и кредит ${money0(state.settings.loan)}`}. Раундов: {state.settings.rounds}. Покупайте
          активы и защищайте их форвардами, фьючерсами, опционами и свопами, пока не грянули новости.
        </p>
      </div>
    </section>
  )
}

function Live({ state }) {
  const results = state.phase === 'results'
  const rumors = state.news.filter((n) => n.status !== 'fired')
  return (
    <section className="live">
      <header className="live-head">
        <p className="round">
          Раунд {state.round}
          <span className="round-of"> из {state.settings.rounds}</span>
        </p>
        <p className={`phase-pill ${results ? 'closed' : 'open'}`}>{results ? 'Рынок закрыт' : 'Торги открыты'}</p>
        {!results && <Timer deadline={state.deadline} offset={state._offset} className="board-timer" />}
        <p className="room-chip">Комната {state.code}</p>
      </header>
      {rumors.length > 0 && <RumorBanner news={rumors} state={state} />}
      <div className="live-grid">
        <div className="tiles">
          {state.assets.map((a) => (
            <AssetTile key={a.id} a={a} move={results ? state.lastMoves?.[a.id] : null} />
          ))}
          {swapsEnabled(state) && <RateTile rate={state.rate} />}
        </div>
        <aside className="side">
          <NewsTape state={state} />
          <Standings rows={leaderboard(state)} limit={8} title={results ? `Рейтинг после раунда ${state.round}` : 'Рейтинг'} />
        </aside>
      </div>
    </section>
  )
}

export function RumorBanner({ news, state }) {
  return (
    <div className="rumor" role="status">
      <span className="rumor-icon" aria-hidden="true">
        !
      </span>
      <div>
        {news.map((n) => (
          <p key={n.id}>
            <strong>Слух{n.assetId !== 'NONE' && n.assetId !== 'ALL' ? ` · ${tickerOf(state, n.assetId)}` : ''}:</strong> {n.headline}
          </p>
        ))}
        <p className="small">Цены отреагируют при закрытии рынка.</p>
      </div>
    </div>
  )
}

export function AssetTile({ a, move }) {
  const round = a.price / a.open - 1
  const total = a.price / a.start - 1
  return (
    <article className={`tile asset-${a.id}`}>
      <header className="tile-top">
        <span className="tag">{a.ticker}</span>
        <span className="asset-name">{a.name}</span>
      </header>
      <p className="tile-price num">{money(a.price)}</p>
      <p className="tile-changes">
        <span className={tone(round)}>{pct(round)} за раунд</span>
        <span className={tone(total)}>{pct(total)} с начала</span>
      </p>
      <Chart points={a.history} base={a.start} />
      {move && Math.abs(move.newsPct) > 0.0005 && (
        <p className="move-split">
          <span>Новости {pct(move.newsPct)}</span>
          <span>Случайное движение {pct(move.noisePct)}</span>
        </p>
      )}
    </article>
  )
}

function RateTile({ rate }) {
  const ch = rate.value - rate.open
  const total = rate.value - rate.start
  return (
    <article className="tile asset-RATE">
      <header className="tile-top">
        <span className="tag">СТАВКА</span>
        <span className="asset-name">Ключевая ставка</span>
      </header>
      <p className="tile-price num">{rateFmt(rate.value)}</p>
      <p className="tile-changes">
        <span className={tone(-ch)}>{pp(ch)} за раунд</span>
        <span className={tone(-total)}>{pp(total)} с начала</span>
      </p>
      <Chart points={rate.history} base={rate.start} />
    </article>
  )
}

export function NewsTape({ state, limit = 6 }) {
  const items = [...state.news].filter((n) => n.status === 'fired').reverse().slice(0, limit)
  return (
    <section className="panel news">
      <h3>Лента новостей</h3>
      {items.length === 0 ? (
        <p className="muted">Пока без новостей.</p>
      ) : (
        <ul>
          {items.map((n) => (
            <li key={n.id}>
              <span className={`tag asset-${n.assetId}`}>{tickerOf(state, n.assetId)}</span>
              <span className="headline">{n.headline}</span>
              <span className="when">Раунд {n.round}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Standings({ rows, limit, title = 'Рейтинг', meId }) {
  const shown = limit ? rows.slice(0, limit) : rows
  return (
    <section className="panel standings">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">Пока нет игроков.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Игрок</th>
              <th scope="col" className="r">
                Портфель
              </th>
              <th scope="col" className="r">
                Хеджи
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} className={r.id === meId ? 'me' : ''}>
                <td className="rank">{i + 1}</td>
                <td className="who">
                  <Avatar id={r.avatar} size={26} />
                  <span>{r.name}</span>
                </td>
                <td className="r num">
                  {money0(r.value)} <span className={`small ${tone(r.ret)}`}>{pct(r.ret)}</span>
                </td>
                <td className={`r num ${tone(r.hedge)}`}>{signedMoney0(r.hedge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {limit && rows.length > limit && <p className="muted small">и ещё {rows.length - limit}</p>}
    </section>
  )
}

function Final({ state }) {
  const rows = leaderboard(state)
  const podium = rows.slice(0, 3)
  const best = [...rows].sort((a, b) => b.hedge - a.hedge)[0]
  const order = [1, 0, 2].filter((i) => podium[i])
  return (
    <section className="final">
      <h2 className="final-title">Итоговый рейтинг</h2>
      <ol className="podium">
        {order.map((i) => {
          const r = podium[i]
          return (
            <li key={r.id} className={`step step-${i + 1}`}>
              <Avatar id={r.avatar} size={i === 0 ? 110 : 84} />
              <span className="place">{i + 1}</span>
              <span className="podium-name">{r.name}</span>
              <span className="podium-value num">{money0(r.value)}</span>
              <span className={`small ${tone(r.ret)}`}>{pct(r.ret)}</span>
            </li>
          )
        })}
      </ol>
      {best && best.hedge > 0 && (
        <p className="best-hedger">
          Лучший хеджер: <strong>{best.name}</strong>, деривативы принесли <strong className="up">{signedMoney(best.hedge)}</strong>.
        </p>
      )}
      <Standings rows={rows} title="Все игроки" />
    </section>
  )
}
