import {
  CUBE_COUNT,
  MEMORY_LIMIT,
  STAGES,
  armSignal,
  buildTimeline,
  commitBroadcast,
  geometrySignature,
  liftLatestBroadcast,
  releaseLoom
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
  pointerDown: false,
  gpu: null,
  time: 0
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const PALETTE = { ground: '#070a0f', ink: '#e9f0f1', muted: '#8fa2aa', cyan: '#72d4d2', orange: '#ef9d65', violet: '#aa9cff' };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
  canvas.width = Math.floor(state.view.width * dpr);
  canvas.height = Math.floor(state.view.height * dpr);
  gpuCanvas.width = canvas.width;
  gpuCanvas.height = canvas.height;
  render(performance.now());
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * .5, height * .42, 0, width * .5, height * .5, Math.max(width, height) * .78);
  gradient.addColorStop(0, '#182936'); gradient.addColorStop(.5, '#0b1118'); gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.globalAlpha = state.gpu ? .08 : .15; ctx.strokeStyle = PALETTE.cyan; ctx.lineWidth = .65;
  for (let line = 0; line < 28; line += 1) {
    const y = height * (.12 + line * .029) + Math.sin(time * .00008 + line) * height * .006;
    ctx.beginPath(); ctx.moveTo(-width * .06, y); ctx.bezierCurveTo(width * .28, y - height * .03, width * .68, y + height * .035, width * 1.06, y - height * .01); ctx.stroke();
  }
  ctx.restore();
};

const project = (cube, width, height) => ({
  x: width * (.5 + cube.x * .72 + cube.z * .12),
  y: height * (.5 + cube.y * .86 - cube.z * .18),
  size: Math.min(width, height) * cube.size * (1 + cube.z * .45),
  angle: cube.tilt + Math.sin(state.time * .0002 + cube.phase) * (reducedMotion ? 0 : .01)
});

const drawCube = (cube, index, width, height) => {
  const box = project(cube, width, height);
  const half = box.size * .5;
  const depth = half * (.28 + cube.z * .4);
  const points = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => ({ x, y }));
  const rotate = (point) => ({ x: box.x + point.x * Math.cos(box.angle) - point.y * Math.sin(box.angle), y: box.y + point.x * Math.sin(box.angle) + point.y * Math.cos(box.angle) });
  const front = points.map(rotate);
  const top = [front[0], front[1], { x: front[1].x + depth, y: front[1].y - depth }, { x: front[0].x + depth, y: front[0].y - depth }];
  const side = [front[1], front[2], { x: front[2].x + depth, y: front[2].y - depth }, { x: front[1].x + depth, y: front[1].y - depth }];
  const fill = cube.mode === 'carrier' ? PALETTE.orange : cube.mode === 'echo' ? PALETTE.violet : index % 3 === 0 ? PALETTE.cyan : PALETTE.ink;
  const poly = (list, colour, alpha) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(list[0].x, list[0].y); list.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = .75; ctx.stroke(); ctx.restore(); };
  poly(top, fill, .2 + cube.echo * .04); poly(side, fill, .3 + cube.load * .02); poly(front, fill, .5 + cube.load * .03);
  if (cube.mode !== 'quiet' && !blindMode) {
    ctx.save(); ctx.globalAlpha = .75; ctx.strokeStyle = cube.mode === 'carrier' ? PALETTE.orange : PALETTE.violet; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(front[0].x, front[0].y); ctx.lineTo(front[2].x, front[2].y); ctx.stroke(); ctx.restore();
  }
};

const drawLoom = (width, height, time) => {
  ctx.save(); ctx.clearRect(0, 0, width, height); drawBackground(width, height, time);
  const loom = state.frame.loom;
  ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = PALETTE.muted; ctx.lineWidth = 1;
  loom.transmissions.forEach((transmission) => {
    const from = project(loom.cubes[transmission.from], width, height); const to = project(loom.cubes[transmission.to], width, height);
    ctx.setLineDash([2, 9]); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(width * .5, height * (.22 + transmission.serial * .12), to.x, to.y); ctx.stroke();
  }); ctx.setLineDash([]); ctx.restore();
  [...loom.cubes].sort((a, b) => a.z - b.z).forEach((cube, index) => drawCube(cube, index, width, height));
  ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = PALETTE.ink;
  for (let i = 0; i < 100; i += 1) { const x = ((i * 83 + loom.phaseDebt * 17) % 1000) / 1000 * width; const y = ((i * 47 + 19) % 1000) / 1000 * height; ctx.fillRect(x, y, .7, .7); } ctx.restore();
  ctx.restore();
};

const updateReadout = () => {
  stageElement.textContent = `loom ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'broadcast' : 'broadcasts'}`;
  rendererElement.textContent = state.gpu ? 'WEBGPU / CUBE LOOM' : 'CANVAS / GPU FALLBACK';
  statusElement.textContent = state.pointerDown ? 'pointer tap refused — choose a lane' : `signal ${state.frame.armedSignal + 1} armed · phase debt ${state.frame.loom.phaseDebt.toFixed(2)}`;
};

const render = (now = performance.now()) => { state.time = now; const { width, height, dpr } = state.view; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawLoom(width, height, now); updateReadout(); state.gpu?.render(now, width * dpr, height * dpr); };
const renderState = (frame) => { state.frame = frame; render(); };
const commit = () => renderState(commitBroadcast(state.frame, { signal: state.frame.armedSignal }));
const lift = () => renderState(liftLatestBroadcast(state.frame));
const release = () => renderState(releaseLoom());
const choose = (delta) => renderState(armSignal(state.frame, { signal: state.frame.armedSignal + delta }));

const initGpu = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter(); if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu'); if (!context) return;
    const format = navigator.gpu.getPreferredCanvasFormat(); context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) i:u32)->@builtin(position) vec4f { var p=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.)); return vec4f(p[i],0.,1.); } @fragment fn fragmentMain()->@location(0) vec4f { return vec4f(.03,.08,.11,.14); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render: () => { const encoder = device.createCommandEncoder(); const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: .02, g: .04, b: .07, a: 1 }, loadOp: 'clear', storeOp: 'store' }] }); pass.setPipeline(pipeline); pass.draw(3); pass.end(); device.queue.submit([encoder.finish()]); } };
  } catch { state.gpu = null; }
};

canvas.addEventListener('pointerdown', () => { state.pointerDown = true; updateReadout(); });
canvas.addEventListener('pointerup', () => { state.pointerDown = false; updateReadout(); });
canvas.addEventListener('pointercancel', () => { state.pointerDown = false; updateReadout(); });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); choose(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); choose(1); }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
});
document.querySelector('[data-gesture="broadcast"]').addEventListener('click', commit);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);
window.__mutineWebGPUV019 = { getState: () => ({ stage: state.frame.stage, memory: state.frame.memory.length, signal: state.frame.armedSignal, signature: geometrySignature(state.frame), transmissions: state.frame.loom.transmissions.length }) };
resize(); initGpu();
