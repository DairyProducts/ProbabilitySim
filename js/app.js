// ── State ──
let current = scenarios[0];
let params = {};
let histogram = [], samples = [], totalSamples = 0;
let running = false, animFrame = null;
let chartCanvas, chartCtx;
let activeTab = 'distribution';
let visCanvas, visCtx, visAnimating = false, autoMode = false, autoTimer = null;
let visualRunId = 0, visualFrameId = null;
const visualTimeouts = new Set();

// ── Slider template helper ──
function createSliderElement(p, onChange) {
  const fragment = templateLoader.cloneTemplate('slider');
  const root = fragment.querySelector('.cg');
  const label = root.querySelector('label');
  const input = root.querySelector('input[type="range"]');
  const value = root.querySelector('.vd');

  label.textContent = p.label;
  input.min = p.min;
  input.max = p.max;
  input.step = p.step;
  input.value = params[p.key];
  input.setAttribute('oninput', `${onChange}('${p.key}',this.value);this.nextElementSibling.textContent=this.value`);
  value.textContent = params[p.key];

  return root;
}

// ── Init & navigation ──
function init() {
  $('sidebar').innerHTML = scenarios.map(s =>
    `<button class="scenario-btn" data-id="${s.id}" onclick="selectScenario('${s.id}')">${s.name}</button>`
  ).join('');
  selectScenario('coin');
}

function selectScenario(id) {
  stopDistribution();
  stopAuto();
  cancelVisualAnimation();
  current = scenarios.find(s => s.id === id);
  params = {};
  current.params.forEach(p => params[p.key] = p.def);
  resetHistogram();
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  renderMain();
}

function switchTab(tab) {
  stopDistribution();
  stopAuto();
  cancelVisualAnimation();
  activeTab = tab;
  renderMain();
}

function resetHistogram() {
  histogram = new Array(current.bins(params)).fill(0);
  samples = [];
  totalSamples = 0;
}

// ── Main render ──
function renderMain() {
  const s = current;
  const mainFragment = templateLoader.cloneTemplate('main');

  const distButton = mainFragment.querySelector('#tab-distribution-btn');
  const visualButton = mainFragment.querySelector('#tab-visual-btn');
  const distTab = mainFragment.querySelector('#tab-dist');
  const visualTab = mainFragment.querySelector('#tab-vis');
  distButton.classList.toggle('active', activeTab === 'distribution');
  visualButton.classList.toggle('active', activeTab === 'visual');
  distTab.classList.toggle('active', activeTab === 'distribution');
  visualTab.classList.toggle('active', activeTab === 'visual');

  mainFragment.querySelector('#scenario-name').textContent = s.name;
  mainFragment.querySelector('#scenario-dist').textContent = s.dist;
  mainFragment.querySelector('#theory-title').textContent = s.theory.title;
  mainFragment.querySelector('#theory-desc').textContent = s.theory.desc;
  mainFragment.querySelector('#theory-formula').textContent = s.theory.formula;

  const distParamHost = mainFragment.querySelector('#dist-param-controls');
  const visParamHost = mainFragment.querySelector('#vis-param-controls');
  s.params.forEach(p => distParamHost.appendChild(createSliderElement(p, 'updateParam')));
  s.params.forEach(p => visParamHost.appendChild(createSliderElement(p, 'updateVisParam')));

  $('main').replaceChildren(mainFragment);

  if (activeTab === 'distribution') {
    chartCanvas = $('chart');
    chartCtx = chartCanvas.getContext('2d');
    chartCanvas.width = chartCanvas.offsetWidth * 2;
    chartCanvas.height = 480;
    drawChart();
  } else {
    setupVisualCanvas();
  }
}

// ── Distribution tab ──
function updateParam(key, val) {
  params[key] = parseFloat(val);
  stopDistribution();
  resetHistogram();
  drawChart();
}

function updateVisParam(key, val) {
  params[key] = parseFloat(val);
}

function resetAll() {
  stopDistribution();
  resetHistogram();
  drawChart();
  ['s-mean', 's-std', 's-med'].forEach(id => $(id).textContent = '—');
  $('s-n').textContent = '0';
  $('sc').textContent = '0';
}

function toggleDistribution() { running ? stopDistribution() : startDistribution(); }

