import {
  GRID_COLS,
  GRID_ROWS,
  STAGES,
  MIN_DWELL_MS,
  MAX_DWELL_MS,
  applyDwell,
  buildFrame,
  buildTimeline,
  commitDwell,
  geometrySignature,
  liftLatest,
  previewDwell,
  releasePlate
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#cure-field');
const canvasHost = document.querySelector('#cure-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;

const PALETTE = {
  void: '#120d0a',
  soot: '#1d1511',
  rust: '#c46845',
  clay: '#d59b6c',
  bone: '#e8d6b5',
  sage: '#94a48b',
  bruise: '#766477',
  ash: '#b5a898'
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;
let dwellPoint = null;
let pressStartedAt = 0;
let timer = null;
let liveElapsed = 0;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, canvasHost.clientHeight || Math.min(760, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The plate is quiet. It accepts no mark from a passing touch.',
    'dwell-preview': 'The pressure is held. The raster has not changed.',
    'dwell-refused-miss': 'The touch found no material well. The plate stays exact.',
    'dwell-refused-short': 'The pressure left too soon. No cure formed.',
    'dwell-refused-overcured': 'The pressure stayed too long. The material refused the overcure.',
    'dwell-committed': 'The held place stays quiet. A remote seal, fracture, and bleed have entered the plate.',
    lifted: 'The latest cure has been lifted. The prior raster returns exactly.',
    'lift-refused': 'There is no recent cure to lift.',
    released: 'The plate releases every remembered phase change.',
    timeline: 'Reduced motion holds four remote cures in the raster plate.'
  };
  return messages[interaction] || 'The material is waiting for duration, not a passing mark.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering plate' : 'quiet plate'} · ${frame.memory.length} cure${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.02, Math.min(0.98, (event.clientY - rect.top) / rect.height))
  };
}

function cellColor(cell) {
  const fracture = Math.min(1, cell.crack * 0.72);
  const bleed = Math.min(1, cell.bleed * 0.9);
  const cure = Math.min(1, cell.dry * 0.5);
  return {
    hue: 22 + bleed * 19 + fracture * 325,
    saturation: Math.max(16, 66 - cure * 25 + bleed * 11),
    brightness: Math.max(9, 26 + cell.mass * 32 + cure * 15 - fracture * 18),
    alpha: 236
  };
}

function drawAtmosphere() {
  p5Instance.noStroke();
  p5Instance.fill(18, 12, 9, 255);
  p5Instance.rect(0, 0, p5Instance.width, p5Instance.height);
  for (let ring = 5; ring >= 0; ring -= 1) {
    const alpha = 4 + ring * 2;
    p5Instance.fill(24 + ring * 2, 26, 23, alpha);
    p5Instance.ellipse(p5Instance.width * 0.5, p5Instance.height * 0.48, p5Instance.width * (0.56 + ring * 0.08), p5Instance.height * (0.6 + ring * 0.05));
  }
}

function drawRaster() {
  const cellWidth = p5Instance.width / GRID_COLS;
  const cellHeight = p5Instance.height / GRID_ROWS;
  p5Instance.noStroke();
  frame.cells.forEach((cell) => {
    if (!cell.mask) return;
    const shade = cellColor(cell);
    p5Instance.fill(shade.hue, shade.saturation, shade.brightness, shade.alpha);
    const x = cell.x * p5Instance.width;
    const y = cell.y * p5Instance.height;
    p5Instance.rect(x, y, cellWidth + 0.75, cellHeight + 0.75);
    if (cell.grain > 0.58) {
      p5Instance.fill(36 + cell.grain * 12, 22, 72, 24 + cell.grain * 24);
      p5Instance.rect(x + cellWidth * 0.24, y + cellHeight * 0.2, Math.max(0.7, cellWidth * 0.12), Math.max(0.7, cellHeight * 0.42));
    }
  });
}

function drawDryEdges() {
  const cellWidth = p5Instance.width / GRID_COLS;
  const cellHeight = p5Instance.height / GRID_ROWS;
  p5Instance.noFill();
  frame.cells.forEach((cell, index) => {
    if (!cell.mask || cell.crack < 0.18) return;
    const x = cell.x * p5Instance.width;
    const y = cell.y * p5Instance.height;
    const wobble = Math.sin(index * 0.71) * cellWidth * 0.34;
    p5Instance.stroke(31 + cell.crack * 12, 38, 32 + cell.bleed * 18, 28 + Math.min(110, cell.crack * 100));
    p5Instance.strokeWeight(Math.max(0.45, Math.min(1.8, cell.crack * 1.8)));
    p5Instance.line(x + cellWidth * 0.12, y + cellHeight * 0.78, x + cellWidth * 0.54 + wobble, y + cellHeight * 0.2);
  });
}

