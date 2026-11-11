import { useEffect, useRef, useState } from 'react'
import { Avatar } from './avatars.jsx'

export { Avatar }
export const APP_NAME = 'Хедж ёж'

export function Chart({ points, base, format }) {
  const W = 200
  const H = 56
  const raw = points.map((p) => p.p)
  const ps = raw.length === 1 ? [raw[0], raw[0]] : raw
  const min = Math.min(...ps, base)
  const max = Math.max(...ps, base)
  const span = max - min || 1
  const x = (i) => (i / (ps.length - 1)) * W
  const y = (v) => H - 4 - ((v - min) / span) * (H - 8)
  const line = ps.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={W} y1={y(base)} y2={y(base)} className="chart-base" />
      <path d={`${line} L${W},${H} L0,${H} Z`} className="chart-fill" />
      <path d={line} className="chart-line" />
    </svg>
  )
}

export function Seg({ options, value, onChange, label, size = '' }) {
  return (
    <div className={`seg ${size}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Quantity input with quick-step chips. steps: e.g. [-10, -5, 5, 10]; extra: [{label, value}]
export function QtyInput({ value, onChange, label = 'Количество', min = 1, steps = [-10, -5, 5, 10], extra = [], format }) {
  const set = (v) => onChange(Math.max(min, Math.min(1000000, Math.round(v))))
  return (
    <div className="qty-block">
      <div className="qty">
        <button type="button" aria-label="Уменьшить" onClick={() => set((value || 0) - 1)}>
          −
        </button>
        <input
          inputMode="numeric"
          aria-label={label}
          value={value ? (format ? format(value) : value) : ''}
          placeholder="0"
          onChange={(e) => {
            const v = parseInt(e.target.value.replace(/\D/g, ''), 10)
            onChange(Number.isFinite(v) ? Math.min(v, 1000000) : 0)
          }}
        />
        <button type="button" aria-label="Увеличить" onClick={() => set((value || 0) + 1)}>
          +
        </button>
      </div>
      <div className="chips">
        {steps.map((st) => (
          <button type="button" key={st} className="chip" onClick={() => set((value || 0) + st)}>
            {st > 0 ? `+${st}` : `−${Math.abs(st)}`}
          </button>
        ))}
        {extra.map((e) => (
          <button type="button" key={e.label} className="chip strong" disabled={e.disabled} onClick={() => set(e.value)}>
            {e.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// A small "?" button that reveals an explanation
export function InfoTip({ title, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <span className="infotip" ref={ref}>
      <button type="button" className="infotip-btn" aria-expanded={open} aria-label={`Что такое ${title}?`} onClick={() => setOpen((v) => !v)}>
        ?
      </button>
      {open && (
        <span className="infotip-pop" role="note">
          <strong>{title}</strong>
          {children}
        </span>
      )}
    </span>
  )
}

// Countdown to a host deadline. offset = local clock − host clock.
export function useRemaining(deadline, offset = 0) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [deadline])
  if (!deadline) return null
  return Math.max(0, Math.ceil((deadline - (now - offset)) / 1000))
}

export const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

export function Timer({ deadline, offset, className = '' }) {
  const left = useRemaining(deadline, offset)
  if (left === null) return null
  return (
    <span className={`timer ${left <= 10 ? 'urgent' : ''} ${className}`} role="timer" aria-label={`Осталось ${left} секунд`}>
      {mmss(left)}
    </span>
  )
}

// Bottom message plus a full-screen pulse: red with a shake for errors, green for success
export function Feedback({ msg }) {
  const [shown, setShown] = useState(null)
  useEffect(() => {
    if (!msg) return
    setShown(msg)
    if (!msg.ok) {
      document.body.classList.remove('shake')
      void document.body.offsetWidth
      document.body.classList.add('shake')
      try {
        navigator.vibrate?.(140)
      } catch {}
    }
    const t = setTimeout(() => setShown(null), msg.ok ? 3000 : 4200)
    return () => clearTimeout(t)
  }, [msg?.t])
  if (!shown) return null
  return (
    <>
      <div key={shown.t} className={`edge-flash ${shown.ok ? 'ok' : 'bad'}`} aria-hidden="true" />
      <div className={`toast ${shown.ok ? 'ok' : 'bad'}`} role={shown.ok ? 'status' : 'alert'}>
        {shown.text}
      </div>
    </>
  )
}

export function Who({ p, size = 32 }) {
  return (
    <span className="who-chip">
      <Avatar id={p.avatar} size={size} />
      <span className="who-name">{p.name}</span>
    </span>
  )
}
