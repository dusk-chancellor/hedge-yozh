import * as G from '../src/lib/game.js'
import assert from 'node:assert/strict'

let seed = 42
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`)
const ok = (s, id) => assert.ok(s.players[id].msg.ok, s.players[id].msg.text)

let s = G.createGame('ABCDE')
for (const [id, name] of [['a', 'Анна'], ['b', 'Борис'], ['c', 'Сеня'], ['d', 'Даша'], ['e', 'Анна']]) s = G.joinPlayer(s, { id, name, role: 'player' })
assert.equal(s.players.e.name, 'Анна 2')
assert.equal(new Set(Object.values(s.players).map((p) => p.avatar)).size, 5, 'unique avatars')
let t = G.applyAction(s, 'b', { type: 'setAvatar', avatar: s.players.a.avatar }); assert.equal(t.players.b.msg.ok, false)
assert.equal(s.players.a.cash, 8000); near(G.portfolioValue(s, s.players.a), 5000, 0.001, 'loan is a liability')

s = G.startGame(s)
for (const id of 'abc') { s = G.applyAction(s, id, { type: 'buy', assetId: 'OIL', qty: 30 }); ok(s, id) }
s = G.applyAction(s, 'a', { type: 'forward', assetId: 'OIL', side: 'short', qty: 30, maturity: 2 }); ok(s, 'a')
s = G.applyAction(s, 'b', { type: 'put', assetId: 'OIL', qty: 30, strikePct: 0.95, maturity: 1 }); ok(s, 'b')
// d: full swap hedge of the loan, plus futures it will close early
s = G.applyAction(s, 'd', { type: 'swap', side: 'payfixed', qty: 3000, maturity: 6 }); ok(s, 'd')
s = G.applyAction(s, 'd', { type: 'buy', assetId: 'TECH', qty: 20 }); ok(s, 'd')
s = G.applyAction(s, 'd', { type: 'future', assetId: 'TECH', side: 'short', qty: 2, maturity: 3 }); ok(s, 'd')
console.log(s.players.d.msg.text)

s = G.addNews(s, { headline: 'ЦБ повышает', assetId: 'NONE', impact: 0, rate: 0.02, type: 'rumor' })
assert.equal(G.publicState(s).news[0].rate, null, 'rumor size hidden')
s = G.addNews(s, { headline: 'Нефть падает', assetId: 'OIL', impact: -0.3, type: 'surprise' })
assert.equal(G.publicState(s).news.length, 1, 'surprise hidden')
s = G.resolveRound(s, rng)
assert.equal(s.flash.kind, 'surprise', 'surprise revealed at close')
assert.equal(s.flash.items[0].impact, -0.3)
assert.ok(G.publicState(s).news.every((n) => n.status === 'fired'), 'all news public after close')
const v = (id) => G.portfolioValue(s, s.players[id])
const interest = (r) => (3000 * (r + 0.02)) / 4
console.log('rate', s.rate.value, 'OIL', G.getAsset(s, 'OIL').price)
near(s.players.a.last.hedge, -30 * (G.getAsset(s, 'OIL').price - 80), 0.05, 'forward offsets spot')
near(s.players.a.last.after, 5000 - interest(s.rate.value), 0.05, 'hedged player loses only interest')
// swap: d pays fixed 8%+2% effectively
near(s.players.d.interestPaid - G.openContracts(s.players.d).find((c) => c.type === 'swap').pnl, (3000 * 0.1) / 4, 0.02, 'swap fixes loan cost')

s = G.nextRound(s)
const fut = G.openContracts(s.players.d).find((c) => c.type === 'future')
s = G.applyAction(s, 'd', { type: 'closeFuture', contractId: fut.id }); ok(s, 'd')
assert.equal(G.openContracts(s.players.d).filter((c) => c.type === 'future').length, 0)
s = G.resolveRound(s, rng)
for (let r = 3; r <= 6; r++) { s = G.nextRound(s); s = G.resolveRound(s, rng) }
s = G.finishGame(s)
for (const p of Object.values(s.players)) assert.equal(G.openContracts(p).length, 0, 'all settled')
console.log(G.leaderboard(s).map((r) => `${r.name} ${r.value.toFixed(2)} hedge ${r.hedge.toFixed(2)}`))
// timer
let g = G.updateSettings(G.createGame('X'), { timer: 90 }); g = G.startGame(g); assert.ok(g.deadline > Date.now() + 89000)
console.log('ALL TESTS PASSED')
