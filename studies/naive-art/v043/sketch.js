import {
  beginSelection,
  buildFrame,
  buildTimeline,
  commitSelection,
  geometrySignature,
  liftLatestSelection,
  releaseMemory,
  selectWitness
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#false-centre');
const canvasMount = document.querySelector('#consensus-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = buildFrame();
let focusIndex = 0;
let pointerStart = null;
let renderer;

function completeDeterministicQuorum() {
  const witnesses = timeline[state.memory.length % timeline.length];
  let next = beginSelection(state);
  for (const id of witnesses) next = selectWitness(next, id);
  return commitSelection(next);
}

function settledFrame() {
  let frame = buildFrame();
  for (const witnesses of timeline) {
    let next = beginSelection(frame);
    for (const id of witnesses) next = selectWitness(next, id);
    frame = commitSelection(next);
  }
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'attend to three witnesses',
  'selection-started': 'the model is collecting attention',
  'witness-selected': 'one witness is only evidence',
  'quorum-ready': 'three witnesses: ask what was not seen',
  'witness-refused-invalid': 'that witness is not in the field',
  'witness-refused-repeated': 'the model refuses a repeated witness',
  'witness-refused-full': 'the quorum is already full',
  'quorum-refused-incomplete': 'the centre cannot be inferred yet',
  'quorum-committed': 'the model invented a witness at the centre',
  'selection-lifted': 'the last false centre was lifted',
  'memory-released': 'the field is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl) return;
  stageEl.textContent = `quorum ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.pendingCount = String(state.pending.length);
  field.dataset.consensusCount = String(state.scene.trace.consensusCount);
  field.dataset.changedWitnessCount = String(state.scene.trace.changedWitnessCount);
}

function pointFor(p, witness) {
  const span = Math.min(p.width, p.height) * 0.43;
  return { x: p.width * 0.5 + witness.x * span, y: p.height * 0.5 + witness.y * span, span };
}

function drawBackground(p) {
  p.background(258, 30, 6);
  p.noStroke();
  for (let index = 0; index < 20; index += 1) {
    const inset = index * Math.min(p.width, p.height) * 0.018;
    const brightness = 7 + index * 0.3;
    p.fill(258 + index * 0.4, 28, brightness, 0.15);
    p.rect(inset * 0.2, inset, p.width - inset * 0.4, p.height - inset * 2);
  }
  p.stroke(280, 18, 92, 0.08);
  p.strokeWeight(0.6);
  for (let index = -5; index < 12; index += 1) {
    const x = p.width * 0.12 + index * p.width * 0.09;
    p.line(x, p.height * 0.08, x + p.width * 0.24, p.height * 0.92);
  }
}

function drawOrbit(p) {
  const span = Math.min(p.width, p.height) * 0.43;
  p.push();
  p.translate(p.width * 0.5, p.height * 0.5);
  p.noFill();
  for (let loop = 0; loop < 3; loop += 1) {
    p.beginShape();
    const count = 34 + loop * 5;
    for (let index = 0; index <= count; index += 1) {
      const angle = (Math.PI * 2 * index) / count - 0.3 + loop * 0.11;
      const radiusX = span * (0.88 + loop * 0.08) * (1 + Math.sin(index * 1.9 + loop) * 0.025);
      const radiusY = span * (0.64 + loop * 0.09) * (1 + Math.cos(index * 1.4 + loop) * 0.035);
      if ((index + loop * 3) % 9 < 2) continue;
      p.vertex(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY);
    }
    p.endShape();
  }
  p.pop();
}

function drawAperture(p) {
  const span = Math.min(p.width, p.height) * 0.43;
  p.push();
  p.translate(p.width * 0.5, p.height * 0.5);
  p.noStroke();
  p.fill(258, 40, 4, 0.96);
  p.ellipse(0, 0, span * 0.9, span * 0.67);
  p.noFill();
  p.stroke(46, 30, 92, 0.42);
  p.strokeWeight(1.2);
  for (let loop = 0; loop < 4; loop += 1) {
    p.beginShape();
    const count = 12 + loop * 3;
    for (let index = 0; index <= count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + loop * 0.43;
      const wobble = 1 + Math.sin(index * 2.7 + loop * 0.8) * 0.08;
      p.vertex(Math.cos(angle) * span * (0.25 + loop * 0.085) * wobble, Math.sin(angle) * span * (0.18 + loop * 0.062) * wobble);
    }
    p.endShape();
  }
  p.stroke(12, 23, 100, 0.58);
  p.strokeWeight(0.8);
  p.line(-span * 0.12, 0, span * 0.16, 0);
  p.line(0, -span * 0.11, 0, span * 0.14);
  p.pop();
}

function drawWitness(p, witness, selected, focused) {
  const point = pointFor(p, witness);
  const radius = point.span * witness.radius;
  p.push();
  p.translate(point.x, point.y);
  p.rotate(p.radians(witness.rotation));
  if (selected || focused) {
    p.noFill();
    p.stroke(selected ? [14, 45, 96, 0.94] : [34, 24, 92, 0.7]);
    p.strokeWeight(selected ? 2 : 1);
    p.ellipse(0, 0, radius * 2.5, radius * 2.5);
  }
  p.noFill();
  p.stroke(184 + witness.kind * 4, 23 + (witness.kind % 3) * 8, 92, 0.88);
  p.strokeWeight(1.15);
  p.beginShape();
  const count = 6 + (witness.kind % 3);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count - 0.2;
    const wobble = 1 + Math.sin((index + 1) * (witness.kind + 2) * 0.8) * 0.16;
    p.vertex(Math.cos(angle) * radius * wobble, Math.sin(angle) * radius * wobble * 0.75);
  }
  p.endShape(p.CLOSE);
  p.stroke(14, 42, 94, 0.65);
  p.strokeWeight(0.75);
  p.line(-radius * 0.78, radius * 0.15, radius * 0.72, -radius * 0.2);
  p.line(-radius * 0.32, -radius * 0.68, radius * 0.22, radius * 0.66);
  if (witness.kind % 2 === 0) p.arc(0, 0, radius * 1.35, radius * 0.92, 0.4, 4.9);
  else p.arc(0, 0, radius * 1.2, radius * 1.1, 2.1, 5.6);
  p.pop();
}

function drawConsensus(p, consensus) {
  const span = Math.min(p.width, p.height) * 0.43;
  p.push();
  p.translate(p.width * 0.5 + consensus.x * span * 0.12, p.height * 0.5 + consensus.y * span * 0.12);
  p.rotate(p.radians(consensus.rotation));
  p.noFill();
  const hue = [13, 172, 287, 46][consensus.id % 4];
  for (let index = 0; index < consensus.loops.length; index += 1) {
    const loop = consensus.loops[index];
    p.stroke(hue + index * 7, 42 + index * 7, 95 - index * 6, 0.72 - index * 0.1);
    p.strokeWeight(index === 0 ? 2 : 1.15);
    p.beginShape();
    for (const point of loop) p.vertex(point.x * span, point.y * span);
    p.endShape(p.CLOSE);
  }
  p.stroke(hue, 34, 100, 0.52);
  p.strokeWeight(0.8);
  p.line(-consensus.scale * span * 0.3, 0, consensus.scale * span * 0.32, 0);
  p.line(0, -consensus.scale * span * 0.24, 0, consensus.scale * span * 0.28);
  p.pop();
}

function drawField(p) {
  drawBackground(p);
  drawOrbit(p);
  drawAperture(p);
  for (const consensus of state.scene.consensus) drawConsensus(p, consensus);
  const selected = new Set(state.pending);
  for (const witness of state.scene.witnesses) drawWitness(p, witness, selected.has(witness.id), witness.id === focusIndex);
  if (!reducedMotion && !staticMode) {
    p.noFill();
    p.stroke(14, 36, 90, 0.25);
    p.strokeWeight(0.7);
    const pulse = Math.sin(Date.now() * 0.001) * 0.012;
    p.ellipse(p.width * 0.5, p.height * 0.5, p.width * (0.19 + pulse), p.height * (0.14 + pulse));
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

function hitWitness(point) {
  const width = field.clientWidth;
  const height = field.clientHeight;
  const span = Math.min(width, height) * 0.43;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const witness of state.scene.witnesses) {
    const x = width * 0.5 + witness.x * span;
    const y = height * 0.5 + witness.y * span;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < Math.max(28, span * witness.radius * 1.75) && distance < nearestDistance) {
      nearest = witness.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function handlePointerDown(event) {
  if (staticMode) return;
  event.preventDefault();
  pointerStart = localPoint(event);
  try { field.setPointerCapture?.(event.pointerId); } catch { /* synthetic touch may omit active capture */ }
}

function handlePointerUp(event) {
  if (staticMode || !pointerStart) return;
  event.preventDefault();
  const point = localPoint(event);
  if (Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) < 24) {
    const id = hitWitness(point);
    if (id !== null) {
      focusIndex = id;
      updateState(selectWitness(state, id));
    }
  }
  pointerStart = null;
}

field?.addEventListener('pointerdown', handlePointerDown, { passive: false });
field?.addEventListener('pointerup', handlePointerUp, { passive: false });
field?.addEventListener('pointercancel', () => { pointerStart = null; });

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % 12;
    renderer?.redraw();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + 11) % 12;
    renderer?.redraw();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (state.pending.length === 3) updateState(commitSelection(state));
    else updateState(selectWitness(state, focusIndex));
  } else if (event.key === ' ') {
    event.preventDefault();
    if (state.pending.length === 3) updateState(commitSelection(state));
    else updateState(selectWitness(state, focusIndex));
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatestSelection(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pointerStart = null;
    updateState(releaseMemory());
  }
});

document.querySelector('[data-action="ask"]')?.addEventListener('click', () => updateState(completeDeterministicQuorum()));
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => updateState(liftLatestSelection(state)));
document.querySelector('[data-action="release"]')?.addEventListener('click', () => updateState(releaseMemory()));

renderer = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, canvasMount?.clientWidth ?? 960);
    const height = Math.max(320, canvasMount?.clientHeight ?? 680);
    const canvas = p.createCanvas(width, height);
    canvas.parent(canvasMount);
    canvas.elt.setAttribute('aria-hidden', 'true');
    canvas.elt.classList.add('false-centre-canvas');
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
window.__mutineNaiveV043 = {
  beginSelection,
  buildFrame,
  buildTimeline,
  commitSelection,
  getState: () => state,
  geometrySignature: () => geometrySignature(state),
  liftLatestSelection,
  releaseMemory,
  selectWitness,
  completeDeterministicQuorum,
  renderSignature: () => geometrySignature(state)
};
