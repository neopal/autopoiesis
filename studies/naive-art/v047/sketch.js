import {
  MEMORY_LIMIT,
  PRESSURE_THRESHOLD,
  SLOT_COUNT,
  TRAVEL_THRESHOLD,
  beginCorrection,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseCorrection,
  releaseMemory,
  tickCorrection
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#proof-field');
const canvasMount = document.querySelector('#proof-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = staticMode ? timeline.at(-1) : buildFrame();
let focusIndex = 0;
let pointer = null;
let pointerStart = null;
let pointerActive = false;
let renderer;

const statusText = () => ({
  idle: 'drag the correction across, then release',
  'correction-started': 'the answer is travelling',
  'correction-travelling': 'the ledger has not changed',
  'correction-refused-short': 'the correction did not cross enough',
  'correction-refused-pressure': 'the correction was too light',
  'correction-refused-idle': 'the ledger has no correction',
  'correction-refused-target': 'the ledger refuses that fragment',
  'correction-committed': 'the model printed the wrong fragment',
  'correction-lifted': 'the last misprint was lifted',
  'memory-released': 'the ledger is clean again'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl || !memoryEl || !statusEl) return;
  stageEl.textContent = `misprint ${String(state.stage).padStart(2, '0')} / ${String(MEMORY_LIMIT).padStart(2, '0')}`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.misprintCount = String(state.body.misprints.length);
  field.dataset.sourceSlot = String(state.body.trace.lastSourceSlot ?? 'none');
  field.dataset.targetSlot = String(state.body.trace.lastTargetSlot ?? 'none');
}

function canvasPoint(point, p) {
  return { x: point.x - p.width / 2, y: point.y - p.height / 2 };
}

function scaleFor(p) {
  return Math.min(p.width, p.height);
}

function slotPoint(slot, p) {
  const scale = scaleFor(p);
  return {
    x: slot.x * p.width * 0.47,
    y: slot.y * scale * 0.92,
    width: Math.max(18, slot.width * scale * 1.2),
    height: Math.max(34, slot.height * scale * 1.12)
  };
}

function drawBackground(p) {
  p.background(266, 21, 9);
  p.noStroke();
  for (let index = 0; index < 16; index += 1) {
    const size = Math.max(p.width, p.height) * (1.35 - index * 0.045);
    p.fill(264 + index * 2, 19, 11 + index * 0.65, 0.08);
    p.ellipse(-p.width * 0.2, p.height * 0.06, size, size * 0.58);
  }
  p.stroke(52, 10, 96, 0.12);
  p.strokeWeight(0.7);
  for (let index = 0; index < 8; index += 1) {
    const y = -p.height * 0.36 + index * p.height * 0.11;
    p.line(-p.width * 0.45, y, p.width * 0.46, y + p.width * 0.025);
  }
}

function drawRegister(p) {
  const scale = scaleFor(p);
  const left = -p.width * 0.47;
  const right = p.width * 0.47;
  const top = -scale * 0.18;
  const bottom = scale * 0.2;
  p.noStroke();
  p.fill(48, 10, 91, 0.82);
  p.beginShape();
  p.vertex(left, top + 4);
  p.vertex(left + p.width * 0.07, top - 2);
  p.vertex(right - p.width * 0.06, top + 3);
  p.vertex(right, top + 1);
  p.vertex(right - p.width * 0.02, bottom + 4);
  p.vertex(right - p.width * 0.09, bottom - 1);
  p.vertex(left + p.width * 0.08, bottom + 3);
  p.vertex(left, bottom - 3);
  p.endShape(p.CLOSE);

  p.stroke(42, 13, 96, 0.5);
  p.strokeWeight(1);
  p.line(left + 6, top + scale * 0.07, right - 6, top + scale * 0.07);
  p.stroke(9, 62, 95, 0.56);
  p.strokeWeight(1.4);
  p.line(left + p.width * 0.02, bottom - scale * 0.05, right - p.width * 0.02, bottom - scale * 0.05);
  p.stroke(10, 58, 93, 0.4);
  p.strokeWeight(0.7);
  for (let index = 0; index < 11; index += 1) {
    const x = left + index * (right - left) / 10;
    p.line(x, top - 7, x + 5, bottom + 7);
  }
}

function drawFragment(p, slot, index, pendingSource) {
  const point = slotPoint(slot, p);
  const misprinted = slot.role === 'misprinted-slot';
  const active = index === pendingSource;
  p.push();
  p.translate(point.x, point.y);
  p.rotate(p.radians(slot.rotation));

  if (misprinted) {
    p.noStroke();
    p.fill(8, 70, 95, 0.42);
    p.beginShape();
    p.vertex(-point.width * 0.48 + 5, -point.height * 0.48 + 7);
    p.vertex(point.width * 0.5 + 3, -point.height * 0.36 + 7);
    p.vertex(point.width * 0.42 - 1, point.height * 0.48 + 5);
    p.vertex(-point.width * 0.51 + 1, point.height * 0.36 + 5);
    p.endShape(p.CLOSE);
  }

  p.noStroke();
  p.fill(44, 9, 99, 0.96);
  p.beginShape();
  p.vertex(-point.width * 0.5, -point.height * 0.42);
  p.vertex(-point.width * 0.28, -point.height * 0.52);
  p.vertex(point.width * 0.5, -point.height * 0.38);
  p.vertex(point.width * 0.42, point.height * 0.45);
  p.vertex(-point.width * 0.38, point.height * 0.52);
  p.endShape(p.CLOSE);

  p.stroke(misprinted ? 9 : 5, misprinted ? 63 : 12, misprinted ? 92 : 26, 0.8);
  p.strokeWeight(misprinted ? 1.4 : 0.8);
  p.noFill();
  p.beginShape();
  p.vertex(-point.width * 0.5, -point.height * 0.42);
  p.vertex(-point.width * 0.28, -point.height * 0.52);
  p.vertex(point.width * 0.5, -point.height * 0.38);
  p.vertex(point.width * 0.42, point.height * 0.45);
  p.vertex(-point.width * 0.38, point.height * 0.52);
  p.endShape(p.CLOSE);

  const phase = slot.phase * 5.8;
  p.stroke(266, 17, 25, 0.76);
  p.strokeWeight(1.1);
  for (let bar = 0; bar < 4; bar += 1) {
    const y = -point.height * 0.25 + bar * point.height * 0.16;
    const width = point.width * (0.24 + ((bar + index) % 3) * 0.13);
    const offset = ((phase + bar * 0.21) % 1 - 0.5) * point.width * 0.14;
    p.line(-width * 0.5 + offset, y, width * 0.5 + offset, y + (bar % 2 ? 1 : -1));
  }

  if (misprinted) {
    p.stroke(8, 67, 96, 0.95);
    p.strokeWeight(1.2);
    const scar = point.width * (0.26 + slot.misprintDepth * 3);
    p.line(-scar, point.height * 0.63, scar, point.height * 0.63 + 2);
    p.line(-scar * 0.72, point.height * 0.63 + 5, scar * 0.72, point.height * 0.63 + 5);
    p.stroke(55, 15, 93, 0.78);
    p.line(point.width * 0.5 + 5, -point.height * 0.35, point.width * 0.5 + 10, point.height * 0.35);
  }

  if (active && !staticMode) {
    p.noFill();
    p.stroke(56, 36, 96, 0.86);
    p.strokeWeight(1.5);
    p.rect(-point.width * 0.6, -point.height * 0.62, point.width * 1.2, point.height * 1.24);
  }
  p.pop();
}

function drawCorrectionPath(p) {
  if (staticMode || !pointerActive || !pointerStart || !pointer) return;
  const start = canvasPoint(pointerStart, p);
  const end = canvasPoint(pointer, p);
  p.push();
  p.noFill();
  p.stroke(56, 36, 96, 0.74);
  p.strokeWeight(1.2);
  p.drawingContext.setLineDash([5, 6]);
  p.line(start.x, start.y, end.x, end.y);
  p.drawingContext.setLineDash([]);
  p.fill(56, 36, 96, 0.9);
  p.noStroke();
  p.ellipse(end.x, end.y, 7, 7);
  p.pop();
}

function drawField(p) {
  drawBackground(p);
  p.push();
  p.translate(p.width / 2, p.height / 2 + p.height * 0.02);
  drawRegister(p);
  const pendingSource = state.pending?.active ? state.pending.sourceSlot : -1;
  state.body.slots.forEach((slot, index) => drawFragment(p, slot, index, pendingSource));
  drawCorrectionPath(p);
  if (!reducedMotion && !staticMode) {
    p.stroke(9, 61, 95, 0.2);
    p.strokeWeight(0.7);
    p.line(-p.width * 0.39, p.height * 0.34, p.width * 0.35, -p.height * 0.27);
  }
  p.pop();
}

function updateState(next) {
  state = next;
  updateReadout();
  renderer?.redraw();
}

function completeDeterministicCorrection() {
  if (staticMode) return;
  const sourceSlot = [0, 2, 4, 6][state.memory.length % 4];
  let next = beginCorrection(state, sourceSlot);
  next = tickCorrection(next, TRAVEL_THRESHOLD, Math.max(PRESSURE_THRESHOLD, 0.68));
  updateState(releaseCorrection(next));
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function nearestSlot(event) {
  const point = localPoint(event);
  const rect = field.getBoundingClientRect();
  const scale = Math.min(rect.width, rect.height);
  const x = (point.x - rect.width * 0.5) / (rect.width * 0.47);
  const y = (point.y - rect.height * 0.5) / (scale * 0.92);
  let best = 0;
  let bestDistance = Infinity;
  state.body.slots.forEach((slot, index) => {
    const distance = Math.hypot(x - slot.x, y - slot.y);
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointerActive = true;
  pointerStart = localPoint(event);
  pointer = pointerStart;
  focusIndex = nearestSlot(event);
  updateState(beginCorrection(state, focusIndex));
  field.setPointerCapture?.(event.pointerId);
}, { passive: false });

field?.addEventListener('pointermove', (event) => {
  if (staticMode || !pointerActive || !pointerStart) return;
  event.preventDefault();
  pointer = localPoint(event);
  const rect = field.getBoundingClientRect();
  const travel = Math.min(1.6, Math.hypot(pointer.x - pointerStart.x, pointer.y - pointerStart.y) / rect.width);
  const pressure = event.pressure > 0 ? event.pressure : 0.7;
  updateState(tickCorrection(state, travel, pressure));
}, { passive: false });

function endPointer(event) {
  if (staticMode || !pointerActive || !pointerStart) return;
  event.preventDefault();
  pointer = localPoint(event);
  const rect = field.getBoundingClientRect();
  const travel = Math.min(1.6, Math.hypot(pointer.x - pointerStart.x, pointer.y - pointerStart.y) / rect.width);
  const pressure = event.pressure > 0 ? event.pressure : 0.7;
  let next = tickCorrection(state, travel, pressure);
  next = releaseCorrection(next);
  pointerActive = false;
  pointerStart = null;
  updateState(next);
  field.releasePointerCapture?.(event.pointerId);
}

field?.addEventListener('pointerup', endPointer, { passive: false });
field?.addEventListener('pointercancel', () => {
  pointerActive = false;
  pointerStart = null;
  pointer = null;
  updateState(buildFrame());
});
field?.addEventListener('pointerleave', () => { if (!pointerActive) { pointer = null; renderer?.redraw(); } });

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % SLOT_COUNT;
    renderer?.redraw();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + SLOT_COUNT - 1) % SLOT_COUNT;
    renderer?.redraw();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    completeDeterministicCorrection();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatest(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pointerActive = false;
    pointerStart = null;
    pointer = null;
    updateState(releaseMemory(state));
  }
});

document.querySelector('[data-action="correct"]')?.addEventListener('click', completeDeterministicCorrection);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => updateState(liftLatest(state)));
document.querySelector('[data-action="release"]')?.addEventListener('click', () => updateState(releaseMemory(state)));

renderer = new p5((p) => {
  p.setup = () => {
    const width = Math.max(1, canvasMount?.clientWidth ?? 960);
    const height = Math.max(1, canvasMount?.clientHeight ?? 680);
    const canvas = p.createCanvas(width, height);
    canvas.parent(canvasMount);
    canvas.elt.setAttribute('aria-hidden', 'true');
    canvas.elt.classList.add('proof-ledger-canvas');
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noLoop();
    p.redraw();
    window._p5Ready = true;
  };
  p.draw = () => drawField(p);
  p.windowResized = () => {
    if (!canvasMount) return;
    p.resizeCanvas(Math.max(1, canvasMount.clientWidth), Math.max(1, canvasMount.clientHeight));
    p.redraw();
  };
});

updateReadout();
window._p5Ready = true;
window.__mutineNaiveV047 = {
  beginCorrection,
  buildFrame,
  buildTimeline,
  geometrySignature: () => geometrySignature(state),
  getState: () => state,
  liftLatest,
  releaseCorrection,
  releaseMemory,
  tickCorrection,
  completeDeterministicCorrection
};
