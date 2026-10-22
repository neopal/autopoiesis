import {
  applyControlReversal,
  applyTick,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseMembrane
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#reversal-field');
const canvasHost = document.querySelector('#membrane-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const blind = params.get('blind') === '1';

const PALETTE = {
  night: '#171316',
  deep: '#0e0d12',
  ink: '#f0e2c9',
  muted: '#a99d9a',
  coral: '#d66f5e',
  amber: '#dfad61',
  blue: '#8ea7b8',
  mauve: '#927b8a',
  plum: '#4f354d',
  rust: '#773b3d'
};

let frame = params.get('static') === '1' || reducedMotion ? buildTimeline().at(-1) : buildFrame(0, []);
let canvas;
let renderer;
let p5Instance;
let touchStart = null;

function colorWithAlpha(hex, opacity) {
  const value = p5Instance.color(hex);
  value.setAlpha(opacity);
  return value;
}

function fieldBounds() {
  const marginX = Math.max(24, canvas.width * 0.10);
  const top = Math.max(36, canvas.height * 0.065);
  const bottom = Math.max(42, canvas.height * 0.065);
  return { x: marginX, y: top, w: canvas.width - marginX * 2, h: canvas.height - top - bottom };
}

function screenPoint(point, bounds, breathing = 0) {
  return {
    x: bounds.x + point.x * bounds.w,
    y: bounds.y + point.y * bounds.h + breathing
  };
}

function drawBackground() {
  const rows = 34;
  for (let row = 0; row < rows; row += 1) {
    const amount = row / (rows - 1);
    const top = p5Instance.lerpColor(p5Instance.color(PALETTE.deep), p5Instance.color(PALETTE.night), amount);
    p5Instance.noStroke();
    p5Instance.fill(top);
    p5Instance.rect(0, row * canvas.height / rows, canvas.width, canvas.height / rows + 1);
  }
  const bounds = fieldBounds();
  p5Instance.noStroke();
  p5Instance.fill(colorWithAlpha(PALETTE.plum, 30));
  p5Instance.ellipse(bounds.x + bounds.w * 0.18, bounds.y + bounds.h * 0.30, bounds.w * 0.34, bounds.h * 0.64);
  p5Instance.fill(colorWithAlpha(PALETTE.rust, 22));
  p5Instance.ellipse(bounds.x + bounds.w * 0.83, bounds.y + bounds.h * 0.67, bounds.w * 0.27, bounds.h * 0.60);
  p5Instance.noFill();
  p5Instance.stroke(colorWithAlpha(PALETTE.ink, 34));
  p5Instance.strokeWeight(1);
  p5Instance.rect(bounds.x, bounds.y, bounds.w, bounds.h, 14);

  for (let index = 0; index < 260; index += 1) {
    const x = (index * 97 + 23) % Math.max(1, Math.floor(canvas.width));
    const y = (index * 53 + 41) % Math.max(1, Math.floor(canvas.height));
    const radius = 0.45 + (index % 5) * 0.28;
    p5Instance.noStroke();
    p5Instance.fill(colorWithAlpha(index % 4 ? PALETTE.ink : PALETTE.blue, 13 + (index % 4) * 4));
    p5Instance.ellipse(x, y, radius, radius);
  }
}

function bodyPoints(bounds, breathing = 0) {
  const top = frame.membrane.map((slice) => screenPoint({ x: slice.x, y: slice.top }, bounds, breathing));
  const bottom = frame.membrane.slice().reverse().map((slice) => screenPoint({ x: slice.x, y: slice.bottom }, bounds, breathing));
  return [...top, ...bottom];
}

function drawBody(points, fillColor, strokeColor, weight, offset = { x: 0, y: 0 }) {
  p5Instance.fill(fillColor);
  p5Instance.beginShape();
  points.forEach((point) => p5Instance.vertex(point.x + offset.x, point.y + offset.y));
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.noFill();
  p5Instance.stroke(strokeColor);
  p5Instance.strokeWeight(weight);
  p5Instance.beginShape();
  points.forEach((point) => p5Instance.vertex(point.x + offset.x, point.y + offset.y));
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.fill(fillColor);
}

function drawMembrane() {
  const bounds = fieldBounds();
  const breath = reducedMotion || blind ? 0 : Math.sin(p5Instance.frameCount * 0.018) * 2.2;
  const points = bodyPoints(bounds, breath);

  p5Instance.noStroke();
  p5Instance.fill(colorWithAlpha(PALETTE.deep, 170));
  p5Instance.beginShape();
  points.forEach((point) => p5Instance.vertex(point.x + 15, point.y + 19));
  p5Instance.endShape(p5Instance.CLOSE);

  drawBody(points, colorWithAlpha(PALETTE.mauve, 218), colorWithAlpha(PALETTE.ink, 120), 1.5);
  drawBody(points, colorWithAlpha(PALETTE.mauve, 20), colorWithAlpha(PALETTE.coral, 130), 0.8, { x: -5, y: 3 });

  frame.strata.forEach((stratum, layer) => {
    const line = stratum.points.map((point) => screenPoint(point, bounds, breath));
    p5Instance.noFill();
    p5Instance.stroke(colorWithAlpha(layer % 2 ? PALETTE.blue : PALETTE.amber, 58 + layer * 11));
    p5Instance.strokeWeight(8 + layer * 3.5);
    p5Instance.beginShape();
    line.forEach((point) => p5Instance.curveVertex(point.x, point.y));
    p5Instance.endShape();
    p5Instance.stroke(colorWithAlpha(PALETTE.ink, 45));
    p5Instance.strokeWeight(0.8);
    p5Instance.beginShape();
    line.forEach((point) => p5Instance.curveVertex(point.x, point.y - 4 - layer * 2));
    p5Instance.endShape();
  });

  frame.membrane.forEach((slice, index) => {
    const top = screenPoint({ x: slice.x, y: slice.top }, bounds, breath);
    const bottom = screenPoint({ x: slice.x, y: slice.bottom }, bounds, breath);
    const center = { x: top.x, y: (top.y + bottom.y) * 0.5 };
    if (slice.void > 0.04) {
      const cutWidth = 10 + slice.void * 38;
      const cutHeight = 16 + slice.void * 54;
      p5Instance.noStroke();
      p5Instance.fill(colorWithAlpha(PALETTE.deep, 222));
      p5Instance.ellipse(center.x + slice.lean * bounds.w * 0.8, center.y + Math.sin(index * 0.9) * 9, cutWidth, cutHeight);
      p5Instance.noFill();
      p5Instance.stroke(colorWithAlpha(PALETTE.blue, 135));
      p5Instance.strokeWeight(1.2 + slice.void * 0.7);
      p5Instance.arc(center.x, center.y, cutWidth + 10, cutHeight + 12, -0.8, 1.7);
    }
    if (slice.stain > 0.04) {
      const stainX = center.x + slice.lean * bounds.w * 1.8;
      const stainY = center.y + Math.cos(index * 0.47) * 18;
      p5Instance.noStroke();
      p5Instance.fill(colorWithAlpha(PALETTE.coral, 70 + slice.stain * 38));
      p5Instance.ellipse(stainX, stainY, 8 + slice.stain * 20, 22 + slice.stain * 38);
      p5Instance.fill(colorWithAlpha(PALETTE.amber, 92));
      p5Instance.ellipse(stainX + 2, stainY - 4, 2.2 + slice.stain * 3, 12 + slice.stain * 8);
    }
  });

  p5Instance.noFill();
  p5Instance.stroke(colorWithAlpha(PALETTE.ink, 82));
  p5Instance.strokeWeight(0.7);
  for (let index = 0; index < 44; index += 1) {
    const x = bounds.x + bounds.w * (0.04 + ((index * 37) % 92) / 100);
    const y = bounds.y + bounds.h * (0.11 + ((index * 19) % 76) / 100);
    p5Instance.line(x, y, x + 3 + (index % 5) * 2, y + 8 + (index % 4) * 3);
  }

  if (frame.pending.streak > 0 && !blind) {
    p5Instance.noFill();
    p5Instance.stroke(colorWithAlpha(PALETTE.amber, 115));
    p5Instance.strokeWeight(1);
    const marker = frame.pending.direction > 0 ? 1 : -1;
    p5Instance.arc(bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.16, 50 + frame.pending.streak * 16, 22, marker > 0 ? -0.35 : Math.PI + 0.35, marker > 0 ? Math.PI + 0.35 : Math.PI * 2 - 0.35);
  }
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / 13`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} reversal${frame.memory.length === 1 ? '' : 's'} held${frame.pending.streak ? ` · ${frame.pending.streak}/3 loaded` : ''}`;
  const messages = {
    baseline: 'The skin is quiet.',
    'tension-held': `${frame.pending.streak}/3 in one direction. The skin has not moved.`,
    'tension-armed': 'Three directions loaded. Reverse to make the paint answer.',
    'tension-reset': 'The direction changed too soon; the skin kept its shape.',
    'reversal-committed': 'The reversal sheared the membrane elsewhere.',
    lifted: 'The latest shear has been lifted.',
    'lift-refused': 'Nothing is held to lift.',
    released: 'The membrane released its ledger.',
    timeline: 'Reduced motion settles the skin into remembered reversals.'
  };
  if (stateReadout) stateReadout.textContent = messages[frame.interaction] || 'The skin is listening.';
}

function performReversal() {
  renderFrame(applyControlReversal(frame, frame.memory.length));
}

function applyDirection(direction, source = 'visitor-arrow') {
  renderFrame(applyTick(frame, direction, source));
}

function bindEvents() {
  renderer.elt.addEventListener('wheel', (event) => {
    event.preventDefault();
    applyDirection(event.deltaY >= 0 ? 1 : -1, 'visitor-scroll');
  }, { passive: false });
  renderer.elt.addEventListener('pointerdown', (event) => {
    touchStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    renderer.elt.setPointerCapture?.(event.pointerId);
  });
  renderer.elt.addEventListener('pointerup', (event) => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) applyDirection(dx > 0 ? 1 : -1, 'visitor-swipe');
    touchStart = null;
  });
  renderer.elt.addEventListener('pointercancel', () => { touchStart = null; });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); applyDirection(1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); applyDirection(-1); }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); performReversal(); }
    if (event.key === 'Delete') { event.preventDefault(); renderFrame(liftLatest(frame)); }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); renderFrame(releaseMembrane()); }
    if (event.key.toLowerCase() === 's') p5Instance.saveCanvas('mutine-brush-v035', 'png');
  });
  document.querySelector('[data-gesture="reverse"]').addEventListener('click', performReversal);
  document.querySelector('[data-gesture="lift"]').addEventListener('click', () => renderFrame(liftLatest(frame)));
  document.querySelector('[data-gesture="release"]').addEventListener('click', () => renderFrame(releaseMembrane()));
}

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, Math.min(860, width * 0.88));
  return { width, height };
}

const sketch = (p) => {
  p5Instance = p;
  p.setup = () => {
    const size = canvasSize();
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    canvas = p;
    p.pixelDensity(1);
    p.frameRate(30);
    p.colorMode(p.HSB, 360, 100, 100, 255);
    p.noiseSeed(0x42523535);
    renderer.elt.setAttribute('aria-label', 'A single painted membrane that stores directional tension and changes only on reversal.');
    bindEvents();
    renderFrame(frame);
    window._p5Ready = true;
  };
  p.draw = () => {
    drawBackground();
    drawMembrane();
  };
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
  };
};

new window.p5(sketch);

window.__mutineBrushV035 = {
  getFrame: () => frame,
  tick: (direction) => { applyDirection(direction, 'browser-tick'); return frame; },
  commitDemo: () => { performReversal(); return frame; },
  lift: () => { renderFrame(liftLatest(frame)); return frame; },
  release: () => { renderFrame(releaseMembrane()); return frame; },
  geometrySignature: () => geometrySignature(frame)
};
