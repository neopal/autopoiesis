// reciprocal-orbit renderer: a discrete handoff changes a portal the visitor never approached.
import {
  PORTAL_COUNT,
  STAGES,
  MEMORY_LIMIT,
  buildFrame,
  buildTimeline,
  beginApproach,
  updateApproach,
  finishApproach,
  commitHandoff,
  defaultHandoff,
  liftLatestHandoff,
  releaseArchive
} from './engine.mjs';

const frameElement = document.querySelector('.orbit-frame');
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
  ground: [13, 11, 21],
  surface: [21, 18, 33],
  ink: [240, 235, 224],
  mint: [153, 224, 202],
  copper: [243, 155, 112],
  violet: [170, 165, 242],
  dusk: [93, 82, 127]
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
const nearestPortal = (point) => {
  let index = 0;
  let distance = Number.POSITIVE_INFINITY;
  state.frame.field.portals.forEach((portal, candidate) => {
    const next = (point.x - portal.x) ** 2 + (point.y - portal.y) ** 2;
    if (next < distance) { index = candidate; distance = next; }
  });
  return index;
};

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `relay ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'opening' : 'openings'}`;
  rendererElement.textContent = `P5.JS / WEBGL / RECIPROCAL ORBIT${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'approach-started') statusElement.textContent = 'one aperture noticed · hand attention to another';
  else if (action === 'approach-open') statusElement.textContent = 'the pair is listening · no opening spent';
  else if (action === 'approach-returned') statusElement.textContent = 'attention returned to its source · no opening spent';
  else if (action === 'handoff-committed') statusElement.textContent = 'the field answered elsewhere · a third aperture opened';
  else if (action === 'handoff-refused-incomplete') statusElement.textContent = 'the field refused an incomplete handoff · geometry stays exact';
  else if (action === 'handoff-refused-memory-limit') statusElement.textContent = 'the archive is full · lift an opening first';
  else if (action === 'handoff-lifted') statusElement.textContent = 'latest opening lifted · the prior orbit returns';
  else if (action === 'archive-released') statusElement.textContent = 'attention released · the quiet orbit returns';
  else statusElement.textContent = blindMode ? '' : 'approach one aperture, then hand attention to another';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const beginPointer = (event) => {
  if (state.frame.memory.length >= MEMORY_LIMIT || event.target !== state.canvas) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const sourceIndex = nearestPortal(point);
  state.pointer = { sourceIndex, observerIndex: null };
  setFrame(beginApproach(state.frame, { index: sourceIndex, time: performance.now() }));
  state.canvas.focus({ preventScroll: true });
  state.canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
};

const movePointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const observerIndex = nearestPortal(point);
  state.pointer.observerIndex = observerIndex;
  setFrame(updateApproach(state.frame, { index: observerIndex, time: performance.now() }));
  event.preventDefault();
};

const finishPointer = (event) => {
  if (!state.pointer) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const observerIndex = nearestPortal(point);
  const { sourceIndex } = state.pointer;
  state.pointer = null;
  setFrame(finishApproach(state.frame, { observerIndex, confirmed: true }));
  state.canvas.releasePointerCapture?.(event.pointerId);
  if (sourceIndex === observerIndex) setFrame(finishApproach(state.frame, { observerIndex: sourceIndex, confirmed: false }));
  event.preventDefault();
};

const commitDefaultRelay = () => {
  const choice = defaultHandoff(state.frame);
  setFrame(commitHandoff(state.frame, choice.sourceIndex, choice.observerIndex, 'default-relay'));
};
const lift = () => setFrame(liftLatestHandoff(state.frame));
const release = () => { state.pointer = null; setFrame(releaseArchive()); };

const drawArc = (p, radius, start, end, z = 0, weight = 1) => {
  const steps = Math.max(8, Math.ceil(Math.abs(end - start) * 18));
  p.noFill();
  p.strokeWeight(weight);
  p.beginShape();
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = start + (end - start) * t;
    p.vertex(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  }
  p.endShape();
};

const drawVoidWedge = (p, radius, start, end, z = 0) => {
  const steps = Math.max(8, Math.ceil(Math.abs(end - start) * 16));
  p.noStroke();
  p.fill(...palette.ground, 246);
  p.beginShape(p.TRIANGLE_FAN);
  p.vertex(0, 0, z + 0.2);
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + ((end - start) * index) / steps;
    p.vertex(Math.cos(angle) * radius, Math.sin(angle) * radius, z + 0.2);
  }
  p.endShape();
};

const drawPortal = (p, portal, index, scale, time) => {
  const changed = portal.relayCount > 0;
  const drift = state.motion ? Math.sin(time * 0.00024 + portal.pulse) * 0.018 : 0;
  const angle = portal.twist + drift;
  const ringRadius = portal.radius * scale;
  const gap = Math.PI * (portal.opening * 0.5 + 0.12);
  const gapCenter = -Math.PI * 0.5 + portal.aperture * 0.9 + angle;
  const start = gapCenter + gap;
  const end = gapCenter + Math.PI * 2 - gap;
  const z = -portal.depth * scale * 0.1 + index * 0.002;
  p.push();
  p.translate(portal.x * scale, portal.y * scale, z);
  p.rotateZ(angle * 0.25);
  p.stroke(...(changed ? palette.copper : palette.mint), changed ? 230 : 148);
  drawArc(p, ringRadius, start - angle, end - angle, 0, changed ? 2.4 : 1.5);
  p.stroke(...(changed ? palette.copper : palette.violet), changed ? 175 : 98);
  drawArc(p, ringRadius * 0.73, start - angle + 0.16, end - angle - 0.18, 1.2, changed ? 1.3 : 1);
  p.stroke(...palette.ink, changed ? 155 : 48);
  drawArc(p, ringRadius * (0.38 + portal.echo * 0.12), start - angle + 0.3, end - angle - 0.3, 2, 0.8);
  drawVoidWedge(p, ringRadius * 1.08, gapCenter - angle - gap, gapCenter - angle + gap, 3);
  if (changed) {
    p.stroke(...palette.copper, 210);
    drawArc(p, ringRadius * 1.19, gapCenter - angle - gap * 0.72, gapCenter - angle + gap * 0.72, 3.5, 2);
    p.stroke(...palette.ink, 92);
    drawArc(p, ringRadius * 0.21, gapCenter - angle - 1.05, gapCenter - angle + 1.05, 4, 0.9);
  }
  p.pop();
};

const drawBackground = (p, scale) => {
  p.background(...palette.ground);
  p.noFill();
  p.stroke(...palette.violet, 26);
  p.strokeWeight(1);
  for (let ring = 0; ring < 5; ring += 1) {
    const radius = scale * (0.26 + ring * 0.2);
    drawArc(p, radius, -Math.PI * 0.18 + ring * 0.12, Math.PI * 1.1 + ring * 0.08, -scale * 0.02, 1);
  }
  p.stroke(...palette.mint, 18);
  p.beginShape();
  for (let index = 0; index <= 72; index += 1) {
    const angle = (index / 72) * Math.PI * 2;
    p.vertex(Math.cos(angle) * scale * 0.84, Math.sin(angle) * scale * 0.53, -scale * 0.03);
  }
  p.endShape();
  p.stroke(...palette.ink, 46);
  p.strokeWeight(2);
  for (let index = 0; index < 68; index += 1) {
    const x = (Math.sin(index * 18.31 + 0.4) * 0.5 + 0.5) * p.width - p.width / 2;
    const y = (Math.sin(index * 7.17 + 1.7) * 0.5 + 0.5) * p.height - p.height / 2;
    p.point(x, y, -scale * 0.04);
  }
};

const drawCurrent = (p, field, time) => {
  const scale = Math.min(p.width, p.height) * 0.54;
  drawBackground(p, scale);
  p.push();
  p.rotateZ(state.motion ? Math.sin(time * 0.00012) * 0.018 : 0);
  p.stroke(...palette.copper, 84);
  p.strokeWeight(1.3);
  drawArc(p, scale * 0.29, 0.1, Math.PI * 1.74, 0, 1.3);
  p.stroke(...palette.mint, 64);
  drawArc(p, scale * 0.46, Math.PI * 0.72, Math.PI * 2.24, 0, 1.1);
  p.noStroke();
  p.fill(...palette.surface, 232);
  p.ellipse(0, 0, scale * 0.3, scale * 0.18);
  p.stroke(...palette.ink, 126);
  p.noFill();
  drawArc(p, scale * 0.16, -Math.PI * 0.72, Math.PI * 0.84, 1, 1.7);
  field.portals.forEach((portal, index) => drawPortal(p, portal, index, scale, time));
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
  portals: state.frame.field.portals.map((portal) => ({ ...portal })),
  transfers: state.frame.field.transfers.map((transfer) => ({ ...transfer })),
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
  portalCount: PORTAL_COUNT,
  memoryLimit: MEMORY_LIMIT
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#relay-field');
    const canvasWidth = Math.max(1, frameElement.clientWidth);
    const canvasHeight = Math.max(1, frameElement.clientHeight);
    const canvas = p.createCanvas(canvasWidth, canvasHeight, p.WEBGL);
    canvas.id('relay-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A reciprocal orbit field of apertures that stores attention in an unvisited portal');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    canvas.parent(frameElement);
    placeholder?.remove();
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV044 = { getState: exposeState, getFrame: () => state.frame };
    window._p5Ready = true;

    state.canvas.addEventListener('pointerdown', beginPointer);
    state.canvas.addEventListener('pointermove', movePointer);
    state.canvas.addEventListener('pointerup', finishPointer);
    state.canvas.addEventListener('pointercancel', finishPointer);
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { commitDefaultRelay(); event.preventDefault(); }
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
const relayButton = document.querySelector('[data-gesture="relay"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [relayButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
relayButton?.addEventListener('click', commitDefaultRelay);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
