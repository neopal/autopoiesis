import {
  CELL_COUNT,
  STAGES,
  armSweep,
  buildTimeline,
  defaultSweep,
  geometrySignature,
  liftLatestSweep,
  releaseField,
  releaseSweep
} from './engine.mjs';

const canvas = document.querySelector('#field');
const gpuCanvas = document.querySelector('#gpu-field');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  view: { width: 1, height: 1, dpr: 1 },
  pointer: null,
  dragging: false,
  lastAction: 'quiet',
  time: 0,
  gpu: null,
  renderer: 'CANVAS / CONTOUR FALLBACK'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const residueElement = document.querySelector('[data-residue]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#090a0d',
  groundWarm: '#19171a',
  ink: '#f1eee5',
  muted: '#a8a8a5',
  cyan: '#82d8c2',
  amber: '#f2bb78',
  lilac: '#b4a9ef',
  coral: '#e78d84',
  moss: '#779e8b',
  void: '#28272b'
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.73137) * 43758.5453;
  return raw - Math.floor(raw);
};

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
  canvas.width = Math.floor(state.view.width * dpr);
  canvas.height = Math.floor(state.view.height * dpr);
  gpuCanvas.width = Math.floor(state.view.width * dpr);
  gpuCanvas.height = Math.floor(state.view.height * dpr);
  render(performance.now());
};

const fieldPoint = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  return [
    clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
    clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
  ];
};

const screenPoint = (cell, width, height) => ({
  x: width * (0.5 + cell.x * 0.45),
  y: height * (0.53 + cell.y * 0.43)
});

const cellPolygon = (cell, width, height, time) => {
  const center = screenPoint(cell, width, height);
  const radius = Math.min(width, height) * 0.085 * cell.swell;
  const points = [];
  const sides = 7;
  const bend = cell.bend * 0.18;
  for (let index = 0; index < sides; index += 1) {
    const angle = cell.angle + (Math.PI * 2 * index) / sides;
    const irregular = 0.84 + hash(cell.id * 13.7 + index * 5.3) * 0.22;
    const wave = Math.sin(time * 0.00018 + cell.phase + index * 0.73) * (cell.mode === 'quiet' ? 0.5 : 1.6);
    const axis = index % 2 === 0 ? bend : -bend;
    points.push({
      x: center.x + Math.cos(angle) * radius * irregular + Math.cos(angle + Math.PI / 2) * axis * radius + wave,
      y: center.y + Math.sin(angle) * radius * irregular + Math.sin(angle + Math.PI / 2) * axis * radius + wave * 0.55
    });
  }
  return points;
};

