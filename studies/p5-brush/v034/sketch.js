import {
  applyCensus,
  applyObservation,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAttention,
  nextControlCensus,
  releaseAttention
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#attention-field');
const canvasHost = document.querySelector('#attention-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const blind = params.get('blind') === '1';

const PALETTE = {
  night: '#0d1718',
  nightDeep: '#091113',
  ink: '#eee1c7',
  muted: '#9eb0a7',
  line: '#34443f',
  clay: '#c7775e',
  saffron: '#d4a15d',
  sage: '#86aa98',
  paper: '#d9c19a',
  moss: '#637f77',
  void: '#172a2a'
};
const TONES = [PALETTE.paper, PALETTE.clay, PALETTE.sage, PALETTE.saffron, '#a6a982', PALETTE.moss];

let frame = params.get('static') === '1' || reducedMotion ? buildTimeline().at(-1) : buildFrame(0, []);
let controlCursor = 0;
let pointerPosition = null;
let canvas;
let renderer;
let p5Instance;

function alpha(hex, opacity) {
  const color = canvas ? colorFor(hex) : hex;
  color.setAlpha(opacity);
  return color;
}

function colorFor(hex) {
  return window.__mutineP5Color(hex);
}

function fieldBounds() {
  const marginX = Math.max(24, canvas.width * 0.055);
  const top = Math.max(32, canvas.height * 0.075);
  const bottom = Math.max(34, canvas.height * 0.075);
  return { x: marginX, y: top, w: canvas.width - marginX * 2, h: canvas.height - top - bottom };
}

function toScreen(point) {
  const bounds = fieldBounds();
  return { x: bounds.x + point.x * bounds.w, y: bounds.y + point.y * bounds.h };
}

function polygon(points, offset = { x: 0, y: 0 }) {
  canvas.beginShape();
  points.forEach((point) => {
    const screen = toScreen(point);
    canvas.vertex(screen.x + offset.x, screen.y + offset.y);
  });
  canvas.endShape(canvas.CLOSE);
}

function scaledPoints(points, scale, center) {
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  }));
}

function drawGround() {
  const bounds = fieldBounds();
  canvas.noStroke();
  for (let row = 0; row < 22; row += 1) {
    const amount = row / 21;
    canvas.fill(canvas.lerpColor(colorFor(PALETTE.nightDeep), colorFor(PALETTE.night), amount));
    canvas.rect(0, row * canvas.height / 22, canvas.width, canvas.height / 22 + 1);
  }
  canvas.fill(alpha(PALETTE.sage, 18));
  canvas.ellipse(bounds.x + bounds.w * 0.50, bounds.y + bounds.h * 0.48, bounds.w * 0.72, bounds.h * 0.74);
  canvas.fill(alpha(PALETTE.clay, 12));
  canvas.ellipse(bounds.x + bounds.w * 0.24, bounds.y + bounds.h * 0.42, bounds.w * 0.30, bounds.h * 0.48);
  canvas.fill(alpha(PALETTE.saffron, 10));
  canvas.ellipse(bounds.x + bounds.w * 0.78, bounds.y + bounds.h * 0.65, bounds.w * 0.28, bounds.h * 0.34);

  canvas.noFill();
  canvas.stroke(alpha(PALETTE.line, 150));
  canvas.strokeWeight(1);
  canvas.rect(bounds.x, bounds.y, bounds.w, bounds.h, 22);

  for (let index = 0; index < 180; index += 1) {
    const x = bounds.x + ((index * 83 + 31) % Math.max(1, Math.floor(bounds.w)));
    const y = bounds.y + ((index * 47 + 19) % Math.max(1, Math.floor(bounds.h)));
    const radius = 0.6 + (index % 4) * 0.35;
    canvas.noStroke();
    canvas.fill(alpha(index % 3 === 0 ? PALETTE.paper : PALETTE.sage, 18 + (index % 5) * 3));
    canvas.ellipse(x, y, radius, radius);
  }
}

