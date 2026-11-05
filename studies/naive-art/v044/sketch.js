import {
  SHUTTER_COUNT,
  beginVisit,
  buildFrame,
  buildTimeline,
  commitDeparture,
  geometrySignature,
  liftLatestDeparture,
  noticeShutter,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#absence-wall');
const canvasMount = document.querySelector('#absence-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = buildFrame();
let focusIndex = 0;
let pointer = null;
let visitActive = false;
let renderer;

function completeDeterministicDeparture() {
  const shutters = timeline[state.memory.length % timeline.length];
  let next = beginVisit(state);
  for (const id of shutters) next = noticeShutter(next, id);
  return commitDeparture(next);
}

function settledFrame() {
  let frame = buildFrame();
  for (const shutters of timeline) {
    let next = beginVisit(frame);
    for (const id of shutters) next = noticeShutter(next, id);
    frame = commitDeparture(next);
  }
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'move across three shutters, then leave',
  'visit-started': 'the wall is noticing your presence',
  'shutter-noticed': 'the shutter opens its reverse',
  'visit-ready': 'three noticed: now leave the wall',
  'shutter-refused-invalid': 'that shutter is not in the wall',
  'shutter-refused-repeated': 'the wall refuses a repeated visit',
  'visit-refused-full': 'the visit is already full',
  'departure-refused-incomplete': 'the model needs three departures to agree',
  'departure-committed': 'the model placed an absence elsewhere',
  'departure-lifted': 'the last absence was lifted',
  'memory-released': 'the wall is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl) return;
  stageEl.textContent = `departure ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.pendingCount = String(state.pending.length);
  field.dataset.absenceCount = String(state.scene.trace.absenceCount);
  field.dataset.changedShutterCount = String(state.scene.trace.changedShutterCount);
}

function mapPoint(p, item) {
  const span = Math.min(p.width, p.height) * 0.92;
  return { x: p.width * 0.5 + item.x * span, y: p.height * 0.5 + item.y * span, span };
}

function drawBackground(p) {
  p.background(270, 23, 14);
  p.noStroke();
  for (let index = 0; index < 18; index += 1) {
    const inset = index * Math.min(p.width, p.height) * 0.012;
    p.fill(28 + index * 1.2, 20 + index * 0.6, 12 + index * 0.45, 0.22);
    p.rect(inset * 0.45, inset, p.width - inset * 0.9, p.height - inset * 1.65);
  }
  p.randomSeed(4344);
  p.stroke(42, 14, 92, 0.1);
  p.strokeWeight(0.55);
  for (let index = 0; index < 130; index += 1) {
    const x = p.random(p.width);
    const y = p.random(p.height);
    const length = p.random(2, Math.max(4, Math.min(p.width, p.height) * 0.018));
    p.line(x, y, x + length, y + p.random(-1.2, 1.2));
  }
  p.stroke(34, 20, 92, 0.18);
  p.strokeWeight(0.8);
  p.line(p.width * 0.07, p.height * 0.19, p.width * 0.93, p.height * 0.83);
  p.line(p.width * 0.1, p.height * 0.84, p.width * 0.88, p.height * 0.16);
}

function drawAbsence(p, absence) {
  const point = mapPoint(p, absence);
  p.push();
  p.translate(point.x, point.y);
  p.noStroke();
  p.fill(8, 23, 7, 0.45);
  p.beginShape();
  for (const vertex of absence.rings[0]) p.vertex((vertex.x - absence.x) * point.span + point.span * 0.018, (vertex.y - absence.y) * point.span + point.span * 0.022);
  p.endShape(p.CLOSE);
  p.fill(8, 24, 8, 0.96);
  p.beginShape();
  for (const vertex of absence.rings[0]) p.vertex((vertex.x - absence.x) * point.span, (vertex.y - absence.y) * point.span);
  p.endShape(p.CLOSE);
  p.noFill();
  for (let index = 1; index < absence.rings.length; index += 1) {
    const hue = index === 1 ? 12 : 39;
    p.stroke(hue, 47, 91, 0.82 - index * 0.14);
    p.strokeWeight(index === 1 ? 2.1 : 0.95);
    p.beginShape();
    for (const vertex of absence.rings[index]) p.vertex((vertex.x - absence.x) * point.span, (vertex.y - absence.y) * point.span);
    p.endShape(p.CLOSE);
  }
  p.stroke(42, 15, 100, 0.35);
  p.strokeWeight(0.6);
  p.line(-absence.scale * point.span * 0.54, absence.skew * point.span, absence.scale * point.span * 0.6, -absence.skew * point.span * 0.4);
  p.pop();
}

function drawShutter(p, shutter, selected, focused) {
  const point = mapPoint(p, shutter);
  const width = shutter.width * point.span;
  const height = shutter.height * point.span;
  p.push();
  p.translate(point.x, point.y);
  p.rotate(p.radians(shutter.rotation));
  if (focused || selected) {
    p.noFill();
    p.stroke(selected ? 11 : 39, selected ? 56 : 30, 100, selected ? 0.95 : 0.72);
    p.strokeWeight(selected ? 2.4 : 1);
    p.rect(0, 0, width * 1.2, height * 1.22);
  }
  p.noStroke();
  p.fill(7, 25, 7, 0.5);
  p.beginShape();
  p.vertex(-width * 0.43 + 7, -height * 0.43 + 8);
  p.vertex(width * 0.48 + 7, -height * 0.36 + 8);
  p.vertex(width * 0.39 + 7, height * 0.43 + 8);
  p.vertex(-width * 0.5 + 7, height * 0.34 + 8);
  p.endShape(p.CLOSE);
  p.fill(selected ? 10 : 35, selected ? 44 : 13, selected ? 86 : 88, 0.97);
  p.beginShape();
  p.vertex(-width * 0.43, -height * 0.43);
  p.vertex(width * 0.48, -height * 0.36);
  p.vertex(width * 0.39, height * 0.43);
  p.vertex(-width * 0.5, height * 0.34);
  p.endShape(p.CLOSE);
  p.stroke(selected ? 11 : 35, selected ? 44 : 18, selected ? 92 : 62, 0.85);
  p.strokeWeight(1.1);
  p.line(-width * 0.39, -height * 0.33, width * 0.38, -height * 0.27);
  p.line(-width * 0.32, height * 0.26, width * 0.3, height * 0.32);
  p.stroke(selected ? 10 : 42, selected ? 48 : 13, selected ? 90 : 72, 0.75);
  p.strokeWeight(0.8);
  p.line(-width * 0.28, -height * 0.27, -width * 0.18, height * 0.23);
  p.line(width * 0.16, -height * 0.25, width * 0.27, height * 0.27);
  p.noStroke();
  p.fill(selected ? 10 : 12, selected ? 39 : 34, selected ? 76 : 19, 0.88);
  p.beginShape();
  p.vertex(width * 0.08, -height * 0.34);
  p.vertex(width * 0.43, -height * 0.31);
  p.vertex(width * 0.35, height * 0.08);
  p.vertex(width * 0.05, height * 0.01);
  p.endShape(p.CLOSE);
  p.pop();
}

function drawPresence(p) {
  if (staticMode || !pointer) return;
  p.noFill();
  p.stroke(39, 32, 100, 0.25);
  p.strokeWeight(0.7);
  p.ellipse(pointer.x, pointer.y, Math.min(p.width, p.height) * 0.12, Math.min(p.width, p.height) * 0.12);
  p.stroke(11, 52, 100, 0.28);
  p.line(pointer.x - 8, pointer.y, pointer.x + 8, pointer.y);
  p.line(pointer.x, pointer.y - 8, pointer.x, pointer.y + 8);
}

function drawField(p) {
  drawBackground(p);
  for (const absence of state.scene.absences) drawAbsence(p, absence);
  const pending = new Set(state.pending);
  for (const shutter of state.scene.shutters) drawShutter(p, shutter, pending.has(shutter.id), shutter.id === focusIndex);
  drawPresence(p);
  if (!reducedMotion && !staticMode) {
    p.stroke(39, 25, 100, 0.13);
    p.strokeWeight(0.5);
    const pulse = Math.sin(Date.now() * 0.001) * 2;
    p.line(p.width * 0.12, p.height * 0.11 + pulse, p.width * 0.88, p.height * 0.11 + pulse);
  }
}

function updateState(next) {
  state = next;
  updateReadout();
  renderer?.redraw();
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function hitShutter(point) {
  const width = field.clientWidth;
  const height = field.clientHeight;
  const span = Math.min(width, height) * 0.92;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const shutter of state.scene.shutters) {
    const x = width * 0.5 + shutter.x * span;
    const y = height * 0.5 + shutter.y * span;
    const distance = Math.hypot(point.x - x, point.y - y);
    const threshold = Math.max(28, span * Math.max(shutter.width, shutter.height) * 0.62);
    if (distance < threshold && distance < nearestDistance) {
      nearest = shutter.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function noticeAt(id) {
  if (id === null || id === undefined) return;
  if (state.pending.length === 0 && !visitActive) updateState(beginVisit(state));
  if (!state.pending.includes(id)) updateState(noticeShutter(state, id));
}

function depart() {
  visitActive = false;
  if (state.pending.length) updateState(commitDeparture(state));
  pointer = null;
}

field?.addEventListener('pointermove', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointer = localPoint(event);
  if (!visitActive) visitActive = true;
  noticeAt(hitShutter(pointer));
  renderer?.redraw();
}, { passive: false });
field?.addEventListener('pointerleave', () => {
  if (staticMode || !visitActive) return;
  depart();
  renderer?.redraw();
});
field?.addEventListener('pointerup', (event) => {
  if (staticMode || event.pointerType !== 'touch') return;
  if (state.pending.length === 3) depart();
});
field?.addEventListener('pointercancel', () => { pointer = null; visitActive = false; renderer?.redraw(); });

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % SHUTTER_COUNT;
    renderer?.redraw();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + SHUTTER_COUNT - 1) % SHUTTER_COUNT;
    renderer?.redraw();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (state.pending.length === 3) updateState(commitDeparture(state));
    else noticeAt(focusIndex);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatestDeparture(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pointer = null;
    visitActive = false;
    updateState(releaseMemory());
  }
});

document.querySelector('[data-action="ask"]')?.addEventListener('click', () => updateState(completeDeterministicDeparture()));
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => updateState(liftLatestDeparture(state)));
document.querySelector('[data-action="release"]')?.addEventListener('click', () => updateState(releaseMemory()));

renderer = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, canvasMount?.clientWidth ?? 960);
    const height = Math.max(320, canvasMount?.clientHeight ?? 680);
    const canvas = p.createCanvas(width, height);
    canvas.parent(canvasMount);
    canvas.elt.setAttribute('aria-hidden', 'true');
    canvas.elt.classList.add('absence-wall-canvas');
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
window.__mutineNaiveV044 = {
  beginVisit,
  buildFrame,
  buildTimeline,
  commitDeparture,
  getState: () => state,
  geometrySignature: () => geometrySignature(state),
  liftLatestDeparture,
  releaseMemory,
  noticeShutter,
  completeDeterministicDeparture,
  renderSignature: () => geometrySignature(state)
};