function drawPlateBoundary() {
  const cellWidth = p5Instance.width / GRID_COLS;
  const cellHeight = p5Instance.height / GRID_ROWS;
  p5Instance.noFill();
  p5Instance.stroke(34, 30, 58, 145);
  p5Instance.strokeWeight(1.05);
  frame.cells.forEach((cell) => {
    if (!cell.mask) return;
    const x = cell.x * p5Instance.width;
    const y = cell.y * p5Instance.height;
    const right = frame.cells.find((candidate) => Math.abs(candidate.x - (cell.x + 1 / (GRID_COLS - 1))) < 0.0001 && Math.abs(candidate.y - cell.y) < 0.0001);
    const below = frame.cells.find((candidate) => Math.abs(candidate.x - cell.x) < 0.0001 && Math.abs(candidate.y - (cell.y + 1 / (GRID_ROWS - 1))) < 0.0001);
    if (!right || !right.mask) p5Instance.line(x + cellWidth, y, x + cellWidth, y + cellHeight);
    if (!below || !below.mask) p5Instance.line(x, y + cellHeight, x + cellWidth, y + cellHeight);
  });
}

function drawPending() {
  if (!frame.pending?.point || frame.pending.well === null) return;
  const x = frame.pending.point.x * p5Instance.width;
  const y = frame.pending.point.y * p5Instance.height;
  const progress = Math.min(1, frame.pending.elapsed / MAX_DWELL_MS);
  p5Instance.noFill();
  p5Instance.stroke(48, 22, 88, 180);
  p5Instance.strokeWeight(1.4);
  p5Instance.ellipse(x, y, 22 + progress * 24, 22 + progress * 24);
  p5Instance.stroke(36, 38, 92, 130);
  p5Instance.arc(x, y, 34 + progress * 30, 34 + progress * 30, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
}

function drawComposition() {
  drawAtmosphere();
  drawRaster();
  drawDryEdges();
  drawPlateBoundary();
  drawPending();
}

function stopTimer() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

function beginDwell(event) {
  if (staticMode) return;
  event.preventDefault();
  tracking = true;
  pointerId = event.pointerId;
  dwellPoint = normalizedPoint(event);
  pressStartedAt = performance.now();
  liveElapsed = 0;
  renderer.elt.setPointerCapture?.(event.pointerId);
  renderFrame(previewDwell(frame, dwellPoint, liveElapsed));
  stopTimer();
  timer = window.setInterval(() => {
    liveElapsed = Math.round(performance.now() - pressStartedAt);
    renderFrame(previewDwell(frame, dwellPoint, liveElapsed));
  }, 80);
}

function endDwell(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  liveElapsed = Math.round(performance.now() - pressStartedAt);
  stopTimer();
  renderer.elt.releasePointerCapture?.(event.pointerId);
  renderFrame(commitDwell(frame, dwellPoint, liveElapsed, 'visitor-timed-dwell'));
  tracking = false;
  pointerId = null;
  dwellPoint = null;
}

function cancelDwell() {
  stopTimer();
  tracking = false;
  pointerId = null;
  dwellPoint = null;
  renderFrame(frame);
}

function performControlCure() {
  if (!staticMode) renderFrame(applyDwell(frame, 0, MIN_DWELL_MS + 220, 'control-dwell'));
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginDwell);
  renderer.elt.addEventListener('pointerup', endDwell);
  renderer.elt.addEventListener('pointercancel', cancelDwell);
}

function bindControls() {
  document.querySelector('[data-gesture="cure"]')?.addEventListener('click', performControlCure);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releasePlate(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlCure();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!staticMode) renderFrame(liftLatest(frame));
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      if (!staticMode) renderFrame(releasePlate(frame));
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      p5Instance.saveCanvas('mutine-brush-v042', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 255);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV042 = {
      getFrame: () => frame,
      geometrySignature: () => geometrySignature(frame),
      preview: (point, elapsed) => renderFrame(previewDwell(frame, point, elapsed)),
      commit: (point, elapsed) => renderFrame(commitDwell(frame, point, elapsed, 'probe-timed-dwell')),
      cure: performControlCure,
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releasePlate(frame)),
      ready: true
    };
  };
  p.draw = drawComposition;
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    p.redraw();
  };
};

p5Instance = new window.p5(sketch, canvasHost);
