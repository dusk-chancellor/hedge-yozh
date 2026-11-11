import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Without Supabase keys the app runs in demo mode: tabs in the same browser talk
// through BroadcastChannel, which is handy for trying the game alone.
export const DEMO = !SUPABASE_URL || !SUPABASE_KEY

let client = null
const getClient = () => (client ??= createClient(SUPABASE_URL, SUPABASE_KEY))

// Two topics per room keep traffic low: the host broadcasts state on "room",
// students send trades to "inbox", which only the host listens to.
const roomTopic = (code) => `hedgepit-${code}-room`
const inboxTopic = (code) => `hedgepit-${code}-inbox`

const statusOf = (s) =>
  s === 'SUBSCRIBED' ? 'live' : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' ? 'error' : s === 'CLOSED' ? 'closed' : 'connecting'

export function connectRoom(code, { host, onMessage, onStatus }) {
  if (DEMO) return demoTransport(code, host, onMessage, onStatus)
  const sb = getClient()
  const channels = []

  const listen = (topic, events) => {
    const ch = sb.channel(topic, { config: { broadcast: { self: false } } })
    for (const ev of events) ch.on('broadcast', { event: ev }, ({ payload }) => onMessage(ev, payload))
    ch.subscribe((s) => onStatus?.(statusOf(s)))
    channels.push(ch)
    return ch
  }

  let room = null
  if (host) {
    room = sb.channel(roomTopic(code), { config: { broadcast: { self: false } } })
    room.subscribe()
    channels.push(room)
    listen(inboxTopic(code), ['join', 'action', 'hello'])
  } else {
    listen(roomTopic(code), ['state'])
  }

  return {
    broadcast(event, payload) {
      room?.send({ type: 'broadcast', event, payload })
    },
    // Students post over HTTP so they never have to subscribe to (and pay for) each other's trades
    async toHost(event, payload) {
      try {
        const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }
        if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`
        const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: [{ topic: inboxTopic(code), event, payload, private: false }] }),
        })
        return res.ok
      } catch {
        return false
      }
    },
    close() {
      for (const ch of channels) sb.removeChannel(ch)
    },
  }
}

function demoTransport(code, host, onMessage, onStatus) {
  const room = new BroadcastChannel(roomTopic(code))
  const inbox = new BroadcastChannel(inboxTopic(code))
  const handler = (e) => onMessage(e.data.event, e.data.payload)
  if (host) inbox.onmessage = handler
  else room.onmessage = handler
  const t = setTimeout(() => onStatus?.('live'), 30)
  return {
    broadcast: (event, payload) => room.postMessage({ event, payload }),
    toHost: async (event, payload) => {
      inbox.postMessage({ event, payload })
      return true
    },
    close() {
      clearTimeout(t)
      room.close()
      inbox.close()
    },
  }
}
