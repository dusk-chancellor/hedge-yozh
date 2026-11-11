// Russian number formatting with dollars: 5 000,00 $
const usd = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usd0 = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const int = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

const clean = (x) => (Math.abs(x) < 0.005 ? 0 : x)
const minus = (s) => s.replace('-', '−')
export const money = (x) => minus(usd.format(clean(x)))
export const money0 = (x) => minus(usd0.format(clean(x)))
export const num = (x) => int.format(x)
const sign = (x) => (x > 0 ? '+' : x < 0 ? '−' : '')
export const signedMoney = (x) => sign(clean(x)) + usd.format(Math.abs(clean(x)))
export const signedMoney0 = (x) => sign(Math.round(x)) + usd0.format(Math.abs(Math.round(x)))
export const pct = (x, d = 1) => {
  const v = Math.abs(x * 100) < 0.5 * 10 ** -d ? 0 : x
  return sign(v) + Math.abs(v * 100).toFixed(d).replace('.', ',') + '%'
}
// interest rates: 0.0825 → "8,25%"
export const rateFmt = (r) => (r * 100).toFixed(2).replace('.', ',') + '%'
// rate changes in percentage points: 0.01 → "+1,00 п.п."
export const pp = (x) => {
  const v = Math.abs(x) < 0.00005 ? 0 : x
  return sign(v) + Math.abs(v * 100).toFixed(2).replace('.', ',') + ' п.п.'
}
export const tone = (x) => (x > 0.00005 ? 'up' : x < -0.00005 ? 'down' : 'flat')

// "1 раунд", "2 раунда", "5 раундов"
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b === 1) return one
  if (b >= 2 && b <= 4) return few
  return many
}
export const rounds = (n) => `${n} ${plural(n, 'раунд', 'раунда', 'раундов')}`
