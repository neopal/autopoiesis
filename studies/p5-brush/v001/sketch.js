(() => {
  const seedText = 'mutine-brush-v001-loss';
  let seed = [...seedText].reduce((n, c) => ((n << 5) - n + c.charCodeAt(0)) | 0, 0) >>> 0;
  const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const canvas = document.querySelector('#brush');
  const ctx = canvas.getContext('2d', { alpha: false });
  let ink, loss, trace, mode = 'withhold', paused = false, pointer = null, clock = 0;
  const colors = { paper: '#d7d0bf', ink: '#12120f', red: '#b4412d', wash: '#655d51' };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    canvas.width = Math.floor(r.width * dpr); canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    [ink, loss, trace] = ['ink', 'loss', 'trace'].map(() => {
      const layer = document.createElement('canvas'); layer.width = canvas.width; layer.height = canvas.height;
      const c = layer.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return layer;
    });
    seed = [...seedText].reduce((n, c) => ((n << 5) - n + c.charCodeAt(0)) | 0, 0) >>> 0;
    clock = 0; composeBase();
  }
  function layer(name) { return ({ ink, loss, trace })[name].getContext('2d'); }
  function composeBase() {
    const w = canvas.clientWidth, h = canvas.clientHeight, c = layer('ink');
    c.fillStyle = colors.paper; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 780; i++) {
      const x = rand() * w, y = rand() * h;
      c.fillStyle = `rgba(18,18,15,${0.025 + rand() * 0.035})`;
      c.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 48; i++) autonomousMark(i, true);
    scar(0.42, 0.38, Math.min(w, h) * 0.17, 0.12);
  }
  function autonomousMark(i, quiet = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight, c = layer('ink');
    const x = (0.08 + rand() * 0.84) * w, y = (0.12 + rand() * 0.76) * h;
    const a = (rand() - .5) * 1.4, len = (quiet ? 30 : 55) + rand() * (quiet ? 140 : 220);
    c.save(); c.translate(x, y); c.rotate(a); c.globalCompositeOperation = 'multiply';
    c.strokeStyle = rand() > .14 ? `rgba(18,18,15,${0.05 + rand() * .16})` : `rgba(180,65,45,${0.08 + rand() * .12})`;
    c.lineWidth = 1 + rand() * (quiet ? 4 : 7); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-len * .35, 0);
    for (let s = 0; s < 18; s++) { const t = s / 17; c.lineTo((t - .35) * len, Math.sin(t * 11 + i) * (2 + rand() * 14) + (rand() - .5) * 8); }
    c.stroke(); c.restore();
  }
  function sediment(x, y, dx, dy) {
    const c = layer('ink'), velocity = Math.min(26, Math.hypot(dx, dy));
    c.save(); c.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 9; i++) { const jitter = (rand() - .5) * 15; c.strokeStyle = `rgba(18,18,15,${.06 + velocity * .006})`; c.lineWidth = 1 + rand() * 3; c.beginPath(); c.moveTo(x - dx * .3 + jitter, y - dy * .3 - jitter); c.quadraticCurveTo(x + jitter, y - jitter, x + dx * .2, y + dy * .2); c.stroke(); }
    c.restore();
  }
  function scar(x, y, radius, alpha = .22) {
    const c = layer('loss'), w = canvas.clientWidth, h = canvas.clientHeight;
    c.save(); c.globalCompositeOperation = 'source-over'; c.strokeStyle = `rgba(215,208,191,${alpha})`; c.lineWidth = Math.max(9, radius * .14); c.lineCap = 'round';
    c.beginPath(); for (let i = 0; i < 11; i++) { const t = i / 10, px = x * w + Math.cos(t * 8 + x * 9) * radius * (1 - t) + (t - .5) * radius * 1.9, py = y * h + Math.sin(t * 5 + y * 7) * radius * .24; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); c.restore();
  }
  function render() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, w, h); ctx.drawImage(ink, 0, 0, w, h); ctx.drawImage(loss, 0, 0, w, h); ctx.drawImage(trace, 0, 0, w, h);
  }
  function tick() {
    if (!paused) { clock++; if (clock % 95 === 0) autonomousMark(clock); if (clock % 170 === 0) scar(rand(), rand(), 35 + rand() * 100, .12 + rand() * .15); }
    render(); requestAnimationFrame(tick);
  }
  function point(event) { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture(event.pointerId); pointer = point(event); if (mode === 'scar') scar(pointer.x / canvas.clientWidth, pointer.y / canvas.clientHeight, 55, .55); else if (mode === 'return') autonomousMark(clock); render(); });
  canvas.addEventListener('pointermove', (event) => { if (!pointer || !event.buttons) return; const p = point(event); if (mode === 'withhold') sediment(p.x, p.y, p.x - pointer.x, p.y - pointer.y); if (mode === 'scar') scar(p.x / canvas.clientWidth, p.y / canvas.clientHeight, 23, .35); pointer = p; render(); });
  canvas.addEventListener('pointerup', () => { pointer = null; });
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => { mode = button.dataset.mode; document.querySelector('#state').textContent = mode; }));
  addEventListener('keydown', (event) => { if (event.key === ' ') { event.preventDefault(); paused = !paused; } if (event.key.toLowerCase() === 'r') resize(); if (event.key.toLowerCase() === 's') { render(); const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'mutine-brush-v001.png'; a.click(); } });
  addEventListener('resize', resize); resize(); requestAnimationFrame(tick); window._p5Ready = true;
})();