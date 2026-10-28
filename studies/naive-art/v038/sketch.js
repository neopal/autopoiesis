import {
  beginLook,
  buildFrame,
  buildTimeline,
  commitLook,
  liftLatestLook,
  releaseMemory,
  WITNESS_COUNT
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#witness-field');
const mount = document.querySelector('#witness-canvas-mount');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const pendingEl = document.querySelector('[data-pending]');
const timeline = buildTimeline();
let state = buildFrame();
let pendingWitness = null;
let pointerStartedAt = 0;
let sketch;
let backing;
let veil;
let grain;

function settledFrame() {
  let frame = buildFrame();
  for (const look of timeline) frame = commitLook(beginLook(frame, look), look);
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'hold near a witness, then leave',
  'look-armed': 'the field is keeping your place',
  'look-refused-short': 'the field did not keep a short look',
  'look-refused-invalid': 'the field cannot keep that place',
  'look-committed': 'another place is missing now',
  'look-lifted': 'the last absence was lifted',
  'memory-released': 'the field is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!stageEl) return;
  stageEl.textContent = `attention ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = pendingWitness === null ? statusText() : `keeping witness ${pendingWitness + 1}`;
  field?.setAttribute('data-memory-count', String(state.memory.length));
  field?.setAttribute('data-pending-witness', pendingWitness === null ? '' : String(pendingWitness));
}

function updatePending() {
  if (!pendingEl || !field) return;
  pendingEl.replaceChildren();
  if (pendingWitness === null) return;
  const witness = state.scene.witnesses[pendingWitness];
  const rect = field.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'pending-mark';
  dot.style.left = `${witness.x * rect.width}px`;
  dot.style.top = `${witness.y * rect.height}px`;
  pendingEl.append(dot);
}

function updateState(next) {
  state = next;
  sketch?.redraw();
  updateReadout();
  updatePending();
  field?.focus({ preventScroll: true });
}

function commitDeterministicLook() {
  if (staticMode) return;
  const look = timeline[state.memory.length % timeline.length];
  pendingWitness = null;
  updateState(commitLook(beginLook(state, look), look));
}

function chooseWitness(clientX, clientY) {
  const rect = field.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  let best = 0;
  let bestDistance = Infinity;
  state.scene.witnesses.forEach((witness, index) => {
    const dx = witness.x - x;
    const dy = witness.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return best;
}

function armPointer(event) {
  if (staticMode) return;
  pendingWitness = chooseWitness(event.clientX, event.clientY);
  pointerStartedAt = performance.now();
  updateState(beginLook(state, { witness: pendingWitness }));
  field.setPointerCapture?.(event.pointerId);
}

function releasePointer(event) {
  if (staticMode || pendingWitness === null) return;
  const dwell = (performance.now() - pointerStartedAt) / 1000;
  const look = { witness: pendingWitness, dwell };
  pendingWitness = null;
  updateState(commitLook(beginLook(state, look), look));
  field.releasePointerCapture?.(event.pointerId);
}

field?.addEventListener('pointerdown', armPointer);
field?.addEventListener('pointerup', releasePointer);
field?.addEventListener('pointercancel', () => { pendingWitness = null; updateReadout(); updatePending(); });
field?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeterministicLook();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    pendingWitness = null;
    updateState(liftLatestLook(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pendingWitness = null;
    updateState(releaseMemory(state));
  }
});

document.querySelector('[data-action="look"]')?.addEventListener('click', commitDeterministicLook);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => {
  pendingWitness = null;
  updateState(liftLatestLook(state));
});
document.querySelector('[data-action="release"]')?.addEventListener('click', () => {
  pendingWitness = null;
  updateState(releaseMemory(state));
});

const PALETTE = [
  [148, 193, 169],
  [207, 177, 108],
  [210, 113, 89],
  [133, 123, 166],
  [190, 199, 172],
  [164, 119, 104]
];

function rgba(rgb, alpha = 1) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`; }
function pointFor(witness, index, step, width, height, scale = 1) {
  const angle = (Math.PI * 2 * step) / 9;
  const wobble = 1 + 0.08 * Math.sin(step * 2.2 + index * 1.4 + witness.fold * 3.1);
  const localX = Math.cos(angle) * witness.width * width * wobble * scale;
  const localY = Math.sin(angle) * witness.height * height * wobble * scale;
  const c = Math.cos(witness.rotation);
  const s = Math.sin(witness.rotation);
  return [witness.x * width + localX * c - localY * s, witness.y * height + localX * s + localY * c];
}

function drawForm(g, witness, index, width, height, role) {
  const base = PALETTE[witness.tone % PALETTE.length];
  const color = role === 'false-reconstruction' ? PALETTE[2] : role === 'remembering-edge' ? PALETTE[1] : base;
  const alpha = role === 'quieted' ? 0.48 : role === 'missing-witness' ? 0.12 : 0.84;
  const shadow = role === 'missing-witness' ? [0, 0, 0] : [4, 8, 10];
  const points = Array.from({ length: 9 }, (_, step) => pointFor(witness, index, step, width, height));

  g.push();
  g.noStroke();
  g.fill(rgba(shadow, role === 'missing-witness' ? 0.46 : 0.42));
  g.beginShape();
  points.forEach(([x, y]) => g.vertex(x + width * 0.012, y + height * 0.018));
  g.endShape(g.CLOSE);
  g.fill(rgba(color, alpha));
  g.beginShape();
  points.forEach(([x, y]) => g.vertex(x, y));
  g.endShape(g.CLOSE);

  if (role === 'missing-witness') {
    g.noFill();
    g.stroke(rgba(PALETTE[2], 0.78));
    g.strokeWeight(Math.max(1.2, width * 0.003));
    g.beginShape();
    points.forEach(([x, y]) => g.vertex(x, y));
    g.endShape(g.CLOSE);
    g.stroke(rgba([229, 219, 186], 0.2));
    g.strokeWeight(Math.max(0.8, width * 0.0015));
    g.line(points[1][0], points[1][1], points[6][0], points[6][1]);
  } else {
    g.noFill();
    g.stroke(rgba([239, 231, 207], role === 'quieted' ? 0.18 : 0.3));
    g.strokeWeight(Math.max(0.7, width * 0.0014));
    g.beginShape();
    points.slice(1, 7).forEach(([x, y]) => g.vertex(x, y));
    g.endShape();
    g.stroke(rgba([15, 22, 24], 0.28));
    g.strokeWeight(Math.max(0.8, width * 0.002));
    const notch = pointFor(witness, index, 2, width, height, 0.42);
    const notch2 = pointFor(witness, index, 6, width, height, 0.42);
    g.line(notch[0], notch[1], notch2[0], notch2[1]);
  }

  if (role === 'false-reconstruction') {
    g.noFill();
    g.stroke(rgba(PALETTE[4], 0.82));
    g.strokeWeight(Math.max(1.1, width * 0.003));
    const ghost = points.map(([x, y]) => [x + width * 0.018, y - height * 0.012]);
    g.beginShape();
    ghost.forEach(([x, y]) => g.vertex(x, y));
    g.endShape(g.CLOSE);
  }
  if (role === 'remembering-edge') {
    g.stroke(rgba(PALETTE[0], 0.9));
    g.strokeWeight(Math.max(1.4, width * 0.0032));
    g.line(points[0][0], points[0][1], points[4][0], points[4][1]);
  }
  g.pop();
}

function drawBackdrop(g, width, height) {
  g.clear();
  g.background(13, 18, 20, 255);
  g.noStroke();
  for (let ring = 7; ring >= 0; ring -= 1) {
    const alpha = 8 + ring * 2;
    const tint = ring % 2 ? [31, 59, 59] : [49, 39, 45];
    g.fill(rgba(tint, alpha / 100));
    g.ellipse(width * 0.49, height * 0.48, width * (0.5 + ring * 0.065), height * (0.53 + ring * 0.055));
  }
  g.fill(rgba([217, 203, 171], 0.035));
  g.beginShape();
  g.vertex(width * 0.05, height * 0.83);
  g.vertex(width * 0.19, height * 0.22);
  g.vertex(width * 0.73, height * 0.1);
  g.vertex(width * 0.94, height * 0.66);
  g.vertex(width * 0.79, height * 0.94);
  g.vertex(width * 0.24, height * 0.9);
  g.endShape(g.CLOSE);
}

function drawVeil(g, width, height) {
  g.clear();
  g.noStroke();
  g.fill(rgba([149, 187, 169], 0.08));
  g.beginShape();
  g.vertex(width * 0.1, height * 0.5);
  g.bezierVertex(width * 0.18, height * 0.12, width * 0.76, height * 0.08, width * 0.9, height * 0.46);
  g.bezierVertex(width * 0.78, height * 0.84, width * 0.34, height * 0.88, width * 0.1, height * 0.5);
  g.endShape(g.CLOSE);
  g.stroke(rgba([211, 191, 141], 0.16));
  g.strokeWeight(Math.max(1, width * 0.001));
  g.noFill();
  g.beginShape();
  g.vertex(width * 0.13, height * 0.52);
  g.bezierVertex(width * 0.29, height * 0.22, width * 0.68, height * 0.17, width * 0.86, height * 0.45);
  g.endShape();
}

function drawAperture(g, aperture, width, height) {
  const cx = aperture.x * width;
  const cy = aperture.y * height;
  const rx = width * 0.16 * aperture.scale;
  const ry = height * 0.19 * aperture.scale;
  g.push();
  g.translate(cx, cy);
  g.rotate(aperture.lean);
  g.noStroke();
  g.fill(rgba([5, 8, 9], 0.74));
  g.beginShape();
  for (let step = 0; step < 13; step += 1) {
    const a = (Math.PI * 2 * step) / 13;
    const wobble = 1 + Math.sin(step * 1.7 + aperture.depth) * 0.08;
    g.vertex(Math.cos(a) * rx * wobble, Math.sin(a) * ry * wobble);
  }
  g.endShape(g.CLOSE);
  g.noFill();
  g.stroke(rgba(PALETTE[1], 0.22));
  g.strokeWeight(Math.max(1.2, width * 0.002));
  g.beginShape();
  for (let step = 0; step < 13; step += 1) {
    const a = (Math.PI * 2 * step) / 13;
    g.vertex(Math.cos(a) * rx * 1.08, Math.sin(a) * ry * 1.08);
  }
  g.endShape(g.CLOSE);
  g.pop();
}

function drawGrain(g, width, height) {
  g.clear();
  g.randomSeed(338);
  g.strokeWeight(1);
  for (let i = 0; i < Math.floor(width * height / 1800); i += 1) {
    const shade = 130 + g.random(80);
    g.stroke(224, 214, 190, g.random(4, 14));
    const x = g.random(width);
    const y = g.random(height);
    g.point(x, y);
    if (i % 7 === 0) g.line(x, y, x + g.random(-4, 4), y + g.random(-2, 2));
  }
}

function render(p) {
  if (!backing || !veil || !grain) return;
  const width = p.width;
  const height = p.height;
  drawBackdrop(backing, width, height);
  drawVeil(veil, width, height);
  drawGrain(grain, width, height);
  p.clear();
  p.image(backing, 0, 0);
  p.image(veil, 0, 0);
  drawAperture(p, state.scene.aperture, width, height);
  state.scene.witnesses.forEach((witness, index) => drawForm(p, witness, index, width, height, witness.role));
  p.image(grain, 0, 0);
  p.noFill();
  p.stroke(220, 211, 190, 28);
  p.strokeWeight(Math.max(1, width * 0.001));
  p.rect(width * 0.022, height * 0.026, width * 0.956, height * 0.948);
}

function resizeBuffers(width, height) {
  backing?.remove();
  veil?.remove();
  grain?.remove();
  backing = sketch.createGraphics(width, height);
  veil = sketch.createGraphics(width, height);
  grain = sketch.createGraphics(width, height);
  backing.pixelDensity(1);
  veil.pixelDensity(1);
  grain.pixelDensity(1);
}

sketch = new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    const width = Math.max(1, mount?.clientWidth || 900);
    const height = Math.max(1, mount?.clientHeight || 580);
    p.createCanvas(width, height).parent(mount);
    resizeBuffers(width, height);
    p.noLoop();
    render(p);
    p.redraw();
    window._p5Ready = true;
  };
  p.draw = () => render(p);
  p.windowResized = () => {
    const width = Math.max(1, mount?.clientWidth || p.width);
    const height = Math.max(1, mount?.clientHeight || p.height);
    p.resizeCanvas(width, height);
    resizeBuffers(width, height);
    p.redraw();
  };
});

window.__mutineNaiveV038 = {
  getState: () => JSON.parse(JSON.stringify(state)),
  buildFrame,
  buildTimeline,
  commitLook,
  geometrySignature: (value) => JSON.stringify(value.scene),
  getCanvas: () => mount?.querySelector('canvas') || null
};

updateReadout();
updatePending();
