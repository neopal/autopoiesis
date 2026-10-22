import {
  STAGES,
  GRAIN_COUNT,
  pressGrain,
  buildFrame,
  buildTimeline,
  defaultPressure,
  geometrySignature,
  liftLatestPressure,
  releaseArchive,
  releasePressure
} from './engine.mjs';

const canvas = document.querySelector('#grain-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(0, []),
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  renderer: 'CANVAS / GRANULAR BODY',
  gesture: { active: false, point: null, grain: null }
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const PALETTE = ['#9bcfbc', '#ee8d72', '#dfc16e', '#a99de2', '#eee1c7'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
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

const grainPoint = (grain, width, height, time) => {
  const breathing = reducedMotion || staticMode ? 0 : Math.sin(time * 0.00022 + grain.phase) * 0.0024;
  const depth = grain.depthShift * 0.06;
  return { x: (grain.x + breathing + depth * 0.18) * width, y: (grain.y + depth + breathing * .6) * height };
};
const irregularPath = (context, radius, phase, id) => {
  const points = 7;
  context.beginPath();
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2 + phase;
    const wobble = .78 + pseudo(id * 4.1 + index * 3.7) * .34;
    const x = Math.cos(angle) * radius * wobble;
    const y = Math.sin(angle) * radius * wobble;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.closePath();
};
const drawSpecks = (width, height) => {
  ctx.save();
  ctx.globalAlpha = .13;
  ctx.fillStyle = '#eee1c7';
  for (let index = 0; index < 640; index += 1) {
    const x = pseudo(index * 1.31 + 22) * width;
    const y = pseudo(index * 2.77 + 17) * height;
    const size = pseudo(index * 4.07 + 5) * 1.1 + .15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};
const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * .48, height * .46, 0, width * .48, height * .47, Math.max(width, height) * .82);
  gradient.addColorStop(0, '#2a1830');
  gradient.addColorStop(.27, '#171226');
  gradient.addColorStop(.68, '#080812');
  gradient.addColorStop(1, '#020207');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawSpecks(width, height);
  ctx.save();
  ctx.globalAlpha = .12;
  ctx.strokeStyle = '#eee1c7';
  ctx.lineWidth = Math.max(.5, Math.min(width, height) * .0007);
  ctx.beginPath();
  ctx.ellipse(width * .5, height * .51, width * .35, height * .29, -.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawGrain = (grain, index, width, height, time) => {
  const point = grainPoint(grain, width, height, time);
  const scale = Math.min(width, height);
  const mass = clamp(grain.mass, .12, 1.4);
  const radius = scale * (.009 + grain.size * .0105) * (.76 + mass * .34) * (grain.radius || 1);
  const color = PALETTE[(index + Math.round(grain.heat * 2)) % PALETTE.length];
  const lowMass = mass < .48;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.shadowColor = color;
  ctx.shadowBlur = scale * (.009 + grain.heat * .012);
  ctx.globalAlpha = .14 + mass * .27;
  ctx.fillStyle = color;
  irregularPath(ctx, radius * 1.7, grain.phase, grain.id);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = .76;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(.7, scale * (.0009 + grain.heat * .0008));
  irregularPath(ctx, radius * 1.55, grain.phase, grain.id);
  ctx.stroke();
  if (lowMass) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = .88;
    irregularPath(ctx, radius * 1.2, grain.phase + .12, grain.id + 9);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = .66;
    ctx.strokeStyle = '#eee1c7';
    ctx.lineWidth = Math.max(.8, scale * .0011);
    irregularPath(ctx, radius * 1.28, grain.phase, grain.id + 3);
    ctx.stroke();
  } else {
    ctx.globalAlpha = .42 + mass * .22;
    ctx.fillStyle = '#eee1c7';
    irregularPath(ctx, radius * (.28 + mass * .2), grain.phase + .4, grain.id + 4);
    ctx.fill();
    ctx.globalAlpha = .5;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(.6, scale * .0008);
    ctx.beginPath();
    ctx.moveTo(-radius * .9, radius * .12);
    ctx.quadraticCurveTo(0, -radius * .56, radius * .86, -radius * .16);
    ctx.stroke();
  }
  if (grain.radius > 1.08) {
    ctx.globalAlpha = .3;
    ctx.strokeStyle = '#dfc16e';
    ctx.lineWidth = Math.max(.8, scale * .0012);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.85, grain.phase, grain.phase + Math.PI * 1.35);
    ctx.stroke();
  }
  ctx.restore();
};
const drawPressure = (width, height, time) => {
  if (!state.gesture.active || !state.gesture.point || blindMode) return;
  const point = state.gesture.point;
  const radius = Math.min(width, height) * (.025 + (Math.sin(time * .004) + 1) * .004);
  ctx.save();
  ctx.globalAlpha = .5;
  ctx.strokeStyle = '#eee1c7';
  ctx.lineWidth = Math.max(1, Math.min(width, height) * .0012);
  ctx.beginPath();
  ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `mass ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'compression' : 'compressions'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'pressure-released') statusElement.textContent = 'released · a remote gap now carries the pressure';
  else if (state.frame.lastAction === 'pressure-held') statusElement.textContent = 'pressure held · the material stays neutral';
  else if (state.frame.lastAction?.includes('refused')) statusElement.textContent = 'the mass refuses a short pressure';
  else if (state.frame.lastAction === 'pressure-lifted') statusElement.textContent = 'latest compression lifted · grains restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before another compression';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the mass returns to quiet';
  else statusElement.textContent = `${GRAIN_COUNT} grains · press, hold, release`;
};
const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, now);
  [...state.frame.field.grains].sort((a, b) => a.z + a.depthShift - (b.z + b.depthShift)).forEach((grain) => drawGrain(grain, grain.id, width, height, now));
  drawPressure(width, height, now);
  updateReadout();
  state.gpu?.render();
};
const renderState = (next) => { state.frame = next; render(); };
const press = (grain, at = performance.now()) => { state.frame = pressGrain(state.frame, { grain, at }); render(); };
const release = (at = performance.now()) => { renderState(releasePressure(state.frame, { releasedAt: at })); state.gesture = { active: false, point: null, grain: null }; };
const compress = () => {
  const defaults = defaultPressure();
  const held = pressGrain(buildFrame(state.frame.stage, state.frame.memory), defaults);
  state.frame = held;
  release(defaults.releasedAt);
};
const lift = () => renderState(liftLatestPressure(state.frame));
const releaseArchiveState = () => renderState(releaseArchive());
const normalizedPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
};
const closestGrain = (point) => state.frame.field.grains
  .map((grain) => ({ id: grain.id, distance: Math.hypot(point.x - grain.x, point.y - grain.y) }))
  .sort((a, b) => a.distance - b.distance)[0];
const pointerMove = (event) => {
  state.gesture.point = normalizedPoint(event);
  render();
};
const pointerDown = (event) => {
  const point = normalizedPoint(event);
  const nearest = closestGrain(point);
  state.gesture = { active: true, point, grain: nearest?.id ?? null };
  press(nearest?.id ?? 4, performance.now());
  canvas.setPointerCapture?.(event.pointerId);
};
const pointerUp = (event) => {
  if (!state.gesture.active) return;
  release(performance.now());
  canvas.releasePointerCapture?.(event.pointerId);
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
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let veil = 0.018 + 0.012 * sin(pos.x * 0.014 + pos.y * 0.009); return vec4f(0.08 + veil, 0.035 + veil * .5, 0.11 + veil, 0.12); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / PRESSURE VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); compress(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); releaseArchiveState(); }
});
document.querySelector('[data-gesture="compress"]')?.addEventListener('click', compress);
document.querySelector('[data-gesture="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-gesture="release"]')?.addEventListener('click', releaseArchiveState);
window.addEventListener('resize', resize);

resize();
window.__mutineReady = true;
window.__mutineWebGPUV031 = {
  getState: () => ({ stage: state.frame.stage, memory: state.frame.memory.length, signature: geometrySignature(state.frame), pressure: state.frame.pressure, event: state.frame.memory.at(-1) ?? null, action: state.frame.lastAction, renderer: state.renderer }),
  getGrainPoints: () => state.frame.field.grains.map((grain) => ({ id: grain.id, x: grain.x, y: grain.y })),
  press,
  release,
  compress,
  lift,
  releaseArchive: releaseArchiveState
};
setupGPU();
if (!staticMode && !reducedMotion) {
  const loop = (now) => { render(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