function drawRibbons() {
  frame.ribbons.forEach((ribbon, ribbonIndex) => {
    canvas.noFill();
    canvas.stroke(alpha(ribbonIndex % 2 ? PALETTE.sage : PALETTE.clay, 48));
    canvas.strokeWeight(Math.max(4, ribbon.width * fieldBounds().w * 1.8));
    canvas.beginShape();
    ribbon.points.forEach((point) => {
      const screen = toScreen(point);
      canvas.curveVertex(screen.x, screen.y);
    });
    canvas.endShape();
    canvas.stroke(alpha(PALETTE.paper, 30));
    canvas.strokeWeight(1.2);
    canvas.beginShape();
    ribbon.points.forEach((point) => {
      const screen = toScreen(point);
      canvas.curveVertex(screen.x, screen.y - ribbon.width * 12);
    });
    canvas.endShape();
  });
}

function drawPool(pool) {
  const center = toScreen({ x: pool.cx, y: pool.cy });
  const points = pool.points;
  const tone = TONES[pool.tone];
  canvas.noStroke();
  canvas.fill(alpha(PALETTE.nightDeep, 125));
  polygon(points, { x: 7, y: 11 });

  canvas.stroke(alpha(PALETTE.nightDeep, 210));
  canvas.strokeWeight(2.3);
  canvas.fill(alpha(tone, 220));
  polygon(points);

  const inner = scaledPoints(points, 0.84, { x: pool.cx, y: pool.cy });
  canvas.noStroke();
  canvas.fill(alpha(TONES[(pool.tone + 2) % TONES.length], 60));
  polygon(inner);

  canvas.noFill();
  canvas.stroke(alpha(PALETTE.ink, 74));
  canvas.strokeWeight(1.1);
  polygon(scaledPoints(points, 0.72, { x: pool.cx, y: pool.cy }));

  for (let mark = 0; mark < 5; mark += 1) {
    const phase = (pool.id + 1) * (mark + 2) * 0.71;
    const x = center.x + Math.sin(phase) * (pool.rx * fieldBounds().w * 0.40);
    const y = center.y + Math.cos(phase * 1.31) * (pool.ry * fieldBounds().h * 0.36);
    canvas.noStroke();
    canvas.fill(alpha(mark % 2 ? PALETTE.night : PALETTE.ink, 36));
    canvas.ellipse(x, y, 2 + (mark % 3), 1.5 + (mark % 2));
  }

  if (pool.dry > 0.01) {
    canvas.noStroke();
    canvas.fill(alpha(PALETTE.void, 220));
    canvas.ellipse(center.x - 3, center.y + 2, Math.max(10, pool.rx * fieldBounds().w * 0.44), Math.max(8, pool.ry * fieldBounds().h * 0.34));
    canvas.noFill();
    canvas.stroke(alpha(PALETTE.saffron, 180));
    canvas.strokeWeight(1.6);
    canvas.ellipse(center.x - 3, center.y + 2, Math.max(13, pool.rx * fieldBounds().w * 0.52), Math.max(10, pool.ry * fieldBounds().h * 0.42));
  }
  if (pool.ridge > 0.01) {
    canvas.noFill();
    canvas.stroke(alpha(PALETTE.paper, 205));
    canvas.strokeWeight(3.2);
    canvas.arc(center.x + 6, center.y - 6, pool.rx * fieldBounds().w * 0.72, pool.ry * fieldBounds().h * 0.72, Math.PI * 1.1, Math.PI * 1.85);
  }
  if (pool.counter > 0.01) {
    canvas.noFill();
    canvas.stroke(alpha(PALETTE.moss, 220));
    canvas.strokeWeight(2.4);
    canvas.arc(center.x + 5, center.y + 4, pool.rx * fieldBounds().w * 0.82, pool.ry * fieldBounds().h * 0.62, Math.PI * 0.08, Math.PI * 0.88);
  }
}

function drawAttentionState() {
  if (blind || !pointerPosition) return;
  const screen = toScreen(pointerPosition);
  canvas.noFill();
  canvas.stroke(alpha(PALETTE.saffron, 160));
  canvas.strokeWeight(1);
  const pulse = 11 + Math.sin(performance.now() * 0.002) * 2;
  canvas.ellipse(screen.x, screen.y, pulse, pulse);
  frame.pending.forEach((entry, index) => {
    const pool = frame.pools[entry.poolIndex];
    const center = toScreen({ x: pool.cx, y: pool.cy });
    canvas.stroke(alpha(PALETTE.ink, 120));
    canvas.ellipse(center.x, center.y, 18 + index * 5, 18 + index * 5);
  });
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / 13`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} census${frame.memory.length === 1 ? '' : 'es'} held${frame.pending.length ? ` · ${frame.pending.length}/${5} watched` : ''}`;
  const messages = {
    baseline: 'The field is keeping its unlooked-for places.',
    'attention-held': `${frame.pending.length}/5 places noticed. The paint has not moved.`,
    'attention-refused-empty': 'Nothing is near enough to be noticed.',
    'attention-refused-repeat': 'The field has already heard that place.',
    'attention-committed': 'The watched places stayed still; a remote absence opened.',
    'attention-lifted': 'The latest absence has been lifted.',
    'attention-lift-refused': 'Nothing is held to lift.',
    'attention-released': 'The pigment has released its stored attention.',
    timeline: 'Reduced motion settles the field into its remembered absences.'
  };
  if (stateReadout) stateReadout.textContent = messages[frame.interaction] || 'The paint is keeping its distance.';
}

