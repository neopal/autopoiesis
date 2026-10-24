import {
  STAGES,
  buildFrame,
  buildTimeline,
  armSurface,
  moveSurface,
  releaseSurface,
  liftLatestBeat,
  releaseArchive,
  defaultSweep,
  geometrySignature,
  samplePoints
} from './engine.mjs';

const canvas = document.querySelector('#propagation-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  hover: null,
  pointerActive: false,
  gpu: null,
  renderer: 'CANVAS / PROPAGATION SURFACE'
};
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const PALETTE = {
  night: [3, 9, 12],
  deep: [8, 30, 34],
  mint: [115, 217, 195],
  coral: [244, 135, 111],
  gold: [231, 191, 113],
  bone: [220, 238, 229]
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
const pseudo = (value) => {
  const raw = Math.sin(value * 11.713 + 2.41) * 43758.5453;
  return raw - Math.floor(raw);
};
const normalizedPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
  };
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
const project = (sample, width, height, time) => {
  const span = Math.min(width, height) * 0.88;
  const breathing = reducedMotion || staticMode ? 0 : Math.sin(time * 0.00012 + sample.phase * 7) * 0.008;
  return {
    x: width * 0.5 + (sample.u - 0.5) * span * 1.05 + (sample.v - 0.5) * span * 0.16,
    y: height * 0.54 + (sample.v - 0.5) * span * 0.53 + (sample.u - 0.5) * span * 0.05 - sample.height * span * 0.22 + breathing * span,
    z: sample.height
  };
};
const fillPolygon = (points, fill) => {
  ctx.beginPath();
  points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};
const strokePath = (points, stroke, lineWidth) => {
  ctx.beginPath();
  points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};
