import { useEffect, useState } from 'react'
import { tickerOf } from '../lib/game.js'

// Small market icons, drawn on a 24×24 grid in currentColor
const ICONS = {
  TECH: (
    <g>
      <path
        fillRule="evenodd"
        d="M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm2.5 3.5v5h5v-5h-5Z"
      />
      {[8.5, 12, 15.5].map((v) => (
        <g key={v}>
          <rect x={v - 0.9} y="2.5" width="1.8" height="3" rx="0.6" />
          <rect x={v - 0.9} y="18.5" width="1.8" height="3" rx="0.6" />
          <rect x="2.5" y={v - 0.9} width="3" height="1.8" rx="0.6" />
          <rect x="18.5" y={v - 0.9} width="3" height="1.8" rx="0.6" />
        </g>
      ))}
    </g>
  ),
  OIL: (
    <g>
      <path d="M12 2.2c-.3.4-6.8 8.2-6.8 12.9a6.8 6.8 0 0 0 13.6 0C18.8 10.4 12.3 2.6 12 2.2Z" />
      <path d="M9.2 14.6a3 3 0 0 0 2.6 3.4" fill="none" stroke="var(--icon-hi, rgba(255,255,255,.55))" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  ),
  GOLD: (
    <g>
      <path d="M2.5 19.5 6 9.5h12l3.5 10Z" />
      <path d="M7.5 5 9 1.5h6L16.5 5Z" opacity="0.75" />
      <path d="M7.8 11.5h4.4" stroke="var(--icon-hi, rgba(255,255,255,.55))" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  WHEAT: (
    <g>
      <path d="M12 22V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="12" cy="4.6" rx="1.9" ry="3" />
      {[8.8, 12.6, 16.4].map((y) => (
        <g key={y}>
          <ellipse cx="9.3" cy={y} rx="1.8" ry="3" transform={`rotate(-35 9.3 ${y})`} />
          <ellipse cx="14.7" cy={y} rx="1.8" ry="3" transform={`rotate(35 14.7 ${y})`} />
        </g>
      ))}
    </g>
  ),
  RATE: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M18.5 5.5 5.5 18.5" />
    </g>
  ),
  ALL: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9.2" />
      <ellipse cx="12" cy="12" rx="4" ry="9.2" />
      <path d="M3 12h18M4.6 7h14.8M4.6 17h14.8" />
    </g>
  ),
}

export function AssetIcon({ id, size = '1.05em', title }) {
  const key = id === 'NONE' ? 'RATE' : id
  if (!ICONS[key]) return null
  return (
    <svg className="aicon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} aria-label={title}>
      {ICONS[key]}
    </svg>
  )
}

// Coloured ticker label with its icon
export function Tag({ id, state, label }) {
  const text = label || tickerOf(state, id)
  const cls = id === 'NONE' ? 'RATE' : id
  return (
    <span className={`tag asset-${cls}`}>
      <AssetIcon id={id} />
      {text}
    </span>
  )
}

// Icons for everything a news item moves: the asset (or whole market) and the key rate
export function NewsIcons({ n }) {
  const ids = []
  if (n.assetId && n.assetId !== 'NONE') ids.push(n.assetId)
  if (n.assetId === 'NONE' || n.rate || n.movesRate) ids.push('RATE')
  return (
    <span className="news-icons">
      {ids.map((id) => (
        <span key={id} className={`news-icon asset-${id}`}>
          <AssetIcon id={id} />
        </span>
      ))}
    </span>
  )
}

const LABEL = { rumor: 'СЛУХ', shock: 'ШОК' }

// The events that matter right now: rumours waiting for the close, and this round's shocks
export function activeEvents(state) {
  return state.news.filter(
    (n) => (n.type === 'rumor' && n.status !== 'fired') || (n.type === 'shock' && n.round === state.round && state.phase !== 'finished'),
  )
}

// One strip per event. On phones each strip is one line; tap to read the whole headline.
export function EventStrips({ state, big = false }) {
  const [open, setOpen] = useState(null)
  const events = activeEvents(state)
  if (!events.length) return null
  return (
    <ul className={`events ${big ? 'events-big' : ''}`} aria-label="Важные новости">
      {[...events].reverse().map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className={`ev ev-${n.type} ${open === n.id || big ? 'ev-open' : ''}`}
            aria-expanded={open === n.id}
            onClick={() => setOpen(open === n.id ? null : n.id)}
          >
            <NewsIcons n={n} />
            <span className="ev-text">
              <strong>{LABEL[n.type]}:</strong> {n.headline}
            </span>
            {n.type === 'rumor' && <span className="ev-note">при закрытии</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

// Full-screen takeover for a shock: blocks the screen for a few seconds so everyone looks up
export function ShockOverlay({ flash, offset = 0, ms = 3500 }) {
  const [shown, setShown] = useState(null)
  useEffect(() => {
    if (!flash || flash.kind !== 'shock') return
    const age = Date.now() - offset - flash.t
    if (age > 6000) return // don't replay old shocks after a reconnect
    setShown(flash)
    try {
      navigator.vibrate?.([200, 80, 200])
    } catch {}
    const t = setTimeout(() => setShown(null), Math.max(1500, ms - Math.max(0, age)))
    return () => clearTimeout(t)
  }, [flash?.id])
  if (!shown) return null
  return (
    <div className="shock" role="alertdialog" aria-modal="true" aria-label="Шок на рынке">
      <div className="shock-inner">
        <div className="shock-icons">
          <NewsIcons n={shown} />
        </div>
        <p className="shock-label">ШОК</p>
        <p className="shock-headline">{shown.headlines[0]}</p>
        <span className="shock-bar" style={{ animationDuration: `${ms}ms` }} />
      </div>
    </div>
  )
}
