// ── Scenario definitions ──
const scenarios = [
  {
    id: 'coin', name: 'Coin Flips', dist: 'Binomial', color: '#3b82f6',
    params: [
      { key: 'n', label: 'Coins per trial', min: 1, max: 60, def: 10, step: 1 },
      { key: 'p', label: 'P(heads)', min: 0.01, max: 0.99, def: 0.5, step: 0.01 },
    ],
    generate: p => { let h = 0; for (let i = 0; i < p.n; i++) if (Math.random() < p.p) h++; return h; },
    bins: p => p.n + 1,
    range: p => [0, p.n],
    theoryCurve: (x, p) => binomialPMF(x, p.n, p.p),
    theory: { title: 'Binomial Distribution', desc: 'Repeat a yes/no experiment n times. The count of successes follows a Binomial distribution — seen in coin flips, A/B tests, and polling.', formula: 'P(X=k) = C(n,k) · p^k · (1-p)^(n-k)' },
  },
  {
    id: 'wait', name: 'Café Wait', dist: 'Exponential', color: '#f59e0b',
    params: [{ key: 'lambda', label: 'Avg coffees/min (λ)', min: 0.1, max: 3, def: 0.5, step: 0.05 }],
    generate: p => -Math.log(1 - Math.random()) / p.lambda,
    bins: () => 35,
    range: p => [0, 10 / p.lambda],
    theoryCurve: (x, p) => x < 0 ? 0 : p.lambda * Math.exp(-p.lambda * x),
    theory: { title: 'Exponential Distribution', desc: "Models time between events — café waits, website clicks, component lifespans. It's memoryless: the chance of waiting another minute never changes.", formula: 'f(x) = λ · e^(-λx)' },
  },
  {
    id: 'height', name: 'Human Heights', dist: 'Normal', color: '#22c55e',
    params: [
      { key: 'mu', label: 'Mean (cm)', min: 140, max: 200, def: 170, step: 1 },
      { key: 'sigma', label: 'Std dev (cm)', min: 2, max: 20, def: 7, step: 0.5 },
    ],
    generate: p => boxMuller(p.mu, p.sigma),
    bins: () => 35,
    range: p => [p.mu - 4 * p.sigma, p.mu + 4 * p.sigma],
    theoryCurve: (x, p) => normalPDF(x, p.mu, p.sigma),
    theory: { title: 'Normal Distribution', desc: 'The bell curve. Heights, test scores, measurement errors — the Central Limit Theorem guarantees that averages converge here.', formula: 'f(x) = (1/σ√2π) · e^(-(x-μ)²/2σ²)' },
  },
  {
    id: 'defects', name: 'Factory Defects', dist: 'Poisson', color: '#ef4444',
    params: [{ key: 'lambda', label: 'Avg defects (λ)', min: 0.5, max: 25, def: 4, step: 0.5 }],
    generate: p => { let L = Math.exp(-p.lambda), k = 0, pr = 1; do { k++; pr *= Math.random(); } while (pr > L); return k - 1; },
    bins: p => Math.min(Math.ceil(p.lambda * 3) + 5, 35),
    range: p => [0, Math.ceil(p.lambda * 3) + 4],
    theoryCurve: (x, p) => poissonPMF(Math.round(x), p.lambda),
    theory: { title: 'Poisson Distribution', desc: 'Counts of rare independent events: typos per page, server errors per hour, defects per batch.', formula: 'P(X=k) = (λ^k · e^(-λ)) / k!' },
  },
  {
    id: 'dice', name: 'Dice Sum', dist: 'Central Limit', color: '#8b5cf6',
    params: [
      { key: 'n', label: 'Number of dice', min: 1, max: 20, def: 5, step: 1 },
      { key: 'sides', label: 'Sides', min: 4, max: 20, def: 6, step: 1 },
    ],
    generate: p => { let s = 0; for (let i = 0; i < p.n; i++) s += Math.floor(Math.random() * p.sides) + 1; return s; },
    bins: p => Math.min(p.n * p.sides - p.n + 1, 45),
    range: p => [p.n, p.n * p.sides],
    theoryCurve: (x, p) => {
      const mu = p.n * (p.sides + 1) / 2;
      const sig = Math.sqrt(p.n * (p.sides ** 2 - 1) / 12);
      return normalPDF(x, mu, sig);
    },
    theory: { title: 'Central Limit Theorem', desc: 'Sum enough independent random variables and the result becomes normal — regardless of original shape. Add more dice to watch it emerge.', formula: 'Sum ≈ Normal(n·(s+1)/2, n·(s²-1)/12)' },
  },
];
