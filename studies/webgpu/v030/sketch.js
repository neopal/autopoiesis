import {
  STAGES,
  WITNESS_COUNT,
  armAttention,
  buildFrame,
  buildTimeline,
  commitDeparture,
  defaultWitnesses,
  geometrySignature,
  liftLatestDeparture,
  releaseArchive
} from './engine.mjs';

const canvas = document.querySelector('#exposure-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  gesture: { active: false, point: null }
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#071218',
  deep: '#03080d',
  ice: '#d9eee4',
  light: '#f0e6cc',
  coral: '#ef8e75',
  acid: '#b8cf76',
  cyan: '#87c8c1',
  violet: '#9892d8',
  mist: 'rgba(217, 238, 228, .18)'
};
const COLORS = [PALETTE.cyan, PALETTE.coral, PALETTE.acid, PALETTE.violet];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + 7.31) * 43758.5453;
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

const platePoint = (plate, width, height, time) => {
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * 0.00017 + plate.id * 0.7) * 0.008;
  return { x: (plate.x + drift) * width, y: plate.y * height };
};

const platePath = (context, width, height, opening = 0, edge = 0) => {
  const skew = edge * width * .03;
  const bite = Math.min(width, height) * (.012 + opening * .02);
  context.beginPath();
  context.moveTo(-width * .5 + bite, -height * .5 + skew);
  context.lineTo(width * .42 + skew, -height * .5 - bite);
  context.lineTo(width * .5, -height * .08);
  context.lineTo(width * .39 - skew, height * .5);
  context.lineTo(-width * .4 - bite, height * .5 - skew);
  context.lineTo(-width * .5, height * .08 + bite);
  context.closePath();
};

const drawGrain = (width, height) => {
  ctx.save();
  ctx.globalAlpha = .12;
  ctx.fillStyle = PALETTE.light;
  for (let index = 0; index < 520; index += 1) {
    const x = pseudo(index * 1.31 + 22) * width;
    const y = pseudo(index * 2.77 + 17) * height;
    const size = pseudo(index * 4.07 + 5) * 1.1 + .15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * .48, height * .43, 0, width * .48, height * .47, Math.max(width, height) * .83);
  gradient.addColorStop(0, '#1b3940');
  gradient.addColorStop(.24, '#112931');
  gradient.addColorStop(.63, PALETTE.deep);
  gradient.addColorStop(1, '#010305');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGrain(width, height);

  ctx.save();
  ctx.globalAlpha = .13;
  ctx.strokeStyle = PALETTE.ice;
  ctx.lineWidth = Math.max(.5, Math.min(width, height) * .0008);
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * .00013) * width * .014;
  ctx.beginPath();
  ctx.moveTo(width * .04 + drift, height * .83);
  ctx.bezierCurveTo(width * .27, height * .56, width * .63, height * .57, width * .97 - drift, height * .17);
  ctx.stroke();
  ctx.globalAlpha = .075;
  ctx.beginPath();
  ctx.moveTo(width * .18, height * .08);
  ctx.bezierCurveTo(width * .45, height * .35, width * .62, height * .66, width * .9, height * .9);
  ctx.stroke();
  ctx.restore();
};

const drawPlate = (plate, index, width, height, time) => {
  const point = platePoint(plate, width, height, time);
  const scale = Math.min(width, height);
  const plateWidth = plate.width * width;
  const plateHeight = plate.height * height;
  const color = COLORS[index % COLORS.length];
  const open = clamp(plate.open, .1, 1);
  const exposure = clamp(plate.exposure, 0, 2);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(plate.rotation + plate.tilt);
  ctx.shadowColor = color;
  ctx.shadowBlur = scale * (.015 + exposure * .022);
  ctx.globalAlpha = .16 + exposure * .12;
  ctx.fillStyle = color;
  platePath(ctx, plateWidth, plateHeight, open, plate.id % 2 ? -1 : 1);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = .7;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, scale * (.0012 + exposure * .0008));
  platePath(ctx, plateWidth, plateHeight, open, plate.id % 2 ? -1 : 1);
  ctx.stroke();

  const apertureWidth = plateWidth * (.25 + open * .42);
  const apertureHeight = plateHeight * (.2 + open * .43);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = .87;
  platePath(ctx, apertureWidth, apertureHeight, open, -plate.tilt * 3);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = .42 + exposure * .16;
  ctx.strokeStyle = PALETTE.light;
  ctx.lineWidth = Math.max(.7, scale * .001);
  platePath(ctx, apertureWidth * .92, apertureHeight * .88, open, 1);
  ctx.stroke();
  ctx.globalAlpha = .52;
  ctx.fillStyle = PALETTE.light;
  ctx.fillRect(-plateWidth * .34, -plateHeight * .47, plateWidth * .16, Math.max(1, scale * .002));
  ctx.restore();
};

