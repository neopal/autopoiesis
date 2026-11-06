import {
  CAVITY_COUNT,
  PRESSURE_SITES,
  beginPressure,
  buildFrame,
  buildTimeline,
  cavitySignature,
  geometrySignature,
  liftLatestPressure,
  pressureSample,
  releaseMemory,
  releasePressure
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#pressure-membrane');
const canvasMount = document.querySelector('#membrane-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = buildFrame();
let focusIndex = 0;
let pointer = null;
let pointerActive = false;
let renderer;

function completeDeterministicPressure() {
  const gesture = timeline[state.memory.length % timeline.length];
  let next = beginPressure(state, PRESSURE_SITES[gesture.site]);
  for (const sample of gesture.samples) next = pressureSample(next, sample);
  return releasePressure(next);
}

function settledFrame() {
  let frame = buildFrame();
  for (const gesture of timeline) {
    let next = beginPressure(frame, PRESSURE_SITES[gesture.site]);
    for (const sample of gesture.samples) next = pressureSample(next, sample);
    frame = releasePressure(next);
  }
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'press, return, release',
  'pressure-started': 'the aperture is receiving pressure',
  'pressure-sampled': 'the trace is geometry-neutral',
  'pressure-refused-outside': 'the slab refuses an outside press',
  'pressure-refused-idle': 'the slab has no pressure trace',
  'pressure-refused-weak': 'the pressure is too weak to remember',
  'pressure-refused-dwell': 'the model needs a dwell before release',
  'pressure-refused-one-way': 'the model refuses a one-way trace',
  'pressure-committed': 'the model sealed another chamber',
  'pressure-lifted': 'the last membrane was lifted',
  'memory-released': 'the slab is hollow again'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl) return;
  stageEl.textContent = `membrane ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.membraneCount = String(state.scene.trace.membraneCount);
  field.dataset.changedCavityCount = String(state.scene.trace.changedCavityCount);
}

function mapPoint(p, item) {
  const span = Math.min(p.width, p.height) * 0.92;
  return { x: p.width * 0.5 + item.x * span, y: p.height * 0.5 + item.y * span, span };
}

function drawBackground(p) {
  p.background(224, 16, 13);
  p.noStroke();
  for (let index = 0; index < 22; index += 1) {
    const inset = index * Math.min(p.width, p.height) * 0.012;
    p.fill(225 - index * 2.7, 12 + index * 0.8, 17 + index * 0.55, 0.22);
    p.rect(inset * 0.42, inset, p.width - inset * 0.84, p.height - inset * 1.72);
  }
  p.randomSeed(4505);
  p.stroke(75, 13, 93, 0.1);
  p.strokeWeight(0.55);
  for (let index = 0; index < 150; index += 1) {
    const x = p.random(p.width);
    const y = p.random(p.height);
    const length = p.random(2, Math.max(4, Math.min(p.width, p.height) * 0.016));
    p.line(x, y, x + length, y + p.random(-1.2, 1.2));
  }
  p.stroke(101, 12, 91, 0.18);
  p.strokeWeight(0.7);
  p.line(p.width * 0.09, p.height * 0.82, p.width * 0.88, p.height * 0.14);
  p.line(p.width * 0.16, p.height * 0.13, p.width * 0.82, p.height * 0.89);
}

function drawPolygon(p, points, mapper) {
  p.beginShape();
  for (const point of points) {
    const mapped = mapper(point);
    p.vertex(mapped.x, mapped.y);
  }
  p.endShape(p.CLOSE);
}

function drawShell(p, scene) {
  const map = (point, offsetX = 0, offsetY = 0) => {
    const mapped = mapPoint(p, point);
    return { x: mapped.x + offsetX, y: mapped.y + offsetY };
  };
  drawPolygon(p, scene.shell, (point) => map(point, 9, 13));
  p.fill(4, 23, 7, 0.54);
  drawPolygon(p, scene.shell, (point) => map(point, 9, 13));
  p.fill(42, 23, 88, 0.98);
  drawPolygon(p, scene.shell, (point) => map(point));
  p.noFill();
  p.stroke(41, 19, 100, 0.7);
  p.strokeWeight(1.2);
  drawPolygon(p, scene.shell, (point) => map(point));

  p.stroke(13, 27, 100, 0.18);
  p.strokeWeight(0.7);
  for (let index = 0; index < scene.shell.length; index += 1) {
    const a = map(scene.shell[index]);
    const b = map(scene.shell[(index + 3) % scene.shell.length]);
    p.line(a.x, a.y, b.x, b.y);
  }
}

function drawCavity(p, cavity, selected) {
  const point = mapPoint(p, cavity);
  const width = cavity.width * point.span;
  const height = cavity.height * point.span;
  p.push();
  p.translate(point.x, point.y);
  p.rotate(p.radians(cavity.rotation));
  p.noStroke();
  p.fill(6, 25, 7, 0.82);
  p.ellipse(6, 8, width * 1.12, height * 1.18);
  p.fill(selected ? 12 : 224, selected ? 34 : 13, selected ? 89 : 13, 1);
  p.beginShape();
  p.vertex(-width * 0.47, -height * 0.1);
  p.vertex(-width * 0.17, -height * 0.5);
  p.vertex(width * 0.45, -height * 0.28);
  p.vertex(width * 0.37, height * 0.42);
  p.vertex(-width * 0.35, height * 0.5);
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(selected ? 10 : 34, selected ? 50 : 22, selected ? 100 : 72, 0.85);
  p.strokeWeight(selected ? 2.1 : 1.05);
  p.beginShape();
  p.vertex(-width * 0.47, -height * 0.1);
  p.vertex(-width * 0.17, -height * 0.5);
  p.vertex(width * 0.45, -height * 0.28);
  p.vertex(width * 0.37, height * 0.42);
  p.vertex(-width * 0.35, height * 0.5);
  p.endShape(p.CLOSE);
  p.stroke(43, 12, 100, 0.32);
  p.strokeWeight(0.55);
  p.line(-width * 0.25, -height * 0.26, width * 0.25, height * 0.26);
  p.line(width * 0.2, -height * 0.24, -width * 0.19, height * 0.29);
  p.pop();
}

function drawMembrane(p, membrane) {
  const mapped = membrane.points.map((point) => mapPoint(p, point));
  p.noStroke();
  p.fill(10, 48, 83, 0.88);
  p.beginShape();
  for (const point of mapped) p.vertex(point.x + 5, point.y + 7);
  p.endShape(p.CLOSE);
  p.fill(12 + membrane.memoryIndex * 5, 44, 88, 0.96);
  p.beginShape();
  for (const point of mapped) p.vertex(point.x, point.y);
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(membrane.memoryIndex % 2 ? 77 : 9, 57, 100, 0.86);
  p.strokeWeight(1.7);
  p.beginShape();
  for (const point of mapped) p.vertex(point.x, point.y);
  p.endShape(p.CLOSE);
  p.stroke(42, 20, 100, 0.38);
  p.strokeWeight(0.55);
  const centre = mapPoint(p, { x: membrane.points.reduce((sum, point) => sum + point.x, 0) / membrane.points.length, y: membrane.points.reduce((sum, point) => sum + point.y, 0) / membrane.points.length });
  for (const point of mapped) p.line(centre.x, centre.y, point.x, point.y);
}

function drawPressure(p) {
  if (staticMode || !pointer) return;
  p.noFill();
  p.stroke(8, 42, 100, 0.26);
  p.strokeWeight(0.7);
  p.ellipse(pointer.x, pointer.y, Math.min(p.width, p.height) * (pointerActive ? 0.13 : 0.08));
  p.stroke(42, 55, 100, 0.3);
  p.line(pointer.x - 9, pointer.y, pointer.x + 9, pointer.y);
  p.line(pointer.x, pointer.y - 9, pointer.x, pointer.y + 9);
}

function drawField(p) {
  drawBackground(p);
  drawShell(p, state.scene);
  const pendingSite = state.gesture?.site ?? -1;
  for (const cavity of state.scene.cavities) drawCavity(p, cavity, cavity.id === pendingSite || cavity.id === focusIndex);
  for (const membrane of state.scene.membranes) drawMembrane(p, membrane);
  drawPressure(p);
  if (!reducedMotion && !staticMode) {
    p.stroke(78, 28, 100, 0.13);
    p.strokeWeight(0.5);
    const pulse = Math.sin(Date.now() * 0.001) * 2;
    p.line(p.width * 0.16, p.height * 0.11 + pulse, p.width * 0.84, p.height * 0.11 + pulse);
  }
}

function updateState(next) {
  state = next;
  updateReadout();
  renderer?.redraw();
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  const span = Math.min(rect.width, rect.height) * 0.92;
  return {
    x: (event.clientX - rect.left - rect.width * 0.5) / span,
    y: (event.clientY - rect.top - rect.height * 0.5) / span
  };
}

function canvasPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function pressureFrom(event, point) {
  if (event.pressure && event.pressure > 0) return Math.min(1, event.pressure);
  const site = PRESSURE_SITES[state.gesture?.site ?? focusIndex];
  return Math.min(1, 0.58 + Math.hypot(point.x - site.x, point.y - site.y) * 2.7);
}

field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointerActive = true;
  pointer = canvasPoint(event);
  updateState(beginPressure(state, localPoint(event)));
  field.setPointerCapture?.(event.pointerId);
}, { passive: false });

field?.addEventListener('pointermove', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointer = canvasPoint(event);
  if (pointerActive && state.gesture) updateState(pressureSample(state, { ...localPoint(event), pressure: pressureFrom(event, localPoint(event)) }));
  else renderer?.redraw();
}, { passive: false });

function endPointer(event) {
  if (staticMode || !pointerActive) return;
  event.preventDefault();
  pointer = canvasPoint(event);
  if (state.gesture) updateState(pressureSample(state, { ...localPoint(event), pressure: pressureFrom(event, localPoint(event)) }));
  updateState(releasePressure(state));
  pointerActive = false;
  field.releasePointerCapture?.(event.pointerId);
  renderer?.redraw();
}

field?.addEventListener('pointerup', endPointer, { passive: false });
field?.addEventListener('pointercancel', () => { pointerActive = false; pointer = null; renderer?.redraw(); });
field?.addEventListener('pointerleave', () => { if (!pointerActive) { pointer = null; renderer?.redraw(); } });

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % CAVITY_COUNT;
    renderer?.redraw();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + CAVITY_COUNT - 1) % CAVITY_COUNT;
    renderer?.redraw();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    updateState(completeDeterministicPressure());
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatestPressure(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pointerActive = false;
    pointer = null;
    updateState(releaseMemory());
  }
});

document.querySelector('[data-action="ask"]')?.addEventListener('click', () => updateState(completeDeterministicPressure()));
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => updateState(liftLatestPressure(state)));
document.querySelector('[data-action="release"]')?.addEventListener('click', () => updateState(releaseMemory()));

renderer = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, canvasMount?.clientWidth ?? 960);
    const height = Math.max(320, canvasMount?.clientHeight ?? 680);
    const canvas = p.createCanvas(width, height);
    canvas.parent(canvasMount);
    canvas.elt.setAttribute('aria-hidden', 'true');
    canvas.elt.classList.add('pressure-membrane-canvas');
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
window.__mutineNaiveV045 = {
  beginPressure,
  buildFrame,
  buildTimeline,
  cavitySignature,
  completeDeterministicPressure,
  geometrySignature: () => geometrySignature(state),
  getState: () => state,
  liftLatestPressure,
  pressureSample,
  releaseMemory,
  releasePressure,
  renderSignature: () => geometrySignature(state)
};
