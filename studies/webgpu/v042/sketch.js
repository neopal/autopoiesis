// shadow-quorum renderer: a moving witness field whose archive appears remotely.
import {
  STAGES,
  WITNESS_COUNT,
  LOOP_THRESHOLD,
  CLOSURE_LIMIT,
  buildFrame,
  buildTimeline,
  beginCircuit,
  updateCircuit,
  finishCircuit,
  liftLatestCircuit,
  releaseArchive,
  defaultCircuit
} from './engine.mjs';

const frameElement = document.querySelector('.shadow-frame');
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  motion: !(staticMode || reducedMotion),
  canvas: null,
  p: null,
  raster: null,
  pointer: null
};

const palette = {
  ground: [16, 13, 24],
  deep: [28, 22, 42],
  ink: [238, 230, 213],
  lilac: [185, 166, 223],
  acid: [200, 220, 132],
  coral: [225, 132, 105],
  shadow: [8, 6, 15]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return { x: clamp((clientX - rect.left) / rect.width, 0, 1), y: clamp((clientY - rect.top) / rect.height, 0, 1) };
};

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `circuit ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'shadow' : 'shadows'}`;
  rendererElement.textContent = `P5.JS / CANVAS 2D / SHADOW QUORUM${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'circuit-started') statusElement.textContent = 'the circuit is open · witnesses stay exact';
  else if (action === 'circuit-open') statusElement.textContent = 'the return is incomplete · no shadow enters the archive';
  else if (action === 'circuit-armed') statusElement.textContent = 'return detected · release to cast elsewhere';
  else if (action === 'circuit-committed') statusElement.textContent = 'shadow quorum committed · the unobserved witness changed';
  else if (action === 'circuit-refused-open') statusElement.textContent = 'the circuit stayed open · nothing entered the archive';
  else if (action === 'circuit-refused-memory-limit') statusElement.textContent = 'archive full · lift a shadow first';
  else if (action === 'circuit-lifted') statusElement.textContent = 'latest shadow lifted · the prior field returns';
  else if (action === 'archive-released') statusElement.textContent = 'archive released · the quiet current returns';
  else statusElement.textContent = blindMode ? '' : 'close the circuit, then return to its beginning';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const arcFromPointer = (pointer, point) => {
  const before = Math.atan2(pointer.last.y - 0.5, pointer.last.x - 0.5);
  const after = Math.atan2(point.y - 0.5, point.x - 0.5);
  const delta = Math.atan2(Math.sin(after - before), Math.cos(after - before));
  pointer.signedSweep += delta;
  const closure = Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) / 0.72;
  return {
    arc: clamp(Math.abs(pointer.signedSweep) / (Math.PI * 2), 0, 1.45),
    closure: clamp(closure, 0, 1),
    direction: pointer.signedSweep < 0 ? -1 : 1
  };
};

const beginPointer = (event) => {
  if (state.frame.memory.length >= 4 || event.target !== state.canvas) return;
  const point = pointFromClient(event.clientX, event.clientY);
  state.pointer = { start: point, last: point, signedSweep: 0, pathLength: 0 };
  setFrame(beginCircuit(state.frame, { ...point, time: performance.now() }));
  state.canvas.focus({ preventScroll: true });
  state.canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
};

const movePointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  state.pointer.pathLength += Math.hypot(point.x - state.pointer.last.x, point.y - state.pointer.last.y);
  const circuit = arcFromPointer(state.pointer, point);
  state.pointer.last = point;
  setFrame(updateCircuit(state.frame, { ...point, ...circuit, time: performance.now() }));
  event.preventDefault();
};

const finishPointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const circuit = arcFromPointer(state.pointer, point);
  state.pointer.last = point;
  state.pointer = null;
  setFrame(finishCircuit(state.frame, { ...circuit, confirmed: true }));
  state.canvas.releasePointerCapture?.(event.pointerId);
  event.preventDefault();
};

const commitDefaultCircuit = () => {
  const preset = defaultCircuit(state.frame);
  const started = beginCircuit(state.frame, { x: preset.x, y: preset.y, time: 0, direction: preset.direction });
  setFrame(finishCircuit(started, { ...preset, confirmed: true }));
};

const lift = () => setFrame(liftLatestCircuit(state.frame));
const release = () => { state.pointer = null; setFrame(releaseArchive()); };

const drawCurrent = (g, field, t) => {
  const w = g.width;
  const h = g.height;
  g.background(...palette.ground);
  for (let band = 0; band < 28; band += 1) {
    const y = h * (0.08 + band * 0.032);
    g.stroke(45 + band, 32 + band * 0.5, 65 + band * 0.8, 30);
    g.strokeWeight(Math.max(1, h * 0.001));
    g.line(0, y, w, y + Math.sin(band * 0.7) * h * 0.01);
  }
  g.noStroke();
  g.fill(...palette.shadow, 180);
  g.ellipse(w * 0.52, h * 0.53, w * 0.27, h * 0.44);
  g.noFill();
  g.stroke(...palette.lilac, 36);
  g.strokeWeight(Math.max(1, w * 0.001));
  g.ellipse(w * 0.52, h * 0.53, w * 0.31, h * 0.5);

  for (let pass = 0; pass < 3; pass += 1) {
    g.noFill();
    g.stroke(pass === 1 ? [...palette.acid, 38] : [...palette.lilac, 28]);
    g.strokeWeight(Math.max(1, w * (pass === 1 ? 0.003 : 0.001)));
    g.beginShape();
    field.witnesses.forEach((witness, index) => {
      const drift = state.motion ? Math.sin(t * 0.00022 + witness.phase + pass * 0.7) * w * 0.008 : 0;
      const sway = state.motion ? Math.cos(t * 0.00016 + witness.phase) * h * 0.006 : 0;
      const x = witness.x * w + drift + (pass - 1) * w * 0.014;
      const y = witness.y * h + sway + Math.sin(index * 0.8 + pass) * h * 0.004;
      g.curveVertex(x, y);
    });
    g.endShape();
  }

  field.shadows.forEach((shadow, serial) => {
    const receiver = field.witnesses[shadow.receiverIndex];
    if (!receiver) return;
    const x = receiver.x * w;
    const y = receiver.y * h;
    const castDirection = shadow.direction * -1;
    const length = Math.min(w, h) * (0.14 + shadow.tension * 0.14);
    g.push();
    g.translate(x, y);
    g.rotate(receiver.angle + castDirection * 0.5);
    for (let echo = 0; echo < 5; echo += 1) {
      const offset = echo * length * 0.18;
      g.stroke(...(echo % 2 ? palette.coral : palette.lilac), 26 + shadow.tension * 34 - echo * 4);
      g.strokeWeight(Math.max(1, w * (0.0028 - echo * 0.00035)));
      g.line(castDirection * (offset + length * 0.08), -length * 0.32 + echo * 2, castDirection * (offset + length), length * 0.32 - echo * 2);
    }
    g.pop();
    g.noFill();
    g.stroke(...palette.coral, 70);
    g.strokeWeight(Math.max(1, w * 0.0015));
    g.arc(x, y, receiver.size * w * 3.8, receiver.size * w * 3.8, shadow.direction < 0 ? 0.3 : 3.4, shadow.direction < 0 ? 2.8 : 5.9);
  });

  field.witnesses.forEach((witness, index) => {
    const drift = state.motion ? Math.sin(t * 0.00022 + witness.phase) * w * 0.008 : 0;
    const sway = state.motion ? Math.cos(t * 0.00016 + witness.phase) * h * 0.006 : 0;
    const x = witness.x * w + drift;
    const y = witness.y * h + sway;
    const size = Math.min(w, h) * witness.size;
    const angle = witness.angle + (state.motion ? Math.sin(t * 0.00026 + witness.phase) * 0.035 : 0);
    g.push();
    g.translate(x, y);
    g.rotate(angle);
    g.noStroke();
    g.fill(...palette.deep, 185);
    g.beginShape();
    g.vertex(-size * 0.8, -size * 0.15);
    g.vertex(-size * 0.25, -size * 0.62);
    g.vertex(size * 0.82, -size * 0.28);
    g.vertex(size * 0.54, size * 0.45);
    g.vertex(-size * 0.48, size * 0.62);
    g.endShape(g.CLOSE);
    g.stroke(...(witness.echo > 0.4 ? palette.coral : palette.lilac), 90 + witness.opacity * 70);
    g.strokeWeight(Math.max(1, w * 0.0015));
    g.noFill();
    g.beginShape();
    g.vertex(-size * 0.8, -size * 0.15);
    g.vertex(-size * 0.25, -size * 0.62);
    g.vertex(size * 0.82, -size * 0.28);
    g.vertex(size * 0.54, size * 0.45);
    g.vertex(-size * 0.48, size * 0.62);
    g.endShape(g.CLOSE);
    g.stroke(...palette.acid, 35 + witness.wake * 95);
    g.line(-size * 1.4, size * 0.08, -size * 0.55, size * 0.08);
    g.pop();
  });

  for (let grain = 0; grain < 500; grain += 1) {
    const gx = (Math.sin(grain * 17.31 + 2.1) * 0.5 + 0.5) * w;
    const gy = (Math.sin(grain * 7.71 + 1.4) * 0.5 + 0.5) * h;
    g.stroke(...(grain % 5 === 0 ? palette.acid : palette.lilac), 10 + (grain % 22));
    g.strokeWeight(grain % 9 === 0 ? 1.4 : 0.7);
    g.point(gx, gy);
  }
};

const renderField = (p) => {
  const t = p.millis();
  state.raster.clear();
  drawCurrent(state.raster, state.frame.field, t);
  p.image(state.raster, 0, 0);
};

const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event })),
  signature: state.frame.field.signature,
  gesture: state.frame.gesture ? { ...state.frame.gesture } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  witnesses: state.frame.field.witnesses.map((witness) => ({ ...witness })),
  shadows: state.frame.field.shadows.map((shadow) => ({ ...shadow })),
  sourceIndex: state.frame.field.sourceIndex,
  receiverIndex: state.frame.field.receiverIndex,
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
  witnessCount: WITNESS_COUNT,
  loopThreshold: LOOP_THRESHOLD,
  closureLimit: CLOSURE_LIMIT
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#shadow-field');
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    canvas.id('shadow-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'Eighteen drifting witness shards with remote shadows in a dark kinetic field');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    placeholder?.replaceWith(canvas.elt);
    p.pixelDensity(1);
    state.raster = p.createGraphics(p.width, p.height);
    state.raster.pixelDensity(1);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV042 = { getState: exposeState, getFrame: () => state.frame };

    state.canvas.addEventListener('pointerdown', beginPointer);
    state.canvas.addEventListener('pointermove', movePointer);
    state.canvas.addEventListener('pointerup', finishPointer);
    state.canvas.addEventListener('pointercancel', finishPointer);
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { commitDefaultCircuit(); event.preventDefault(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { lift(); event.preventDefault(); }
      if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { release(); event.preventDefault(); }
    });
  };
  p.draw = () => renderField(p);
  p.windowResized = () => {
    if (!frameElement) return;
    p.resizeCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    state.raster?.resizeCanvas(p.width, p.height);
    p.redraw();
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const circuitButton = document.querySelector('[data-gesture="circuit"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [circuitButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
circuitButton?.addEventListener('click', commitDefaultCircuit);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
