import { useEffect, useRef, useState } from 'react'
import { connectRoom } from '../lib/transport.js'
import Board from './Board.jsx'
import PlayerView from './PlayerView.jsx'
import { Feedback } from './ui.jsx'

// Students, spectators and the projector view all receive state from the host.
export default function ClientApp({ session, onLeave }) {
  const { code, id } = session
  const isBoard = session.role === 'board'
  const [state, setState] = useState(null)
  const [status, setStatus] = useState('connecting')
  const [slow, setSlow] = useState(false)
  const [localMsg, setLocalMsg] = useState(null)
  const transport = useRef(null)

  useEffect(() => {
    const t = connectRoom(code, {
      host: false,
      onStatus: setStatus,
      onMessage: (event, payload) => {
        if (event === 'state' && payload?.code === code) setState({ ...payload, _offset: Date.now() - (payload.sentAt || Date.now()) })
      },
    })
    transport.current = t
    const s = setTimeout(() => setSlow(true), 7000)
    return () => {
      clearTimeout(s)
      t.close()
    }
  }, [code])

  const me = state?.players?.[id]
  const kicked = !!state?.kicked?.includes(id)
  const joined = isBoard ? !!state : !!me

  useEffect(() => {
    if (status !== 'live' || joined || kicked) return
    const hello = () =>
      isBoard ? transport.current?.toHost('hello', {}) : transport.current?.toHost('join', { id, name: session.name, role: session.role })
    hello()
    const iv = setInterval(hello, 3000)
    return () => clearInterval(iv)
  }, [status, joined, kicked])

  const send = async (action) => {
    const ok = await transport.current?.toHost('action', { id, action })
    if (!ok) setLocalMsg({ ok: false, text: 'Нет связи с ведущим. Проверьте интернет и попробуйте ещё раз.', t: Date.now() })
  }

  if (kicked)
    return (
      <div className="centered">
        <h2>Ведущий удалил вас из игры.</h2>
        <button type="button" className="btn primary" onClick={onLeave}>
          На главную
        </button>
      </div>
    )

  if (!joined)
    return (
      <div className="centered">
        <h2>{state ? 'Входим…' : `Подключаемся к комнате ${code}…`}</h2>
        {slow && !state && <p className="muted">В комнате {code} пока нет игры. Проверьте код или дождитесь, пока ведущий откроет комнату.</p>}
        {status === 'error' && <p className="down">Не удалось подключиться. Обновите страницу.</p>}
        <button type="button" className="btn ghost" onClick={onLeave}>
          Ввести другой код
        </button>
      </div>
    )

  if (isBoard || me.role === 'spectator')
    return (
      <div className="spectator">
        <Board state={state} />
        {!isBoard && (
          <footer className="spectator-bar">
            <span>Вы смотрите как {me.name}</span>
            {state.phase === 'lobby' && (
              <button type="button" className="btn ghost" onClick={() => send({ type: 'setRole', role: 'player' })}>
                Стать игроком
              </button>
            )}
            <Feedback msg={me.msg} />
          </footer>
        )}
      </div>
    )

  return (
    <>
      <PlayerView state={state} me={me} send={send} />
      <Feedback msg={localMsg && (!me.msg || localMsg.t > me.msg.t) ? localMsg : me.msg} />
    </>
  )
}
