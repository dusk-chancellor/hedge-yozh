# Хедж ёж

Russian-language classroom trading game about hedging. The name is set in one place if you ever change it: `APP_NAME` in `src/components/ui.jsx` (plus `<title>` in `index.html`).

## What's new in version 2

- Whole interface in Russian, numbers as `5 000,00 $`.
- Host laptop is a full-screen control center: one big next-step button, a round stepper, and tabs for News, Players and Settings, plus a live market summary. The TV runs *Открыть экран для проектора*.
- News types: **Шок** (now), **Слух** (headline now, move at the close), **Сюрприз** (secret until the close).
- Optional round timer (60–180 s) with auto-close and +30 s.
- Interest rate swaps: a key rate on the board, a $3,000 floating-rate loan per player (key rate + 2 pp, charged every round), pay-fixed / receive-fixed swaps. Set the loan to 0 to turn this off.
- Futures can be closed early; forwards can't.
- 24 original avatars (animals in hats and costumes), picked in the lobby, unique per room.
- Clearer student screens: Buy / Sell blocks with quick quantity chips, "?" tips, contract cards with a coverage bar, red flash + shake on errors, amber rumour banner, locked buttons during a margin call.

A live, Kahoot-style trading game for teaching hedging. The lecturer hosts a room on the projector,
students join from their phones with a room code, buy assets, and protect them with forwards,
futures and options while the host fires news events that move the market.

## How a game runs

1. **Lobby.** Host clicks *Host a new game*. The board shows a room code and QR code. Students join
   as a *market player* (default) or *spectator*. The host can change rounds, starting cash,
   volatility, futures margin and the longest contract length.
2. **Trading round.** Students buy and sell assets (TECH, OIL, GOLD, WHEAT) and open hedges on the
   hedge desk. Each hedge shows a payoff table: contract, holding, and the two together at ±10/20%.
3. **News.** From the news desk the host picks a preset or writes a headline, chooses the asset
   (or the whole market) and the price impact, and either
   - publishes it **now** (prices jump immediately), or
   - schedules it for **the market close**, kept secret or announced in advance so students can hedge.
4. **Close.** *Close trading and move the market* applies a small random move plus scheduled news,
   settles contracts that expire, and shows each student how much their hedges contributed
   ("without them you'd be at…").
5. Repeat for the set number of rounds, then *Show final standings* (podium plus best hedge result).

### Instruments

| Instrument | Cost today | Settlement |
|---|---|---|
| Forward | Nothing | Once, at maturity: (price at expiry − locked price) × units, sign by side |
| Futures | Initial margin (10% default), lots of 10 units | Marked to market every round into cash. Losses can push cash negative (margin call blocks new buying until fixed) |
| Put / call | Premium (Black–Scholes, zero rates, per-round volatility) | Cash-settled at maturity, long only |

Contracts last 1–3 rounds (configurable). Forward + futures exposure is capped at 2× portfolio value
so students can't speculate without limit. Leaderboard ranks by total portfolio value, and also shows
each trader's total derivatives P&L.

A teaching note: option premiums are priced from each asset's random volatility only, so the news
shocks make options cheap relative to the real risk. That's deliberate; it gives you a natural
discussion about implied volatility and jump risk.

## Deploy (about 10 minutes, all free)

### 1. Create a Supabase project (the real-time connection)

1. Sign up at <https://supabase.com> and create a new project (free plan, any region near you).
2. Open **Project Settings → API** (or the **Connect** button) and copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon / publishable key**
3. No tables or SQL are needed. In **Realtime → Settings**, make sure public access is allowed
   (it is by default).

Free Supabase projects pause after a week without use. Open the dashboard before class and restore
it if it says *paused*.

### 2. Deploy to Vercel

**With GitHub:** push this folder to a GitHub repository, then in Vercel choose
*Add New → Project*, import the repo (Vercel detects Vite automatically), and under
*Environment Variables* add:

```
VITE_SUPABASE_URL      = your Project URL
VITE_SUPABASE_ANON_KEY = your anon / publishable key
```

Click **Deploy**. If you add or change the variables later, redeploy so they take effect.

**With the CLI instead:**

```bash
npm i -g vercel
vercel                                   # first deploy, accept the defaults
vercel env add VITE_SUPABASE_URL         # paste the URL, select all environments
vercel env add VITE_SUPABASE_ANON_KEY    # paste the key
vercel --prod
```

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the two values, or leave empty for demo mode
npm run dev
npm test                     # checks the game engine (hedging math, settlement)
```

Without the Supabase variables the app runs in **demo mode**: only tabs in the same browser can join.
That's useful for trying it alone: open the host in one tab and join as students in others.

## In class

- Keep the host tab open on your laptop for the whole game. The host's browser runs the game, so if
  it closes, the game pauses. Refreshing is safe: the game is saved in the browser, and the join page
  offers *Resume room XXXXX*.
- *Open projector view* opens a clean board without controls, for a second screen. Or click
  *Hide controls* on the host screen.
- Students who close their tab can reopen the link and tap *Rejoin as …*.
- Built and tested for up to ~25 players; well within Supabase's free limits.

## Customising

- Assets, starting prices and volatilities: `ASSET_DEFS` in `src/lib/game.js`
- Default settings, strikes, news presets: same file
- Colours and type: `src/styles.css` (asset colours are the `--tech`, `--oil`, `--gold`, `--wheat` variables)

## Project structure

```
src/lib/game.js        game rules: trading, hedging, settlement, leaderboard (pure functions)
src/lib/transport.js   Supabase Realtime (or BroadcastChannel in demo mode)
src/components/        HostApp, PlayerView, Board (projector), Join, ClientApp
scripts/test-game.mjs  engine tests: npm test
```
