// resistance-membrane renderer: a 3D material body whose remote facet changes production.
import {
  STAGES,
  CELL_COUNT,
  RESISTANCE_THRESHOLD,
  SPAN_THRESHOLD,
  buildFrame,
  buildTimeline,
  beginTrace,
  updateTrace,
  finishTrace,
  liftLatestTrace,
  releaseArchive,
  defaultTrace
} from './engine.mjs';

const frameElement = document.querySelector('.membrane-frame');
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
  pointer: null
};

const palette = {
  ground: [11, 16, 22],
  shadow: [4, 8, 13],
  deep: [28, 43, 49],
  ink: [223, 235, 222],
  mint: [156, 218, 185],
  copper: [232, 143, 89],
  violet: [150, 144, 220]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
    y: clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
  };
};

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `trace ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'transfer' : 'transfers'}`;
  rendererElement.textContent = `P5.JS / WEBGL / RESISTANCE MEMBRANE${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'trace-started') statusElement.textContent = 'passage started · the membrane stays exact';
  else if (action === 'trace-open') statusElement.textContent = 'the grain is not crossed · no facet changes';
  else if (action === 'trace-armed') statusElement.textContent = 'resistance crossed · release to transfer material elsewhere';
  else if (action === 'trace-committed') statusElement.textContent = 'resistance transferred · an untouched facet re-formed';
  else if (action === 'trace-refused-resistance') statusElement.textContent = 'the membrane refused the passage · geometry stays exact';
  else if (action === 'trace-refused-memory-limit') statusElement.textContent = 'material memory full · lift a transfer first';
  else if (action === 'trace-lifted') statusElement.textContent = 'latest transfer lifted · the prior membrane returns';
  else if (action === 'archive-released') statusElement.textContent = 'material released · the quiet membrane returns';
  else statusElement.textContent = blindMode ? '' : 'find the grain, then cross its resistance';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const alignmentFor = (pointer, point) => {
  const dx = point.x - pointer.last.x;
  const dy = point.y - pointer.last.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return pointer.alignment;
  const angle = Math.atan2(dy, dx);
  const cell = state.frame.field.cells[pointer.sourceIndex];
  const grainAngle = 0.28 + (cell?.twist ?? 0) * 0.18;
  const directionalFit = Math.abs(Math.cos(angle - grainAngle));
  return clamp(0.38 + directionalFit * 0.62, 0, 1);
};

const beginPointer = (event) => {
  if (state.frame.memory.length >= 4 || event.target !== state.canvas) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const started = beginTrace(state.frame, { ...point, time: performance.now() });
  state.pointer = {
    start: point,
    last: point,
    sourceIndex: started.gesture.sourceIndex,
    pathLength: 0,
    alignmentTotal: 0,
    alignmentSamples: 0
  };
  setFrame(started);
  state.canvas.focus({ preventScroll: true });
  state.canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
};

const movePointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const distance = Math.hypot(point.x - state.pointer.last.x, point.y - state.pointer.last.y);
  state.pointer.pathLength += distance;
  state.pointer.alignmentTotal += alignmentFor(state.pointer, point);
  state.pointer.alignmentSamples += 1;
  const alignment = state.pointer.alignmentTotal / state.pointer.alignmentSamples;
  state.pointer.last = point;
  setFrame(updateTrace(state.frame, {
    ...point,
    time: performance.now(),
    span: clamp(state.pointer.pathLength, 0, 1.25),
    alignment
  }));
  event.preventDefault();
};

const finishPointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const distance = Math.hypot(point.x - state.pointer.last.x, point.y - state.pointer.last.y);
  state.pointer.pathLength += distance;
  if (distance > 0.0001) {
    state.pointer.alignmentTotal += alignmentFor(state.pointer, point);
    state.pointer.alignmentSamples += 1;
  }
  const alignment = state.pointer.alignmentSamples ? state.pointer.alignmentTotal / state.pointer.alignmentSamples : 0;
  const span = clamp(state.pointer.pathLength, 0, 1.25);
  state.pointer.last = point;
  state.pointer = null;
  setFrame(finishTrace(state.frame, { span, alignment, confirmed: true }));
  state.canvas.releasePointerCapture?.(event.pointerId);
  event.preventDefault();
};

const commitDefaultTrace = () => {
  const preset = defaultTrace(state.frame);
  const started = beginTrace(state.frame, { index: preset.index, time: 0, direction: preset.direction });
  setFrame(finishTrace(started, { ...preset, confirmed: true }));
};

const lift = () => setFrame(liftLatestTrace(state.frame));
const release = () => { state.pointer = null; setFrame(releaseArchive()); };

const rotatePoint = (cell, localX, localY, scale, zOffset = 0) => {
  const angle = cell.twist;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cell.x * scale + (localX * cos - localY * sin) * scale,
    y: cell.y * scale + (localX * sin + localY * cos) * scale,
    z: (cell.z + zOffset) * scale + (localX * 0.03 + localY * cell.warp * 0.08) * scale
  };
};

const drawTriangle = (p, a, b, c, color, alpha = 255) => {
  p.noStroke();
  p.fill(...color, alpha);
  p.beginShape(p.TRIANGLES);
  p.vertex(a.x, a.y, a.z);
  p.vertex(b.x, b.y, b.z);
  p.vertex(c.x, c.y, c.z);
  p.endShape();
};

const drawCell = (p, cell, index, scale, time) => {
  const w = cell.width * 0.62;
  const h = cell.height * 0.62;
  const depth = 0.045 + cell.resistance * 0.12;
  const front = [
    rotatePoint(cell, -w, -h, scale),
    rotatePoint(cell, w, -h * 0.88, scale),
    rotatePoint(cell, w * 0.88, h, scale),
    rotatePoint(cell, -w * 0.92, h * 0.86, scale)
  ];
  const back = front.map((point) => ({ ...point, z: point.z - depth * scale }));
  const center = {
    x: front.reduce((sum, point) => sum + point.x, 0) / 4,
    y: front.reduce((sum, point) => sum + point.y, 0) / 4,
    z: front.reduce((sum, point) => sum + point.z, 0) / 4 + cell.ridge * scale * 0.08
  };
  const changed = cell.resistance > 0.01;
  const baseColor = changed ? palette.copper : (index % 3 === 0 ? palette.mint : index % 3 === 1 ? palette.violet : palette.deep);
  const secondary = changed ? [246, 184, 113] : [84 + (index % 3) * 18, 106 + (index % 4) * 14, 114 + (index % 3) * 18];
  const shimmer = state.motion ? Math.sin(time * 0.00045 + cell.phase) * 0.05 : 0;

  p.noStroke();
  p.fill(...palette.shadow, 205);
  p.beginShape(p.QUADS);
  back.forEach((point) => p.vertex(point.x, point.y, point.z));
  p.endShape();
  p.fill(...secondary, 155);
  p.beginShape(p.QUADS);
  p.vertex(front[0].x, front[0].y, front[0].z); p.vertex(front[1].x, front[1].y, front[1].z); p.vertex(back[1].x, back[1].y, back[1].z); p.vertex(back[0].x, back[0].y, back[0].z);
  p.vertex(front[1].x, front[1].y, front[1].z); p.vertex(front[2].x, front[2].y, front[2].z); p.vertex(back[2].x, back[2].y, back[2].z); p.vertex(back[1].x, back[1].y, back[1].z);
  p.vertex(front[2].x, front[2].y, front[2].z); p.vertex(front[3].x, front[3].y, front[3].z); p.vertex(back[3].x, back[3].y, back[3].z); p.vertex(back[2].x, back[2].y, back[2].z);
  p.vertex(front[3].x, front[3].y, front[3].z); p.vertex(front[0].x, front[0].y, front[0].z); p.vertex(back[0].x, back[0].y, back[0].z); p.vertex(back[3].x, back[3].y, back[3].z);
  p.endShape();

  drawTriangle(p, front[0], front[1], center, baseColor, 226);
  drawTriangle(p, front[1], front[2], center, secondary, 214);
  drawTriangle(p, front[2], front[3], center, baseColor, 232);
  drawTriangle(p, front[3], front[0], center, changed ? palette.copper : palette.ink, 190);

  p.noFill();
  p.stroke(...(changed ? palette.copper : palette.mint), changed ? 190 : 100);
  p.strokeWeight(Math.max(1, scale * 0.006));
  p.beginShape(p.LINE_LOOP);
  front.forEach((point) => p.vertex(point.x, point.y, point.z + scale * 0.002));
  p.endShape();
  p.stroke(...palette.ink, changed ? 160 : 52);
  p.strokeWeight(Math.max(1, scale * 0.003));
  p.line(front[0].x, front[0].y, front[0].z, front[2].x, front[2].y, front[2].z);
  if (cell.facetCount > 4) {
    p.stroke(...palette.copper, 100 + Math.min(110, cell.facetCount * 8));
    p.line(front[1].x, front[1].y, front[1].z, front[3].x, front[3].y, front[3].z);
    for (let ridge = 0; ridge < Math.min(3, cell.facetCount - 4); ridge += 1) {
      const mix = (ridge + 1) / (Math.min(3, cell.facetCount - 4) + 1);
      const left = { x: front[0].x * (1 - mix) + center.x * mix, y: front[0].y * (1 - mix) + center.y * mix, z: front[0].z * (1 - mix) + center.z * mix };
      const right = { x: front[2].x * (1 - mix) + center.x * mix, y: front[2].y * (1 - mix) + center.y * mix, z: front[2].z * (1 - mix) + center.z * mix };
      p.line(left.x, left.y, left.z, right.x, right.y, right.z);
    }
  }
  if (Math.abs(shimmer) > 0) {
    p.stroke(...palette.ink, 28);
    p.line(center.x, center.y, center.z, center.x, center.y, center.z + shimmer * scale);
  }
};

const drawCurrent = (p, field, time) => {
  const scale = Math.min(p.width, p.height) * 0.42;
  p.background(...palette.ground);
  p.ambientLight(44, 55, 58);
  p.directionalLight(160, 214, 190, -0.35, -0.55, -1);
  p.directionalLight(214, 120, 84, 0.55, 0.3, -0.5);

  p.push();
  p.translate(0, 0, -scale * 0.7);
  p.noStroke();
  p.fill(...palette.shadow, 170);
  p.plane(scale * 3.4, scale * 2.2);
  p.pop();

  p.push();
  p.rotateX(-0.22 + (state.motion ? Math.sin(time * 0.00018) * 0.025 : 0));
  p.rotateY(-0.2 + (state.motion ? Math.cos(time * 0.00016) * 0.04 : 0));
  p.rotateZ(0.04);
  const cells = field.cells;
  for (let index = 0; index < cells.length; index += 1) {
    const next = cells[(index + 1) % cells.length];
    const current = cells[index];
    if (index < cells.length - 1) {
      p.stroke(...palette.mint, 26 + (current.resistance + next.resistance) * 50);
      p.strokeWeight(Math.max(1, scale * 0.002));
      p.line(current.x * scale, current.y * scale, current.z * scale, next.x * scale, next.y * scale, next.z * scale);
    }
  }
  cells.forEach((cell, index) => drawCell(p, cell, index, scale, time));
  p.pop();

  p.push();
  p.noFill();
  p.stroke(...palette.violet, 22);
  p.strokeWeight(1);
  for (let ring = 0; ring < 4; ring += 1) {
    const radius = scale * (0.88 + ring * 0.1);
    p.ellipse(0, 0, radius, radius * 0.36);
  }
  p.pop();
};

const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event })),
  signature: state.frame.field.signature,
  gesture: state.frame.gesture ? { ...state.frame.gesture } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  cells: state.frame.field.cells.map((cell) => ({ ...cell })),
  transfers: state.frame.field.transfers.map((transfer) => ({ ...transfer })),
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
  cellCount: CELL_COUNT,
  resistanceThreshold: RESISTANCE_THRESHOLD,
  spanThreshold: SPAN_THRESHOLD
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#resistance-field');
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight), p.WEBGL);
    canvas.id('resistance-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A suspended three-dimensional membrane of faceted cells that stores resistance in a remote facet');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    canvas.parent(frameElement);
    placeholder?.remove();
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV043 = { getState: exposeState, getFrame: () => state.frame };

    state.canvas.addEventListener('pointerdown', beginPointer);
    state.canvas.addEventListener('pointermove', movePointer);
    state.canvas.addEventListener('pointerup', finishPointer);
    state.canvas.addEventListener('pointercancel', finishPointer);
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { commitDefaultTrace(); event.preventDefault(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { lift(); event.preventDefault(); }
      if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { release(); event.preventDefault(); }
    });
  };
  p.draw = () => drawCurrent(p, state.frame.field, p.millis());
  p.windowResized = () => {
    if (!frameElement) return;
    p.resizeCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    p.redraw();
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const traceButton = document.querySelector('[data-gesture="trace"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [traceButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
traceButton?.addEventListener('click', commitDefaultTrace);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
