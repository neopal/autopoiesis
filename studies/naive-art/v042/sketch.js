import {
  advanceScan,
  beginScan,
  buildFrame,
  buildTimeline,
  commitScan,
  geometrySignature,
  liftLatestScan,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#wrong-volume');
const canvasMount = document.querySelector('#volume-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = buildFrame();
let pointerScan = null;
let renderer;

function completeDeterministicScan() {
  const direction = timeline[state.memory.length % timeline.length];
  let next = beginScan(state, { direction });
  next = advanceScan(next, { direction, distance: 0.72 });
  next = advanceScan(next, { direction: -direction, distance: 0.74 });
  return commitScan(next);
}

function settledFrame() {
  let frame = buildFrame();
  for (let index = 0; index < 4; index += 1) {
    const direction = timeline[index];
    let next = beginScan(frame, { direction });
    next = advanceScan(next, { direction, distance: 0.72 });
    next = advanceScan(next, { direction: -direction, distance: 0.74 });
    frame = commitScan(next);
  }
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'scan the volume, then reverse',
  'scan-started': 'the model has a direction',
  'scan-advanced': 'the first reading is still latent',
  'scan-reversed': 'reversal registered; release to misread',
  'scan-refused-invalid': 'that scan cannot be read',
  'scan-refused-incomplete': 'one direction is not a correction',
  'scan-committed': 'the model misplaced the depth elsewhere',
  'scan-lifted': 'the last volume error was lifted',
  'memory-released': 'the volume is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl) return;
  stageEl.textContent = `scan ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.changedBlockCount = String(state.scene.trace.changedBlockCount);
  field.dataset.scanReversed = state.scan?.reversed ? 'true' : 'false';
}

function drawVolume(p) {
  p.background(12, 17, 22);
  p.ambientLight(32, 38, 44);
  p.directionalLight(218, 204, 168, -0.35, 0.55, -0.85);
  p.pointLight(239, 121, 90, -2.4, -1.5, 3.4);
  p.pointLight(140, 200, 189, 2.5, 1.3, 2.6);

  p.push();
  p.rotateX(-0.16);
  p.rotateY(-0.26 + (reducedMotion ? 0 : Math.sin(p.frameCount * 0.008) * 0.012));
  p.translate(0, 0.04, 0);

  // The absent core is a black volume, not a label or an interface target.
  p.push();
  p.noStroke();
  p.ambientMaterial(7, 10, 12);
  p.box(0.84, 0.84, 0.84);
  p.pop();

  const palette = [
    [22, 23, 25],
    [32, 29, 27],
    [12, 30, 28],
    [42, 24, 21],
    [28, 36, 33]
  ];
  const rolePalette = {
    misregistered: [48, 24, 20],
    sheared: [18, 38, 35],
    hollowed: [39, 31, 20]
  };

  for (const block of state.scene.blocks) {
    const [hue, sat, brightness] = rolePalette[block.role] ?? palette[block.face];
    p.push();
    p.translate(block.x * 1.16, block.y * 1.16, block.z * 1.06);
    p.rotateX(p.radians(block.rx));
    p.rotateY(p.radians(block.ry));
    p.rotateZ(p.radians(block.rz));
    p.noStroke();
    p.ambientMaterial(hue, sat, brightness);
    p.box(block.width * 1.12, block.height * 1.12, block.depth * 1.12);
    p.stroke(36, 22, 82, 0.42);
    p.strokeWeight(0.8);
    p.noFill();
    p.box(block.width * 1.125, block.height * 1.125, block.depth * 1.125);
    if (block.role !== 'quiet') {
      p.translate(0, 0, block.depth * 0.58);
      p.stroke(hue + 4, sat + 20, Math.min(100, brightness + 28), 0.64);
      p.strokeWeight(1.2);
      p.line(-block.width * 0.35, -block.height * 0.24, block.width * 0.33, block.height * 0.18);
      p.line(-block.width * 0.22, block.height * 0.16, block.width * 0.28, -block.height * 0.24);
    }
    p.pop();
  }
  p.pop();
}

function updateState(next) {
  state = next;
  updateReadout();
  renderer?.redraw();
}

function resetPointer() { pointerScan = null; }

function handlePointerDown(event) {
  if (staticMode) return;
  event.preventDefault();
  pointerScan = { lastY: event.clientY, direction: null };
  try { field?.setPointerCapture?.(event.pointerId); } catch { /* synthetic touch may not expose an active pointer capture */ }
}

function handlePointerMove(event) {
  if (staticMode || !pointerScan) return;
  const delta = event.clientY - pointerScan.lastY;
  if (Math.abs(delta) < 4) return;
  const direction = delta > 0 ? 1 : -1;
  const distance = Math.min(0.92, Math.abs(delta) / 150);
  if (pointerScan.direction === null) {
    pointerScan.direction = direction;
    updateState(beginScan(state, { direction }));
  }
  updateState(advanceScan(state, { direction, distance }));
  pointerScan.lastY = event.clientY;
}

function handlePointerUp(event) {
  if (staticMode || !pointerScan) return;
  event.preventDefault();
  updateState(commitScan(state));
  resetPointer();
}

function commitDeterministic() { if (!staticMode) updateState(completeDeterministicScan()); }

field?.addEventListener('pointerdown', handlePointerDown, { passive: false });
field?.addEventListener('pointermove', handlePointerMove, { passive: false });
field?.addEventListener('pointerup', handlePointerUp, { passive: false });
field?.addEventListener('pointercancel', resetPointer);

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    if (!state.scan) updateState(beginScan(state, { direction }));
    updateState(advanceScan(state, { direction, distance: 0.24 }));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    updateState(state.scan ? commitScan(state) : completeDeterministicScan());
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatestScan(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetPointer();
    updateState(releaseMemory());
  }
});

document.querySelector('[data-action="invert"]')?.addEventListener('click', commitDeterministic);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => updateState(liftLatestScan(state)));
document.querySelector('[data-action="release"]')?.addEventListener('click', () => { resetPointer(); updateState(releaseMemory()); });

renderer = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, canvasMount?.clientWidth ?? 960);
    const height = Math.max(320, canvasMount?.clientHeight ?? 680);
    const canvas = p.createCanvas(width, height, p.WEBGL);
    canvas.parent(canvasMount);
    canvas.elt.setAttribute('aria-hidden', 'true');
    canvas.elt.classList.add('wrong-volume-canvas');
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noLoop();
    p.noStroke();
    p.redraw();
    window._p5Ready = true;
  };
  p.draw = () => drawVolume(p);
  p.windowResized = () => {
    if (!canvasMount) return;
    p.resizeCanvas(Math.max(320, canvasMount.clientWidth), Math.max(320, canvasMount.clientHeight));
    p.redraw();
  };
});

updateReadout();
window._p5Ready = true;
window.__mutineNaiveV042 = {
  advanceScan,
  beginScan,
  buildFrame,
  commitScan,
  geometrySignature,
  getState: () => state,
  renderSignature: () => geometrySignature(state),
  liftLatestScan,
  releaseMemory,
  settledFrame
};