const drawTexture = (width, height) => {
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let index = 0; index < 520; index += 1) {
    const x = pseudo(index * 1.37 + 9) * width;
    const y = pseudo(index * 2.91 + 21) * height;
    const size = pseudo(index * 4.17 + 5) * 1.4 + 0.2;
    ctx.fillStyle = index % 3 ? rgba(PALETTE.bone, 0.16) : rgba(PALETTE.mint, 0.24);
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};
const drawBackground = (width, height) => {
  const gradient = ctx.createRadialGradient(width * 0.54, height * 0.44, 0, width * 0.54, height * 0.5, Math.max(width, height) * 0.82);
  gradient.addColorStop(0, '#173a3b');
  gradient.addColorStop(0.26, '#0c252a');
  gradient.addColorStop(0.68, '#061216');
  gradient.addColorStop(1, '#020609');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawTexture(width, height);
  ctx.save();
  ctx.strokeStyle = rgba(PALETTE.bone, 0.1);
  ctx.lineWidth = Math.max(0.6, Math.min(width, height) * 0.0007);
  ctx.setLineDash([1, Math.min(width, height) * 0.016]);
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.54, Math.min(width, height) * 0.37, Math.min(width, height) * 0.19, -0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};
const sampleMatrix = () => {
  const byRow = [];
  for (let row = 0; row < 12; row += 1) byRow.push(state.frame.field.samples.slice(row * 18, (row + 1) * 18));
  return byRow;
};
const drawTerrain = (width, height, time) => {
  const matrix = sampleMatrix();
  const projected = matrix.map((row) => row.map((sample) => project(sample, width, height, time)));
  const scale = Math.min(width, height);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = scale * 0.045;
  ctx.shadowOffsetY = scale * 0.035;
  for (let row = 0; row < matrix.length - 1; row += 1) {
    for (let column = 0; column < matrix[row].length - 1; column += 1) {
      const a = matrix[row][column];
      const b = matrix[row][column + 1];
      const c = matrix[row + 1][column + 1];
      const d = matrix[row + 1][column];
      const pa = projected[row][column];
      const pb = projected[row][column + 1];
      const pc = projected[row + 1][column + 1];
      const pd = projected[row + 1][column];
      const value = clamp((a.height + b.height + c.height + d.height) / 4, 0, 1);
      const inherited = (a.inheritance + b.inheritance + c.inheritance + d.inheritance) / 4;
      const fold = (a.fold + b.fold + c.fold + d.fold) / 4;
      let color = mix(PALETTE.deep, PALETTE.mint, clamp(value * 0.82 + inherited * 0.15, 0, 1));
      if (value < 0.36) color = mix(PALETTE.night, PALETTE.coral, (0.36 - value) * 1.5);
      if (fold > 0.42) color = mix(color, PALETTE.gold, clamp((fold - 0.42) * 0.8, 0, 0.42));
      fillPolygon([pa, pb, pc], rgba(color, 0.42 + inherited * 0.18));
      fillPolygon([pa, pc, pd], rgba(mix(color, PALETTE.deep, 0.1), 0.36 + inherited * 0.2));
    }
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  for (let row = 0; row < matrix.length; row += 1) {
    const points = projected[row];
    strokePath(points, rgba(PALETTE.bone, 0.08 + row % 3 * 0.012), Math.max(0.45, scale * 0.00055));
  }
  for (let column = 0; column < matrix[0].length; column += 2) {
    strokePath(projected.map((row) => row[column]), rgba(PALETTE.mint, 0.07), Math.max(0.4, scale * 0.00045));
  }
  for (let row = 1; row < matrix.length - 1; row += 2) {
    const contour = projected[row].filter((_, column) => column % 2 === 0);
    strokePath(contour, rgba(PALETTE.gold, 0.16), Math.max(0.55, scale * 0.00075));
  }
  ctx.restore();
  const ridge = projected[5].slice(2, 16);
  strokePath(ridge, rgba(PALETTE.bone, 0.38), Math.max(0.8, scale * 0.0011));
  const basin = projected[8].slice(4, 14);
  strokePath(basin, rgba(PALETTE.coral, 0.3), Math.max(0.7, scale * 0.00085));
};
const drawDrag = (width, height) => {
  if (blindMode || !state.frame.drag) return;
  const start = state.frame.drag.start;
  const end = state.frame.drag.current;
  const a = { x: start.x * width, y: start.y * height };
  const b = { x: end.x * width, y: end.y * height };
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  if (distance < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = rgba(PALETTE.coral, 0.72);
  ctx.lineWidth = Math.max(1.2, Math.min(width, height) * 0.0012);
  ctx.setLineDash([Math.min(width, height) * 0.006, Math.min(width, height) * 0.012]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.fillStyle = rgba(PALETTE.coral, 0.9);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - Math.cos(angle - 0.48) * 15, b.y - Math.sin(angle - 0.48) * 15);
  ctx.lineTo(b.x - Math.cos(angle + 0.48) * 15, b.y - Math.sin(angle + 0.48) * 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `horizon ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'pulse' : 'pulses'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'propagation-committed') statusElement.textContent = 'pulse released · neighbours inherit the direction';
  else if (state.frame.lastAction === 'sweep-armed' || state.frame.lastAction === 'sweep-moving') statusElement.textContent = 'direction armed · the terrain remains exact';
  else if (state.frame.lastAction === 'sweep-refused-bounds') statusElement.textContent = 'the sweep refuses · cross farther and release in time';
  else if (state.frame.lastAction === 'sweep-refused-no-arm') statusElement.textContent = 'no direction offered · the surface stays quiet';
  else if (state.frame.lastAction === 'beat-lifted') statusElement.textContent = 'latest pulse lifted · the prior horizon returns';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before another pulse';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the terrain returns to quiet';
  else statusElement.textContent = 'drag across the surface · release a direction';
};
const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);
  drawTerrain(width, height, now);
  drawDrag(width, height);
  updateReadout();
  state.gpu?.render();
};
const renderState = (next) => { state.frame = next; render(); };
const pulse = () => {
  const [start, end] = defaultSweep(state.frame);
  let next = armSurface(state.frame, { ...start, at: 0 });
  next = releaseSurface(next, { ...end, releasedAt: 420 });
  renderState(next);
};
const lift = () => renderState(liftLatestBeat(state.frame));
const release = () => renderState(releaseArchive());
const beginPointer = (event) => {
  state.pointerActive = true;
  const point = normalizedPoint(event);
  state.frame = armSurface(state.frame, { ...point, at: performance.now() });
  canvas.setPointerCapture?.(event.pointerId);
  render();
};
const movePointer = (event) => {
  const point = normalizedPoint(event);
  state.hover = point;
  if (state.pointerActive) state.frame = moveSurface(state.frame, { ...point });
  render();
};
const finishPointer = (event) => {
  if (!state.pointerActive) return;
  state.pointerActive = false;
  const point = normalizedPoint(event);
  renderState(releaseSurface(state.frame, { ...point, releasedAt: performance.now() }));
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
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let wave = 0.012 + 0.008 * sin(pos.x * 0.016 + pos.y * 0.013); return vec4f(0.018 + wave, 0.06 + wave * 0.8, 0.07 + wave, 0.11); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / PROPAGATION VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

canvas.addEventListener('pointerdown', beginPointer);
canvas.addEventListener('pointermove', movePointer);
canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pulse(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
  if (event.key.startsWith('Arrow')) { event.preventDefault(); pulse(); }
});
document.querySelector('[data-gesture="pulse"]')?.addEventListener('click', pulse);
document.querySelector('[data-gesture="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-gesture="release"]')?.addEventListener('click', release);
window.addEventListener('resize', resize);

resize();
window.__mutineReady = true;
window.__mutineWebGPUV033 = {
  getState: () => ({ stage: state.frame.stage, memory: state.frame.memory.length, drag: state.frame.drag, signature: geometrySignature(state.frame), event: state.frame.memory.at(-1) ?? null, action: state.frame.lastAction, renderer: state.renderer }),
  getSamplePoints: () => samplePoints(),
  arm: (point) => { state.frame = armSurface(state.frame, point); render(); },
  move: (point) => { state.frame = moveSurface(state.frame, point); render(); },
  release: (point) => { renderState(releaseSurface(state.frame, { ...point, releasedAt: point.releasedAt ?? performance.now() })); },
  pulse,
  lift,
  releaseArchive: release
};
setupGPU();
if (!staticMode && !reducedMotion) {
  const loop = (now) => { render(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
