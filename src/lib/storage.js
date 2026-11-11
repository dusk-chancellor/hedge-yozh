const safe = (fn, fallback = null) => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

// The session lives in sessionStorage so each browser tab can be a different person
export const loadSession = () => safe(() => JSON.parse(sessionStorage.getItem('hp-session')))
export const saveSession = (s) =>
  safe(() => (s ? sessionStorage.setItem('hp-session', JSON.stringify(s)) : sessionStorage.removeItem('hp-session')))

// The host's game survives a refresh or an accidental tab close
export const loadGame = (code) => safe(() => JSON.parse(localStorage.getItem(`hp-game-${code}`)))
export const saveGame = (g) => safe(() => localStorage.setItem(`hp-game-${g.code}`, JSON.stringify(g)))
export const clearGame = (code) => safe(() => localStorage.removeItem(`hp-game-${code}`))
export const loadLastHost = () => safe(() => localStorage.getItem('hp-last-host'))
export const saveLastHost = (code) =>
  safe(() => (code ? localStorage.setItem('hp-last-host', code) : localStorage.removeItem('hp-last-host')))

// Lets a student who closed the tab rejoin as the same trader
export const loadIdentity = (code) => safe(() => JSON.parse(localStorage.getItem(`hp-id-${code}`)))
export const saveIdentity = (code, v) => safe(() => localStorage.setItem(`hp-id-${code}`, JSON.stringify(v)))

export const newId = () =>
  safe(() => crypto.randomUUID(), null) || Math.random().toString(36).slice(2) + Date.now().toString(36)

export function newRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 5; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)]
  return c
}