function startDistribution() {
  running = true;
  $('run-btn').textContent = '⏸ Pause';
  $('run-btn').classList.add('on');
  distributionLoop();
}

function stopDistribution() {
  running = false;
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  const btn = $('run-btn');
  if (btn) { btn.textContent = '▶ Run'; btn.classList.remove('on'); }
}

function distributionLoop() {
  if (!running) return;
  const speed = parseInt($('spd')?.value || 10);
  const [lo, hi] = current.range(params);
  const numBins = histogram.length;
  const binWidth = (hi - lo) / numBins;

  for (let i = 0; i < speed; i++) {
    const val = current.generate(params);
    samples.push(val);
    totalSamples++;
    const bin = Math.max(0, Math.min(numBins - 1, Math.floor((val - lo) / binWidth)));
    histogram[bin]++;
  }

  drawChart();
  updateStats();
  animFrame = requestAnimationFrame(distributionLoop);
}

function drawChart() {
  if (!chartCtx) return;
  const ctx = chartCtx, w = chartCanvas.width, h = chartCanvas.height;
  const pad = { t: 12, r: 12, b: 36, l: 36 };
  const [lo, hi] = current.range(params);
  const numBins = histogram.length;
  const maxCount = Math.max(...histogram, 1);
  const barW = (w - pad.l - pad.r) / numBins;
  const chartH = h - pad.t - pad.b;

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + chartH * (1 - i / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
  }

  // Bars
  for (let i = 0; i < numBins; i++) {
    const barH = (histogram[i] / maxCount) * chartH;
    if (barH < 0.5) continue;
    const x = pad.l + i * barW, y = pad.t + chartH - barH;
    const gap = Math.max(1, barW * 0.06);
    ctx.fillStyle = current.color + 'bb';
    ctx.beginPath();
    roundedRect(ctx, x + gap, y, barW - gap * 2, barH, Math.min(3, barW / 4));
    ctx.fill();
  }

  // Theory curve overlay
  if (totalSamples > 20) {
    const binW = (hi - lo) / numBins;
    ctx.strokeStyle = current.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    let first = true;
    for (let px = pad.l; px <= w - pad.r; px += 2) {
      const xVal = lo + ((px - pad.l) / (w - pad.l - pad.r)) * (hi - lo);
      const expected = current.theoryCurve(xVal, params) * totalSamples * binW;
      const y = pad.t + chartH - (expected / maxCount) * chartH;
      first ? (ctx.moveTo(px, y), first = false) : ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // X-axis labels
  ctx.fillStyle = '#bbb';
  ctx.font = '17px "IBM Plex Mono"';
  ctx.textAlign = 'center';
  const binW = (hi - lo) / numBins;
  const step = Math.max(1, Math.floor(numBins / 7));
  for (let i = 0; i < numBins; i += step) {
    const val = lo + (i + 0.5) * binW;
    ctx.fillText(val % 1 === 0 ? val.toFixed(0) : val.toFixed(1), pad.l + (i + 0.5) * barW, h - 8);
  }
}

function updateStats() {
  if (!samples.length) return;
  const meanEl = $('s-mean'), stdEl = $('s-std'), medEl = $('s-med'), nEl = $('s-n'), scEl = $('sc');
  if (!meanEl || !stdEl || !medEl || !nEl || !scEl) return;

  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const sorted = [...samples].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  meanEl.textContent = mean.toFixed(2);
  stdEl.textContent = std.toFixed(2);
  medEl.textContent = median.toFixed(2);
  nEl.textContent = n.toLocaleString();
  scEl.textContent = n.toLocaleString();
}

// ── Visual simulation tab ──
function setupVisualCanvas() {
  visCanvas = $('vcanvas');
  if (!visCanvas) return;
  visCtx = visCanvas.getContext('2d');
  visCanvas.width = visCanvas.offsetWidth * 2;
  visCanvas.height = visCanvas.offsetHeight * 2;
  const ctx = visCtx, w = visCanvas.width, h = visCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ccc';
  ctx.font = '22px "IBM Plex Mono"';
  ctx.textAlign = 'center';
  ctx.fillText('Press "Simulate Once" or "Auto"', w / 2, h / 2);
}

function toggleAuto() {
  autoMode = !autoMode;
  const btn = $('auto-btn');
  if (autoMode) {
    btn.classList.add('on');
    btn.textContent = '⏸ Stop';
    autoLoop();
  } else {
    stopAuto();
  }
}

function stopAuto() {
  autoMode = false;
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  const btn = $('auto-btn');
  if (btn) { btn.classList.remove('on'); btn.textContent = 'Auto'; }
}

function autoLoop() {
  if (!autoMode) return;
  if (visAnimating) {
    autoTimer = setTimeout(autoLoop, 120);
    return;
  }
  runVisual(() => { autoTimer = setTimeout(autoLoop, 500); });
}

function runVisual(callback) {
  if (visAnimating) return;
  visAnimating = true;
  visualRunId++;
  clearVisualSchedulers();
  const runId = visualRunId;
  const probEl = $('vp');
  if (probEl) probEl.textContent = '';
  const animFn = visualAnimations[current.id];
  if (animFn) animFn(runId, callback);
  else { visAnimating = false; if (callback) callback(); }
}

function finishVisual(resultText, probText, callback, runId) {
  if (runId !== visualRunId) return;
  const resultEl = $('vr');
  const probEl = $('vp');
  if (resultEl) resultEl.textContent = resultText;
  if (probEl) probEl.textContent = probText;
  visAnimating = false;
  clearVisualSchedulers();
  if (callback) callback();
}

function scheduleVisualTimeout(fn, delay, runId) {
  const id = setTimeout(() => {
    visualTimeouts.delete(id);
    if (runId !== visualRunId) return;
    fn();
  }, delay);
  visualTimeouts.add(id);
  return id;
}

function scheduleVisualFrame(fn, runId) {
  visualFrameId = requestAnimationFrame(ts => {
    if (runId !== visualRunId) return;
    fn(ts);
  });
  return visualFrameId;
}

function clearVisualSchedulers() {
  if (visualFrameId) {
    cancelAnimationFrame(visualFrameId);
    visualFrameId = null;
  }
  visualTimeouts.forEach(id => clearTimeout(id));
  visualTimeouts.clear();
}

function cancelVisualAnimation() {
  visualRunId++;
  clearVisualSchedulers();
  visAnimating = false;
}

// ── Grid layout helper (used by coins, factory, dice) ──
function gridLayout(count, canvasW, canvasH, maxSize, minSize) {
  const cols = Math.min(count, Math.ceil(Math.sqrt(count * 1.5)));
  const rows = Math.ceil(count / cols);
  const size = Math.min(maxSize, Math.max(minSize || maxSize, (canvasW - 80) / (cols * 1.3), (canvasH - 80) / (rows * 1.3)));
  const gap = Math.max(size * 0.15, 3);
  const totalW = cols * (size + gap) - gap;
  const totalH = rows * (size + gap) - gap;
  return {
    cols, rows, size, gap,
    ox: (canvasW - totalW) / 2,
    oy: (canvasH - totalH) / 2 - 16,
    pos: i => ({ x: (i % cols) * (size + gap), y: Math.floor(i / cols) * (size + gap) }),
  };
}

// ── Visual animations ──
const visualAnimations = {
  coin(runId, cb) {
    const ctx = visCtx, w = visCanvas.width, h = visCanvas.height;
    const n = params.n || 10, p = params.p || 0.5;
    const results = Array.from({ length: n }, () => Math.random() < p ? 'H' : 'T');
    const heads = results.filter(r => r === 'H').length;
    const grid = gridLayout(n, w, h, 56, 16);
    let revealed = 0;
    const perFrame = Math.max(1, Math.ceil(n / 25));
    const delay = Math.max(15, Math.min(70, 700 / n));

    function frame() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#999'; ctx.font = '18px "IBM Plex Mono"'; ctx.textAlign = 'center';
      ctx.fillText(`Flipping ${n} coin${n > 1 ? 's' : ''}...`, w / 2, Math.max(20, grid.oy - 12));

      for (let i = 0; i < n; i++) {
        const { x, y } = grid.pos(i);
        const cx = grid.ox + x + grid.size / 2, cy = grid.oy + y + grid.size / 2;
        const isRevealed = i < revealed;
        const isHeads = results[i] === 'H';

        ctx.beginPath();
        ctx.arc(cx, cy, grid.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = isRevealed ? (isHeads ? '#dbeafe' : '#f3f4f6') : '#f9fafb';
        ctx.fill();
        ctx.strokeStyle = isRevealed ? (isHeads ? '#3b82f6' : '#d1d5db') : '#e5e7eb';
        ctx.lineWidth = Math.max(1, grid.size / 28);
        ctx.stroke();

        if (grid.size > 20) {
          ctx.fillStyle = isRevealed ? (isHeads ? '#1d4ed8' : '#888') : '#ccc';
          ctx.font = isRevealed ? `bold ${grid.size * 0.36}px "Source Serif 4"` : `${grid.size * 0.28}px "IBM Plex Mono"`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(isRevealed ? results[i] : '?', cx, cy + 1);
        }
      }

      if (revealed >= n) {
        ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 26px "Source Serif 4"'; ctx.textAlign = 'center';
        ctx.fillText(`${heads} head${heads !== 1 ? 's' : ''} out of ${n}`, w / 2, h - 28);
        finishVisual(`${heads} heads`, `P(X = ${heads}) = ${formatProb(binomialPMF(heads, n, p))}`, cb, runId);
        return;
      }
      revealed = Math.min(revealed + perFrame, n);
      scheduleVisualTimeout(frame, delay, runId);
    }
    frame();
  },

  wait(runId, cb) {
    const ctx = visCtx, w = visCanvas.width, h = visCanvas.height;
    const lam = params.lambda || 0.5;
    const waitTime = -Math.log(1 - Math.random()) / lam;
    const maxTime = Math.max(waitTime * 1.3, 3);
    const duration = 2200;
    let startTs = null;

    function frame(ts) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const currentTime = progress * maxTime;
      ctx.clearRect(0, 0, w, h);

      // Cup
      const cx = w / 2, cy = h * 0.36, cW = 110, cH = 130;
      ctx.fillStyle = '#f5f5f5'; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - cW / 2, cy - cH / 2); ctx.lineTo(cx - cW / 2 + 8, cy + cH / 2);
      ctx.lineTo(cx + cW / 2 - 8, cy + cH / 2); ctx.lineTo(cx + cW / 2, cy - cH / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Handle
      ctx.beginPath(); ctx.arc(cx + cW / 2 + 14, cy, 22, -Math.PI / 3, Math.PI / 3);
      ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 4; ctx.stroke();

      // Coffee fill
      const fillPct = currentTime >= waitTime ? 1 : currentTime / waitTime;
      if (fillPct > 0) {
        const fillH = (cH - 8) * fillPct;
        const fy = cy + cH / 2 - fillH - 2;
        const lx = cx - cW / 2 + 8 + (cH / 2 - fillH - 2) / cH * 8;
        const rx = cx + cW / 2 - 8 - (cH / 2 - fillH - 2) / cH * 8;
        ctx.fillStyle = '#92400e'; ctx.beginPath();
        ctx.moveTo(lx, fy); ctx.lineTo(cx - cW / 2 + 8, cy + cH / 2 - 2);
        ctx.lineTo(cx + cW / 2 - 8, cy + cH / 2 - 2); ctx.lineTo(rx, fy);
        ctx.closePath(); ctx.fill();
      }

      // Steam
      if (currentTime >= waitTime) {
        for (let i = 0; i < 3; i++) {
          const sx = cx - 18 + i * 18, sy = cy - cH / 2 - 8;
          const wave = Math.sin((ts / 280) + i * 2) * 7;
          ctx.strokeStyle = 'rgba(160,160,160,0.35)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + wave, sy - 18, sx, sy - 36); ctx.stroke();
        }
      }

      // Progress bar
      const barY = h * 0.73, barW = w * 0.55, barH = 14;
      ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); roundedRect(ctx, w / 2 - barW / 2, barY, barW, barH, 7); ctx.fill();
      ctx.fillStyle = currentTime >= waitTime ? '#22c55e' : '#f59e0b';
      ctx.beginPath(); roundedRect(ctx, w / 2 - barW / 2, barY, barW * Math.min(currentTime / maxTime, 1), barH, 7); ctx.fill();

      ctx.fillStyle = '#1a1a1a'; ctx.font = '22px "IBM Plex Mono"'; ctx.textAlign = 'center';
      ctx.fillText(`${currentTime.toFixed(1)} min`, w / 2, barY + barH + 28);

      if (currentTime >= waitTime && progress >= waitTime / maxTime + 0.12) {
        ctx.fillStyle = '#22c55e'; ctx.font = 'bold 26px "Source Serif 4"';
        ctx.fillText('☕ Ready!', w / 2, h - 24);
        const pLonger = Math.exp(-lam * waitTime);
        finishVisual(`Wait: ${waitTime.toFixed(2)} min`, `P(wait > ${waitTime.toFixed(2)} min) = ${formatProb(pLonger)}`, cb, runId);
        return;
      }
      scheduleVisualFrame(frame, runId);
    }
    scheduleVisualFrame(frame, runId);
  },

  height(runId, cb) {
    const ctx = visCtx, w = visCanvas.width, h = visCanvas.height;
    const mu = params.mu || 170, sigma = params.sigma || 7;
    const val = boxMuller(mu, sigma);
    const duration = 1400;
    let startTs = null;

    function frame(ts) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentH = eased * val;
      ctx.clearRect(0, 0, w, h);

      const maxPx = h * 0.6;
      const personH = (currentH / 220) * maxPx;
      const px = w / 2, py = h * 0.82;
      const headR = personH * 0.075;

      // Person silhouette
      ctx.fillStyle = '#e0e0e0';
      if (personH > 4) {
        ctx.beginPath(); ctx.arc(px, py - personH + headR, Math.max(headR, 2), 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(px - personH * 0.055, py - personH + headR * 2, personH * 0.11, personH * 0.38);
        ctx.fillRect(px - personH * 0.055, py - personH + headR * 2 + personH * 0.38, personH * 0.045, personH * 0.42);
        ctx.fillRect(px + personH * 0.01, py - personH + headR * 2 + personH * 0.38, personH * 0.045, personH * 0.42);
        ctx.fillRect(px - personH * 0.09, py - personH + headR * 2 + personH * 0.04, personH * 0.035, personH * 0.28);
        ctx.fillRect(px + personH * 0.055, py - personH + headR * 2 + personH * 0.04, personH * 0.035, personH * 0.28);
      }

      // Ruler
      const rx = px + personH * 0.22 + 20;
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx, py); ctx.lineTo(rx, py - personH); ctx.stroke();
      if (personH > 10) {
        ctx.beginPath(); ctx.moveTo(rx - 4, py - personH + 7); ctx.lineTo(rx, py - personH); ctx.lineTo(rx + 4, py - personH + 7); ctx.stroke();
      }

      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 26px "Source Serif 4"'; ctx.textAlign = 'left';
      ctx.fillText(`${currentH.toFixed(1)} cm`, rx + 14, py - personH / 2 + 6);

      // Ground
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w * 0.15, py + 2); ctx.lineTo(w * 0.85, py + 2); ctx.stroke();

      if (progress >= 1) {
        const z = Math.abs(val - mu) / sigma;
        const pWithin = 2 * normalCDF(z) - 1;
        const sign = val >= mu ? '+' : '−';
        finishVisual(
          `Height: ${val.toFixed(1)} cm`,
          `${sign}${z.toFixed(2)}σ from mean · ${formatProb(1 - pWithin)} of people are further from the mean`,
          cb,
          runId
        );
        return;
      }
      scheduleVisualFrame(frame, runId);
    }
    scheduleVisualFrame(frame, runId);
  },

  defects(runId, cb) {
    const ctx = visCtx, w = visCanvas.width, h = visCanvas.height;
    const lam = params.lambda || 4;
    let L = Math.exp(-lam), k = 0, pr = 1;
    do { k++; pr *= Math.random(); } while (pr > L);
    const defectCount = k - 1;

    const gridCols = 8, gridRows = 4, total = gridCols * gridRows;
    const defectSet = new Set();
    while (defectSet.size < Math.min(defectCount, total)) defectSet.add(Math.floor(Math.random() * total));

    const size = Math.min(54, (w - 100) / (gridCols * 1.25), (h - 100) / (gridRows * 1.25));
    const gap = size * 0.2;
    const totalW = gridCols * (size + gap) - gap, totalH = gridRows * (size + gap) - gap;
    const ox = (w - totalW) / 2, oy = (h - totalH) / 2 - 16;
    let revealed = 0;

    function frame() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#999'; ctx.font = '18px "IBM Plex Mono"'; ctx.textAlign = 'center';
      ctx.fillText('Inspecting batch...', w / 2, oy - 12);

      for (let i = 0; i < total; i++) {
        const col = i % gridCols, row = Math.floor(i / gridCols);
        const x = ox + col * (size + gap), y = oy + row * (size + gap);
        const isDefect = defectSet.has(i);

        if (i < revealed) {
          ctx.fillStyle = isDefect ? '#fef2f2' : '#f0fdf4';
          ctx.strokeStyle = isDefect ? '#fca5a5' : '#bbf7d0';
          ctx.lineWidth = 2;
          ctx.beginPath(); roundedRect(ctx, x, y, size, size, 5); ctx.fill(); ctx.stroke();
          ctx.fillStyle = isDefect ? '#ef4444' : '#22c55e';
          ctx.font = `${size * 0.38}px "IBM Plex Mono"`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(isDefect ? '✗' : '✓', x + size / 2, y + size / 2);
        } else {
          ctx.fillStyle = '#fafafa'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2;
          ctx.beginPath(); roundedRect(ctx, x, y, size, size, 5); ctx.fill(); ctx.stroke();
        }
      }

      if (revealed >= total) {
        ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 26px "Source Serif 4"'; ctx.textAlign = 'center';
        ctx.fillText(`${defectCount} defect${defectCount !== 1 ? 's' : ''} found`, w / 2, h - 24);
        finishVisual(`${defectCount} defects`, `P(X = ${defectCount}) = ${formatProb(poissonPMF(defectCount, lam))}`, cb, runId);
        return;
      }
      revealed += 2;
      scheduleVisualTimeout(frame, 35, runId);
    }
    frame();
  },

  dice(runId, cb) {
    const ctx = visCtx, w = visCanvas.width, h = visCanvas.height;
    const n = Math.max(1, Math.floor(params.n || 5)), sides = params.sides || 6;
    const results = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
    const total = results.reduce((a, b) => a + b, 0);

    const dieSize = Math.min(70, (w - 80) / (Math.min(n, 6) * 1.3), (h - 100) / (Math.ceil(n / 6) * 1.3));
    const cols = Math.min(n, 6), rows = Math.ceil(n / cols);
    const gap = dieSize * 0.22;
    const totalW = cols * (dieSize + gap) - gap, totalH = rows * (dieSize + gap) - gap;
    const ox = (w - totalW) / 2, oy = (h - totalH) / 2 - 24;
    let rollFrame = 0, settled = false;

    function frame() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#999'; ctx.font = '18px "IBM Plex Mono"'; ctx.textAlign = 'center';
      ctx.fillText(settled ? '' : 'Rolling...', w / 2, oy - 12);

      for (let i = 0; i < n; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const x = ox + col * (dieSize + gap), y = oy + row * (dieSize + gap);
        const val = settled ? results[i] : Math.floor(Math.random() * sides) + 1;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.beginPath(); roundedRect(ctx, x + 2, y + 3, dieSize, dieSize, dieSize * 0.14); ctx.fill();
        // Die face
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 2;
        ctx.beginPath(); roundedRect(ctx, x, y, dieSize, dieSize, dieSize * 0.14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a1a1a'; ctx.font = `bold ${dieSize * 0.4}px "Source Serif 4"`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(val, x + dieSize / 2, y + dieSize / 2 + 2);
      }

      if (settled) {
        ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 26px "Source Serif 4"'; ctx.textAlign = 'center';
        ctx.fillText(`${results.join(' + ')} = ${total}`, w / 2, h - 24);
        finishVisual(`Sum: ${total}`, `P(sum = ${total}) = ${formatProb(diceSumProb(total, n, sides))}`, cb, runId);
        return;
      }
      rollFrame++;
      if (rollFrame >= 16) settled = true;
      scheduleVisualTimeout(frame, 55, runId);
    }
    frame();
  },
};

// ── Resize handler ──
window.addEventListener('resize', () => {
  if (chartCanvas) { chartCanvas.width = chartCanvas.offsetWidth * 2; chartCanvas.height = 480; drawChart(); }
  setupVisualCanvas();
});

async function bootstrap() {
  await templateLoader.loadAllTemplates();
  init();
}

bootstrap();
