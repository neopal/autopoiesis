// sediment-strata renderer: duration turns presence into a compaction rule.
import {
  COLS,
  ROWS,
  CELL_COUNT,
  STAGES,
  MEMORY_LIMIT,
  LOAD_THRESHOLD_MS,
  buildFrame,
  buildTimeline,
  beginCharge,
  updateCharge,
  finishCharge,
  cancelCharge,
  commitCharge,
  defaultCharge,
  liftLatestCharge,
  releaseArchive
} from './engine.mjs';

const frameElement = document.querySelector('.strata-frame');
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
  ground: [9, 16, 20],
  deep: [14, 25, 30],
  clay: [103, 82, 76],
  clayLight: [157, 105, 82],
  mint: [138, 216, 184],
  copper: [225, 138, 87],
  violet: [155, 150, 221],
  ink: [233, 238, 228]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1)
  };
};
const nearestCell = (point) => {
  const col = clamp(Math.floor(point.x * COLS), 0, COLS - 1);
  const row = clamp(Math.floor(point.y * ROWS), 0, ROWS - 1);
  return row * COLS + col;
};
const directionFor = (point) => point.x < 0.5 ? -1 : 1;

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `load ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'stratum' : 'strata'}`;
  rendererElement.textContent = `WEBGPU SIGNAL / WEBGL FALLBACK / SEDIMENT STRATA${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'charge-started') statusElement.textContent = 'presence registered · keep holding';
  else if (action === 'charge-building') statusElement.textContent = `load building · ${Math.round(state.frame.gesture?.dwellMs ?? 0)}ms`;
  else if (action === 'charge-loaded') statusElement.textContent = 'the mass has accepted the load · release';
  else if (action === 'charge-committed') statusElement.textContent = 'the weight arrived after you left · strata compacted';
  else if (action === 'charge-refused-threshold') statusElement.textContent = 'the mass refused a short presence · no layer spent';
  else if (action === 'charge-cancelled') statusElement.textContent = 'presence withdrawn · no ghost layer remains';
  else if (action === 'charge-refused-memory-limit') statusElement.textContent = 'the archive is full · lift a load first';
  else if (action === 'charge-lifted') statusElement.textContent = 'latest load lifted · the prior mass returns';
  else if (action === 'archive-released') statusElement.textContent = 'strata released · the quiet seed returns';
  else statusElement.textContent = blindMode ? '' : 'hold one cell until the mass accepts your weight';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const beginPointer = (event) => {
  if (state.frame.memory.length >= MEMORY_LIMIT || event.target !== state.canvas) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const sourceIndex = nearestCell(point);
  state.pointer = { sourceIndex, direction: directionFor(point), pointerId: event.pointerId };
  setFrame(beginCharge(state.frame, { index: sourceIndex, time: performance.now() }));
  state.canvas.focus({ preventScroll: true });
  state.canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
};

const movePointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  state.pointer.direction = directionFor(point);
  setFrame(updateCharge(state.frame, { index: state.pointer.sourceIndex, time: performance.now() }));
  event.preventDefault();
};

const finishPointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const pointer = state.pointer;
  state.pointer = null;
  setFrame(finishCharge(state.frame, {
    index: pointer.sourceIndex,
    direction: directionFor(point),
    time: performance.now(),
    confirmed: true
  }));
  state.canvas.releasePointerCapture?.(event.pointerId);
  event.preventDefault();
};

const cancelPointer = (event) => {
  if (!state.pointer) return;
  state.pointer = null;
  setFrame(cancelCharge(state.frame));
  state.canvas.releasePointerCapture?.(event.pointerId);
  event.preventDefault();
};

const commitDefaultCharge = () => {
  const choice = defaultCharge(state.frame);
  const direction = state.frame.memory.length % 2 === 0 ? 1 : -1;
  setFrame(commitCharge(state.frame, choice.index, choice.dwellMs, direction, 'default-charge'));
};
const lift = () => setFrame(liftLatestCharge(state.frame));
const release = () => { state.pointer = null; setFrame(releaseArchive()); };

const cellColor = (cell, layer, stateFrame) => {
  const changed = cell.load > 0.02;
  if (changed && layer === cell.layers - 1) return palette.copper;
  if (changed) return cell.porosity > 0.45 ? palette.mint : palette.clayLight;
  if (layer % 3 === 1) return palette.violet;
  return cell.porosity > 0.42 ? palette.clayLight : palette.clay;
};

const drawCell = (p, cell, scale, time, stateFrame) => {
  const cellWidth = scale * 0.132;
  const cellHeight = scale * 0.152;
  const thickness = scale * 0.052;
  const baseZ = -scale * 0.16;
  const animatedShear = state.motion ? Math.sin(time * 0.00023 + cell.phase) * 0.006 : 0;
  const x = cell.x * scale + cell.shear * scale * 0.42;
  const y = cell.y * scale * 0.92;

  p.push();
  p.translate(x, y, 0);
  p.rotateZ(cell.shear * 0.32 + animatedShear);
  for (let layer = 0; layer < cell.layers; layer += 1) {
    const rise = layer * thickness + cell.height * scale * 0.17;
    p.push();
    p.translate(0, 0, baseZ + rise);
    p.ambientMaterial(...cellColor(cell, layer, stateFrame));
    p.box(cellWidth * (0.88 + cell.porosity * 0.06), cellHeight * (0.86 + cell.ridge * 0.05), thickness * 0.86);
    p.pop();
  }
  const capZ = baseZ + cell.layers * thickness + cell.height * scale * 0.17;
  p.push();
  p.translate(0, 0, capZ);
  p.ambientMaterial(...(cell.load > 0.02 ? palette.copper : palette.deep));
  p.box(cellWidth * (0.45 + cell.ridge * 0.34), cellHeight * 0.08, thickness * 0.16);
  p.pop();
  if (cell.load > 0.15) {
    p.stroke(...(cell.load > 0.6 ? palette.ink : palette.mint), 96 + cell.load * 80);
    p.strokeWeight(1.1);
    p.line(-cellWidth * 0.28, -cellHeight * 0.24, capZ + thickness * 0.15, cellWidth * 0.25, cellHeight * 0.18, capZ + thickness * 0.15);
  }
  p.pop();
};

const drawAmbientBed = (p, scale) => {
  p.push();
  p.translate(0, 0, -scale * 0.23);
  p.ambientMaterial(...palette.deep);
  p.box(scale * 2.08, scale * 1.1, scale * 0.045);
  p.pop();

  p.push();
  p.noFill();
  p.stroke(...palette.mint, 26);
  p.strokeWeight(1);
  for (let row = 0; row <= ROWS; row += 1) {
    const y = (row - ROWS / 2) * scale * 0.175;
    p.line(-scale * 0.98, y, -scale * 0.2, scale * 0.98, y, -scale * 0.2);
  }
  p.stroke(...palette.copper, 24);
  for (let column = 0; column <= COLS; column += 1) {
    const x = (column - COLS / 2) * scale * 0.15;
    p.line(x, -scale * 0.52, -scale * 0.19, x, scale * 0.52, -scale * 0.19);
  }
  p.pop();
};

const drawCurrent = (p, field, time) => {
  const scale = Math.min(p.width, p.height) * 0.58;
  p.background(...palette.ground);
  p.ambientLight(78, 88, 96);
  p.directionalLight(196, 232, 218, -0.35, 0.55, -1);
  p.pointLight(225, 138, 87, scale * 0.5, -scale * 0.4, scale * 1.1);
  p.push();
  p.rotateX(0.66);
  p.rotateZ(-0.055 + (state.motion ? Math.sin(time * 0.00011) * 0.012 : 0));
  drawAmbientBed(p, scale);
  field.cells.forEach((cell) => drawCell(p, cell, scale, time, state.frame));
  p.pop();

  if (state.frame.gesture && !blindMode) {
    const source = field.cells[state.frame.gesture.sourceIndex];
    if (source) {
      const x = source.x * scale;
      const y = source.y * scale * 0.92;
      p.push();
      p.noFill();
      p.stroke(...palette.ink, 150);
      p.strokeWeight(1.4);
      p.translate(x, y, scale * 0.02);
      p.rotateX(0.66);
      p.rectMode(p.CENTER);
      p.rect(0, 0, scale * 0.12, scale * 0.14);
      p.pop();
    }
  }
};

const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event })),
  signature: state.frame.field.signature,
  gesture: state.frame.gesture ? { ...state.frame.gesture } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  cellCount: CELL_COUNT,
  columns: COLS,
  rows: ROWS,
  cells: state.frame.field.cells.map((cell) => ({ ...cell })),
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
  memoryLimit: MEMORY_LIMIT,
  loadThresholdMs: LOAD_THRESHOLD_MS
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#strata-field');
    const canvasWidth = Math.max(1, frameElement.clientWidth);
    const canvasHeight = Math.max(1, frameElement.clientHeight);
    const canvas = p.createCanvas(canvasWidth, canvasHeight, p.WEBGL);
    canvas.id('strata-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A stratigraphic mass of stacked cells that compacts when a sustained charge is released');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    canvas.parent(frameElement);
    placeholder?.remove();
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV045 = { getState: exposeState, getFrame: () => state.frame };
    window._p5Ready = true;

    state.canvas.addEventListener('pointerdown', beginPointer);
    state.canvas.addEventListener('pointermove', movePointer);
    state.canvas.addEventListener('pointerup', finishPointer);
    state.canvas.addEventListener('pointercancel', cancelPointer);
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { commitDefaultCharge(); event.preventDefault(); }
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
const chargeButton = document.querySelector('[data-gesture="charge"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [chargeButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
chargeButton?.addEventListener('click', commitDefaultCharge);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
