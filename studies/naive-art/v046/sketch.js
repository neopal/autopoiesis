import {
  ECHO_THRESHOLD_MS,
  THROAT_COUNT,
  beginStillness,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseMemory,
  releaseStillness,
  tickStillness
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#echo-field');
const canvasMount = document.querySelector('#echo-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = buildFrame();
let focusIndex = 0;
let pointer = null;
let pointerActive = false;
let pointerStart = null;
let pointerLastTime = 0;
let renderer;

function settledFrame() {
  return timeline.at(-1);
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'hold still, release',
  'stillness-started': 'the vessel is listening',
  'stillness-held': 'the gap is geometry-neutral',
  'stillness-moved': 'movement breaks the inference',
  'stillness-refused-motion': 'the vessel refuses movement',
  'stillness-refused-short': 'the model needs longer stillness',
  'stillness-refused-idle': 'the vessel has no listener',
  'stillness-committed': 'the model heard another throat',
  'stillness-lifted': 'the last echo was lifted',
  'memory-released': 'the vessel is quiet again'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl) return;
  stageEl.textContent = `echo ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.echoCount = String(state.body.echoes.length);
  field.dataset.sourceThroat = String(state.body.trace.lastSourceThroat ?? 'none');
  field.dataset.targetThroat = String(state.body.trace.lastTargetThroat ?? 'none');
}

function scaleFor(p) {
  return Math.min(p.width, p.height) * 0.38;
}

function vertexFor(p, point, z = 0) {
  const scale = scaleFor(p);
  return { x: point.x * scale, y: point.y * scale, z: z + point.z * scale * 0.35 };
}

function drawBackground(p) {
  p.background(214, 20, 9);
  p.noStroke();
  for (let index = 0; index < 18; index += 1) {
    const size = Math.max(p.width, p.height) * (1.35 - index * 0.045);
    p.fill(204 + index * 2, 22 - index * 0.5, 11 + index * 0.8, 0.08);
    p.ellipse(-p.width * 0.16, p.height * 0.06, size, size * 0.72);
  }
  p.stroke(178, 24, 78, 0.12);
  p.strokeWeight(0.7);
  for (let index = 0; index < 7; index += 1) {
    const radius = Math.min(p.width, p.height) * (0.18 + index * 0.08);
    p.ellipse(p.width * 0.18 - p.width / 2, p.height * 0.11 - p.height / 2, radius, radius * 0.66);
  }
}

function drawVessel(p, body) {
  const shell = body.shell.map((point) => vertexFor(p, point, 0));
  const depth = Math.min(p.width, p.height) * 0.12;
  const frontZ = -depth;
  const backZ = depth;
  const frontCentre = vertexFor(p, { x: 0.01, y: -0.01, z: 0 }, frontZ);
  const backCentre = vertexFor(p, { x: 0.01, y: -0.01, z: 0 }, backZ);

  p.noStroke();
  p.fill(192, 31, 35, 0.9);
  p.beginShape(p.TRIANGLES);
  shell.forEach((point, index) => {
    const next = shell[(index + 1) % shell.length];
    p.vertex(frontCentre.x, frontCentre.y, frontZ);
    p.vertex(point.x, point.y, frontZ);
    p.vertex(next.x, next.y, frontZ);
  });
  p.endShape();

  p.fill(205, 24, 23, 0.84);
  p.beginShape(p.TRIANGLES);
  shell.forEach((point, index) => {
    const next = shell[(index + 1) % shell.length];
    p.vertex(backCentre.x, backCentre.y, backZ);
    p.vertex(next.x, next.y, backZ);
    p.vertex(point.x, point.y, backZ);
  });
  p.endShape();

  p.fill(185, 27, 42, 0.92);
  p.beginShape(p.QUADS);
  shell.forEach((point, index) => {
    const next = shell[(index + 1) % shell.length];
    p.vertex(point.x, point.y, frontZ);
    p.vertex(next.x, next.y, frontZ);
    p.vertex(next.x, next.y, backZ);
    p.vertex(point.x, point.y, backZ);
  });
  p.endShape();

  p.noFill();
  p.stroke(39, 23, 96, 0.5);
  p.strokeWeight(1.1);
  p.beginShape();
  shell.forEach((point) => p.vertex(point.x, point.y, frontZ - 1));
  p.endShape(p.CLOSE);
}

function drawThroat(p, throat, index, pendingThroat) {
  const scale = scaleFor(p);
  const position = vertexFor(p, throat, -scale * 0.22);
  const width = throat.width * scale;
  const height = throat.height * scale;
  const active = index === pendingThroat;

  p.push();
  p.translate(position.x, position.y, position.z);
  p.rotateZ(p.radians(throat.rotation));
  p.noStroke();
  p.fill(205, 24, 16, 0.98);
  p.box(width * 1.1, height * 1.1, Math.max(8, scale * 0.035));
  p.translate(0, 0, -scale * 0.025);
  p.fill(active ? 18 : 213, active ? 27 : 27, active ? 92 : 9, 1);
  p.box(width * 0.74, height * 0.68, Math.max(12, scale * 0.06));
  p.noFill();
  p.stroke(active ? 178 : 44, active ? 44 : 19, active ? 94 : 90, active ? 0.95 : 0.64);
  p.strokeWeight(active ? 2.2 : 1);
  p.box(width * 0.78, height * 0.72, Math.max(14, scale * 0.068));
  p.pop();
}

function drawEcho(p, echo) {
  const scale = scaleFor(p);
  const depth = -scale * (0.28 + echo.depth * 0.5);
  const points = echo.points.map((point) => vertexFor(p, { ...point, z: 0 }, depth));
  p.noStroke();
  p.fill(176 + echo.memoryIndex * 7, 42, 75, 0.3);
  p.beginShape(p.QUADS);
  points.forEach((point) => p.vertex(point.x + 4, point.y + 6, point.z + 11));
  p.endShape();
  p.fill(173 + echo.memoryIndex * 9, 55, 96, 0.78);
  p.beginShape(p.QUADS);
  points.forEach((point) => p.vertex(point.x, point.y, point.z));
  p.endShape();
  p.noFill();
  p.stroke(30 + echo.memoryIndex * 18, 36, 100, 0.9);
  p.strokeWeight(1.4);
  p.beginShape();
  points.forEach((point) => p.vertex(point.x, point.y, point.z - 2));
  p.endShape(p.CLOSE);
  p.stroke(185, 18, 100, 0.42);
  p.strokeWeight(0.65);
  p.line(points[0].x, points[0].y, points[0].z, points[2].x, points[2].y, points[2].z);
}

function drawListeningMark(p) {
  if (staticMode || !pointer) return;
  p.push();
  p.translate(pointer.x - p.width / 2, pointer.y - p.height / 2, -scaleFor(p) * 0.45);
  p.noFill();
  p.stroke(33, 44, 100, 0.7);
  p.strokeWeight(pointerActive ? 1.6 : 0.8);
  p.ellipse(0, 0, pointerActive ? 26 : 18, pointerActive ? 26 : 18);
  p.line(-12, 0, 12, 0);
  p.line(0, -12, 0, 12);
  p.pop();
}

function drawField(p) {
  drawBackground(p);
  p.push();
  p.translate(0, 4, 0);
  p.rotateX(-0.2);
  p.rotateY(0.25);
  p.ambientLight(90, 34, 50);
  p.directionalLight(190, 55, 78, -0.4, -0.5, -1);
  drawVessel(p, state.body);
  const pendingThroat = state.pending?.active ? state.pending.throat : -1;
  state.body.throats.forEach((throat, index) => drawThroat(p, throat, index, pendingThroat));
  state.body.echoes.forEach((echo) => drawEcho(p, echo));
  p.pop();
  drawListeningMark(p);
  if (!reducedMotion && !staticMode) {
    p.push();
    p.translate(0, 0, -scaleFor(p) * 0.5);
    p.noFill();
    p.stroke(179, 22, 100, 0.12);
    p.strokeWeight(0.6);
    p.arc(-p.width * 0.3, p.height * 0.26, p.width * 0.24, p.height * 0.12, p.PI * 0.2, p.PI * 1.2);
    p.pop();
  }
}

function updateState(next) {
  state = next;
  updateReadout();
  renderer?.redraw();
}

function completeDeterministicStillness() {
  const sourceThroat = [0, 2, 4, 6][state.memory.length % 4];
  let next = beginStillness(state, sourceThroat);
  next = tickStillness(next, ECHO_THRESHOLD_MS, 0);
  updateState(releaseStillness(next));
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function nearestThroat(event) {
  const point = localPoint(event);
  const rect = field.getBoundingClientRect();
  const x = (point.x - rect.width * 0.5) / scaleFor({ width: rect.width, height: rect.height });
  const y = (point.y - rect.height * 0.5) / scaleFor({ width: rect.width, height: rect.height });
  let best = 0;
  let bestDistance = Infinity;
  state.body.throats.forEach((throat, index) => {
    const distance = Math.hypot(x - throat.x, y - throat.y);
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointerActive = true;
  pointer = localPoint(event);
  pointerStart = pointer;
  pointerLastTime = event.timeStamp || performance.now();
  focusIndex = nearestThroat(event);
  updateState(beginStillness(state, focusIndex));
  field.setPointerCapture?.(event.pointerId);
}, { passive: false });

field?.addEventListener('pointermove', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointer = localPoint(event);
  if (pointerActive && state.pending?.active) {
    const now = event.timeStamp || performance.now();
    const delta = Math.max(0, now - pointerLastTime);
    const rect = field.getBoundingClientRect();
    const displacement = Math.hypot(pointer.x - pointerStart.x, pointer.y - pointerStart.y) / Math.min(rect.width, rect.height);
    pointerLastTime = now;
    updateState(tickStillness(state, delta, displacement));
  } else renderer?.redraw();
}, { passive: false });

function endPointer(event) {
  if (staticMode || !pointerActive) return;
  event.preventDefault();
  pointer = localPoint(event);
  if (state.pending?.active) {
    const now = event.timeStamp || performance.now();
    updateState(tickStillness(state, Math.max(0, now - pointerLastTime), 0));
    updateState(releaseStillness(state));
  }
  pointerActive = false;
  pointerStart = null;
  field.releasePointerCapture?.(event.pointerId);
  renderer?.redraw();
}

field?.addEventListener('pointerup', endPointer, { passive: false });
field?.addEventListener('pointercancel', () => { pointerActive = false; pointer = null; pointerStart = null; renderer?.redraw(); });
field?.addEventListener('pointerleave', () => { if (!pointerActive) { pointer = null; renderer?.redraw(); } });

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % THROAT_COUNT;
    renderer?.redraw();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + THROAT_COUNT - 1) % THROAT_COUNT;
    renderer?.redraw();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    completeDeterministicStillness();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatest(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pointerActive = false;
    pointer = null;
    updateState(releaseMemory(state));
  }
});

document.querySelector('[data-action="listen"]')?.addEventListener('click', completeDeterministicStillness);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => updateState(liftLatest(state)));
document.querySelector('[data-action="release"]')?.addEventListener('click', () => updateState(releaseMemory(state)));

renderer = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, canvasMount?.clientWidth ?? 960);
    const height = Math.max(320, canvasMount?.clientHeight ?? 680);
    const canvas = p.createCanvas(width, height, p.WEBGL);
    canvas.parent(canvasMount);
    canvas.elt.setAttribute('aria-hidden', 'true');
    canvas.elt.classList.add('echo-vessel-canvas');
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noLoop();
    p.redraw();
    window._p5Ready = true;
  };
  p.draw = () => drawField(p);
  p.windowResized = () => {
    if (!canvasMount) return;
    p.resizeCanvas(Math.max(320, canvasMount.clientWidth), Math.max(320, canvasMount.clientHeight));
    p.redraw();
  };
});

updateReadout();
window._p5Ready = true;
window.__mutineNaiveV046 = {
  beginStillness,
  buildFrame,
  buildTimeline,
  geometrySignature: () => geometrySignature(state),
  getState: () => state,
  liftLatest,
  releaseMemory,
  releaseStillness,
  tickStillness,
  completeDeterministicStillness
};
