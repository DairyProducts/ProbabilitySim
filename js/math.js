// ── Math helpers ──
function lnGamma(z) {
  if (z <= 0) return 0;
  const coeff = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of coeff) ser += c / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / z);
}

function binomialPMF(k, n, p) {
  if (k < 0 || k > n) return 0;
  return Math.exp(lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function poissonPMF(k, lam) {
  if (k < 0) return 0;
  return Math.exp(k * Math.log(lam) - lam - lnGamma(k + 1));
}

function normalPDF(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.3302744))));
  return x > 0 ? 1 - p : p;
}

function diceSumProb(total, n, sides) {
  let prob = 0;
  const k = total - n;
  for (let j = 0; j <= Math.floor(k / sides); j++) {
    const sign = j % 2 === 0 ? 1 : -1;
    prob += sign * Math.exp(
      lnGamma(n + 1) - lnGamma(j + 1) - lnGamma(n - j + 1) +
      lnGamma(k - j * sides + n) - lnGamma(k - j * sides + 1) - lnGamma(n)
    );
  }
  return Math.max(0, prob / Math.pow(sides, n));
}

function formatProb(p) {
  if (p >= 0.01) return (p * 100).toFixed(2) + '%';
  if (p >= 0.0001) return (p * 100).toFixed(4) + '%';
  return p.toExponential(2);
}

function boxMuller(mu, sigma) {
  return mu + sigma * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
