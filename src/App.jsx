import { useState } from 'react'
import Join from './components/Join.jsx'
import HostApp from './components/HostApp.jsx'
import ClientApp from './components/ClientApp.jsx'
import { loadSession, newId, newRoomCode, saveIdentity, saveSession } from './lib/storage.js'

const params = new URLSearchParams(location.search)
const urlCode = (params.get('room') || '').toUpperCase()

function initialSession() {
  // The projector link (?room=CODE&board=1) is a read-only view and is never saved
  if (urlCode && params.get('board')) return { role: 'board', code: urlCode, id: 'board' }
  return loadSession()
}

export default function App() {
  const [session, setSession] = useState(initialSession)

  const start = (s) => {
    if (s.role !== 'board') saveSession(s)
    if (s.role === 'player' || s.role === 'spectator') saveIdentity(s.code, { id: s.id, name: s.name, role: s.role })
    history.replaceState(null, '', location.pathname)
    setSession(s)
  }
  const leave = () => {
    saveSession(null)
    history.replaceState(null, '', location.pathname)
    setSession(null)
  }

  if (!session)
    return (
      <Join
        initialCode={urlCode}
        onJoin={start}
        onHost={(resumeCode) => start({ role: 'host', code: resumeCode || newRoomCode(), id: newId() })}
      />
    )
  if (session.role === 'host') return <HostApp key={session.code} session={session} onLeave={leave} />
  return <ClientApp key={session.code + session.id} session={session} onLeave={leave} />
}