function draw() {
  drawGround();
  drawRibbons();
  frame.pools.forEach(drawPool);
  drawAttentionState();
  if (!reducedMotion && !blind) {
    canvas.noStroke();
    canvas.fill(alpha(PALETTE.paper, 18));
    const bounds = fieldBounds();
    const drift = Math.sin(canvas.frameCount * 0.008) * 5;
    canvas.ellipse(bounds.x + bounds.w * 0.52 + drift, bounds.y + bounds.h * 0.50, 3, 3);
  }
}

function pointerPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0.01, Math.min(0.99, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.02, Math.min(0.98, (event.clientY - rect.top) / rect.height))
  };
}

function observePointer(event) {
  if (event.target.closest?.('button')) return;
  const point = pointerPoint(event);
  if (!point) return;
  pointerPosition = point;
  const next = applyObservation(frame, point, 'pointer-attention');
  if (next.interaction !== 'attention-refused-repeat' || frame.interaction !== next.interaction) renderFrame(next);
}

function performCensus() {
  const event = nextControlCensus(controlCursor);
  controlCursor += 1;
  renderFrame(applyCensus(frame, event.points, 'control-census'));
}

function bindEvents() {
  renderer.elt.addEventListener('pointermove', observePointer);
  renderer.elt.addEventListener('pointerdown', (event) => {
    renderer.elt.setPointerCapture?.(event.pointerId);
    observePointer(event);
  });
  renderer.elt.addEventListener('pointercancel', () => { pointerPosition = null; });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); performCensus(); }
    if (event.key === 'Delete') { event.preventDefault(); renderFrame(liftLatestAttention(frame)); }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); renderFrame(releaseAttention()); }
    if (event.key.toLowerCase() === 's') p5Instance.saveCanvas('mutine-brush-v034', 'png');
  });
  document.querySelector('[data-gesture="census"]').addEventListener('click', performCensus);
  document.querySelector('[data-gesture="lift"]').addEventListener('click', () => renderFrame(liftLatestAttention(frame)));
  document.querySelector('[data-gesture="release"]').addEventListener('click', () => renderFrame(releaseAttention()));
}

const sketch = (p) => {
  p5Instance = p;
  p.setup = () => {
    renderer = p.createCanvas(Math.max(320, canvasHost.clientWidth || 960), Math.max(420, Math.min(720, (canvasHost.clientWidth || 960) * 0.66)));
    renderer.parent(canvasHost);
    canvas = p;
    p.pixelDensity(1);
    p.frameRate(30);
    p.noiseSeed(0x42525534);
    p.colorMode(p.RGB, 255, 255, 255, 255);
    window.__mutineP5Color = (hex) => p.color(hex);
    renderer.elt.setAttribute('aria-label', 'A single painted field that records where it was watched and opens an unlooked-for absence.');
    bindEvents();
    renderFrame(frame);
  };
  p.draw = draw;
  p.windowResized = () => {
    const width = Math.max(320, canvasHost.clientWidth || 960);
    p.resizeCanvas(width, Math.max(420, Math.min(720, width * 0.66)));
  };
};

new window.p5(sketch);

window.__mutineBrushV034 = {
  getFrame: () => frame,
  observe: (point) => { renderFrame(applyObservation(frame, point, 'browser-observe')); return frame; },
  commitDemo: () => { performCensus(); return frame; },
  lift: () => { renderFrame(liftLatestAttention(frame)); return frame; },
  release: () => { renderFrame(releaseAttention()); return frame; },
  geometrySignature: () => geometrySignature(frame)
};