const colourFor = (cell) => {
  if (cell.mode === 'source') return PALETTE.ink;
  if (cell.mode === 'return') return PALETTE.cyan;
  if (cell.mode === 'cut') return PALETTE.coral;
  if (cell.mode === 'wake') return cell.id % 2 ? PALETTE.amber : PALETTE.lilac;
  return cell.id % 3 === 0 ? PALETTE.moss : PALETTE.muted;
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.53, height * 0.38, 0, width * 0.5, height * 0.52, Math.max(width, height) * 0.86);
  gradient.addColorStop(0, '#2a2827');
  gradient.addColorStop(0.36, '#161619');
  gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = PALETTE.cyan;
  for (let index = 0; index < 18; index += 1) {
    const x = width * (0.08 + hash(index * 3.1) * 0.86);
    const y = height * (0.10 + hash(index * 7.4 + 4) * 0.76);
    const radius = Math.min(width, height) * (0.05 + hash(index * 2.6) * 0.12);
    ctx.beginPath();
    ctx.arc(x + Math.sin(time * 0.00005 + index) * 8, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 180; index += 1) {
    const x = hash(index * 1.73) * width;
    const y = hash(index * 4.11 + 3) * height;
    const size = hash(index * 3.37) * 1.15 + 0.25;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawFieldWash = (width, height, time) => {
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = Math.max(18, Math.min(width, height) * 0.024);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(width * 0.10, height * 0.75);
  ctx.bezierCurveTo(width * 0.30, height * 0.28, width * 0.66, height * 0.80, width * 0.91, height * 0.29 + Math.sin(time * 0.0001) * 6);
  ctx.stroke();
  ctx.restore();
};

const drawSweepPreview = (width, height) => {
  if (blindMode || !state.pointer) return;
  const start = screenPoint({ x: state.pointer.start[0], y: state.pointer.start[1] }, width, height);
  const end = screenPoint({ x: state.pointer.end[0], y: state.pointer.end[1] }, width, height);
  ctx.save();
  ctx.globalAlpha = state.dragging ? 0.75 : 0.28;
  ctx.strokeStyle = state.dragging ? PALETTE.cyan : PALETTE.muted;
  ctx.lineWidth = state.dragging ? 1.6 : 0.8;
  ctx.setLineDash([3, 8]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

const drawCell = (cell, width, height, time) => {
  const points = cellPolygon(cell, width, height, time);
  const centre = screenPoint(cell, width, height);
  const fill = colourFor(cell);
  const alpha = cell.mode === 'cut' ? 0.28 : cell.mode === 'quiet' ? 0.52 : 0.74;

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(points[0].x + 7, points[0].y + 10);
  for (const point of points.slice(1)) ctx.lineTo(point.x + 7, point.y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = cell.mode === 'cut' ? PALETTE.coral : fill;
  ctx.lineWidth = cell.mode === 'source' ? 2.8 : cell.mode === 'return' ? 2 : 0.8;
  ctx.stroke();

  if (cell.open > 0.08) {
    const openRadius = Math.min(width, height) * 0.02 + cell.open * Math.min(width, height) * 0.028;
    ctx.globalAlpha = cell.mode === 'cut' ? 0.9 : 0.55;
    ctx.fillStyle = cell.mode === 'cut' ? PALETTE.ground : PALETTE.void;
    ctx.beginPath();
    ctx.ellipse(centre.x + cell.bend * 2, centre.y, openRadius * 1.25, openRadius * 0.55, cell.angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawField = (width, height, time) => {
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, time);
  drawFieldWash(width, height, time);
  const cells = [...state.frame.field.cells].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const cell of cells) drawCell(cell, width, height, time);
  drawSweepPreview(width, height);
};

const updateReadout = () => {
  stageElement.textContent = `weather ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'sweep' : 'sweeps'}`;
  residueElement.textContent = `residue ${state.frame.field.residue.toFixed(2)}`;
  rendererElement.textContent = state.renderer;
  if (state.dragging) {
    statusElement.textContent = 'measuring sweep · release to commit';
  } else if (state.lastAction === 'tap-refused') {
    statusElement.textContent = 'short tap refused · drag farther across the field';
  } else {
    statusElement.textContent = `${state.frame.field.wakes.length} wake cells · ${state.frame.field.cuts.length} open cuts · route ${state.frame.field.route}`;
  }
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr);
};

const renderState = (next, action = 'quiet') => {
  state.frame = next;
  state.lastAction = action;
  render();
};

const commitSweep = (cue = defaultSweep()) => renderState(releaseSweep(state.frame, cue), 'sweep-committed');
const lift = () => renderState(liftLatestSweep(state.frame), 'sweep-lifted');
const release = () => {
  state.pointer = null;
  renderState(releaseField(), 'weather-released');
};

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain() -> @location(0) vec4f { return vec4f(0.04, 0.07, 0.07, 0.12); }` });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    state.gpu = {
      device,
      context,
      pipeline,
      render() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      }
    };
    state.renderer = 'WEBGPU / ADAPTIVE FIELD';
    render();
  } catch {
    state.gpu = null;
  }
};

const commitFromPointer = () => {
  if (!state.pointer) return;
  const dx = state.pointer.end[0] - state.pointer.start[0];
  const dy = state.pointer.end[1] - state.pointer.start[1];
  const distance = Math.hypot(dx, dy);
  if (distance < 0.16 && performance.now() - state.pointer.started < 260) {
    state.dragging = false;
    state.lastAction = 'tap-refused';
    render();
    return;
  }
  commitSweep({ start: state.pointer.start, end: state.pointer.end, force: clamp(0.38 + distance * 0.42, 0.38, 1) });
  state.pointer = null;
  state.dragging = false;
  render();
};

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  const point = fieldPoint(event.clientX, event.clientY);
  state.pointer = { start: point, end: point, started: performance.now() };
  state.dragging = true;
  state.lastAction = 'measuring';
  render();
});
canvas.addEventListener('pointermove', (event) => {
  if (!state.pointer) return;
  state.pointer.end = fieldPoint(event.clientX, event.clientY);
  state.frame = armSweep(state.frame, state.pointer);
  render();
});
canvas.addEventListener('pointerup', (event) => {
  if (!state.pointer) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  state.pointer.end = fieldPoint(event.clientX, event.clientY);
  commitFromPointer();
});
canvas.addEventListener('pointercancel', () => {
  state.pointer = null;
  state.dragging = false;
  render();
});

document.querySelector('[data-gesture="sweep"]').addEventListener('click', () => commitSweep(defaultSweep()));
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitSweep(state.frame.armed);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});
window.addEventListener('resize', resize);

window.__mutineWebGPUV022 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    residue: state.frame.field.residue,
    route: state.frame.field.route,
    wakes: state.frame.field.wakes.length,
    cuts: state.frame.field.cuts.length,
    signature: geometrySignature(state.frame),
    action: state.lastAction,
    renderer: state.renderer
  }),
  commit: commitSweep,
  lift,
  release,
  arm: (cue) => renderState(armSweep(state.frame, cue), 'armed')
};

resize();
setupGPU();
if (!staticMode && !reducedMotion) requestAnimationFrame(function tick(now) { render(now); requestAnimationFrame(tick); });
