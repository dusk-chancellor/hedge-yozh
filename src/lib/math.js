export const round2 = (x) => Math.round(x * 100) / 100

function erf(x) {
  const sign = Math.sign(x)
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}

export const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2))

// Black–Scholes with zero interest rate. T is measured in rounds, sigma is volatility per round.
export function bsPrice(type, S, K, T, sigma) {
  if (T <= 0 || sigma <= 0) return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0)
  const v = sigma * Math.sqrt(T)
  const d1 = (Math.log(S / K) + 0.5 * v * v) / v
  const d2 = d1 - v
  return type === 'call' ? S * normCdf(d1) - K * normCdf(d2) : K * normCdf(-d2) - S * normCdf(-d1)
}

export function randn(rng = Math.random) {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