const drawExposureField = (width, height, time) => {
  const plates = [...state.frame.field.plates].sort((a, b) => a.exposure - b.exposure || a.id - b.id);
  plates.forEach((plate) => drawPlate(plate, plate.id, width, height, time));
};

const drawWitnessHalo = (width, height) => {
  if (!state.gesture.active || !state.gesture.point || blindMode) return;
  const point = state.gesture.point;
  const radius = Math.min(width, height) * (.06 + (Math.sin(state.time * .004) + 1) * .006);
  const gradient = ctx.createRadialGradient(point.x * width, point.y * height, 0, point.x * width, point.y * height, radius);
  gradient.addColorStop(0, 'rgba(240,230,204,.24)');
  gradient.addColorStop(1, 'rgba(240,230,204,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(point.x * width - radius, point.y * height - radius, radius * 2, radius * 2);
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `room ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'departure' : 'departures'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'departure-committed') statusElement.textContent = 'you left · the unseen aperture widened';
  else if (state.frame.lastAction === 'attention-observed') statusElement.textContent = `${state.frame.attention?.visits.length ?? 0} witnesses held · departure is causal`;
  else if (state.frame.lastAction?.includes('refused')) statusElement.textContent = 'the room refuses an incomplete leaving';
  else if (state.frame.lastAction === 'departure-lifted') statusElement.textContent = 'latest departure lifted · shutters restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before another departure';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the room returns to quiet';
  else statusElement.textContent = `${WITNESS_COUNT} shutters · look across three witnesses`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, now);
  drawExposureField(width, height, now);
  drawWitnessHalo(width, height);
  updateReadout();
  state.gpu?.render();
};

const renderState = (next) => { state.frame = next; render(); };
const observeWitness = (witness, at = performance.now()) => {
  const next = armAttention(state.frame, { witness, at });
  state.frame = next;
  render();
  return next;
};
const depart = () => {
  const defaults = defaultWitnesses();
  let next = buildFrame(state.frame.stage, state.frame.memory);
  defaults.forEach(({ witness, at }) => { next = armAttention(next, { witness, at }); });
  renderState(commitDeparture(next, { releasedAt: 520 }));
  state.gesture = { active: false, point: null };
};
const lift = () => renderState(liftLatestDeparture(state.frame));
const release = () => renderState(releaseArchive());

const normalizedPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
};
const closestWitness = (point) => state.frame.field.plates
  .map((plate) => ({ id: plate.id, distance: Math.hypot(point.x - plate.x, point.y - plate.y) }))
  .sort((a, b) => a.distance - b.distance)[0];
const pointerMove = (event) => {
  const point = normalizedPoint(event);
  const nearest = closestWitness(point);
  state.gesture = { active: true, point };
  if (nearest && nearest.distance < .18) observeWitness(nearest.id, performance.now());
  else render();
};
const pointerLeave = () => {
  if (state.frame.attention?.visits.length >= 3) renderState(commitDeparture(state.frame, { releasedAt: performance.now() }));
  state.gesture = { active: false, point: null };
  render();
};

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    if (!context) return;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let veil = 0.018 + 0.012 * sin(pos.x * 0.014 + pos.y * 0.009); return vec4f(0.03 + veil, 0.11 + veil * 1.5, 0.13 + veil, 0.16); }` });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / EXPOSURE VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerleave', pointerLeave);
canvas.addEventListener('pointercancel', pointerLeave);
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); depart(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
});
document.querySelector('[data-gesture="depart"]')?.addEventListener('click', depart);
document.querySelector('[data-gesture="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-gesture="release"]')?.addEventListener('click', release);
window.addEventListener('resize', resize);

resize();
window.__mutineReady = true;
window.__mutineWebGPUV030 = {
  getState: () => ({ stage: state.frame.stage, memory: state.frame.memory.length, signature: geometrySignature(state.frame), attention: state.frame.attention, event: state.frame.memory.at(-1) ?? null, action: state.frame.lastAction, renderer: state.renderer }),
  getWitnessPoints: () => state.frame.field.plates.map((plate) => ({ id: plate.id, x: plate.x, y: plate.y })),
  observeWitness: (witness, at = performance.now()) => observeWitness(witness, at),
  depart,
  lift,
  release
};
setupGPU();
if (!staticMode && !reducedMotion) {
  const tick = (now) => { render(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
