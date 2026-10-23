import {
  STAGES,
  CELL_COUNT,
  buildFrame,
  buildTimeline,
  commitQuorum,
  geometrySignature,
  liftLatestQuorum,
  releaseArchive,
  witnessCell
} from './engine.mjs';

const canvas = document.querySelector('#quorum-field');
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
  renderer: 'CANVAS / QUORUM MEMBRANE',
  hover: null
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const PALETTE = ['#7cd7c8', '#ff856b', '#e4bd6d', '#b7a6e8', '#eef0e3'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pseudo = (value) => {
  const raw = Math.sin(value * 13.127 + 9.71) * 43758.5453;
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

const center = (width, height) => ({ x: width * 0.51, y: height * 0.5, scale: Math.min(width, height) * 0.84 });
const cellPoint = (cell, width, height, time) => {
  const { x, y, scale } = center(width, height);
  const breath = reducedMotion || staticMode ? 0 : Math.sin(time * 0.00019 + cell.phase) * scale * 0.004;
  return { x: x + (cell.x - 0.5) * scale + breath, y: y + (cell.y - 0.5) * scale * 0.96 + breath * 0.35 };
};
const cellRadius = (cell, width, height) => Math.min(width, height) * (0.037 + cell.size * 0.014) * (1 - cell.voidness * 0.12);
const polygonPath = (context, radius, phase, sides = 7, skew = 1) => {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2 + phase;
    const wobble = 0.84 + pseudo(index * 6.1 + phase * 3.7 + radius) * 0.22;
    const px = Math.cos(angle) * radius * wobble;
    const py = Math.sin(angle) * radius * wobble * skew;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
};
const drawTexture = (width, height) => {
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#eef0e3';
  for (let index = 0; index < 480; index += 1) {
    const x = pseudo(index * 1.31 + 2) * width;
    const y = pseudo(index * 2.77 + 14) * height;
    const size = pseudo(index * 4.07 + 5) * 1.15 + 0.15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};
const drawBackground = (width, height) => {
  const gradient = ctx.createRadialGradient(width * 0.52, height * 0.48, 0, width * 0.52, height * 0.48, Math.max(width, height) * 0.78);
  gradient.addColorStop(0, '#172b32');
  gradient.addColorStop(0.28, '#101d29');
  gradient.addColorStop(0.7, '#080d16');
  gradient.addColorStop(1, '#03050b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawTexture(width, height);
  const { x, y, scale } = center(width, height);
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#eef0e3';
  ctx.lineWidth = Math.max(0.5, Math.min(width, height) * 0.0007);
  ctx.setLineDash([1, Math.min(width, height) * 0.012]);
  ctx.beginPath();
  ctx.arc(x, y, scale * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};
const drawCentralAbsence = (width, height) => {
  const { x, y, scale } = center(width, height);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  const radius = scale * 0.073;
  ctx.shadowColor = '#02050b';
  ctx.shadowBlur = radius * 1.8;
  polygonPath(ctx, radius, Math.PI / 8, 9, 0.78);
  ctx.fillStyle = '#03050b';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(238,240,227,.55)';
  ctx.lineWidth = Math.max(0.8, scale * 0.0012);
  polygonPath(ctx, radius * 1.08, Math.PI / 8, 9, 0.78);
  ctx.stroke();
  ctx.restore();
};
const drawLinks = (field, width, height, time) => {
  const points = new Map(field.cells.map((cell) => [cell.id, cellPoint(cell, width, height, time)]));
  ctx.save();
  field.links.forEach((link, index) => {
    const a = points.get(link.a);
    const b = points.get(link.b);
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const bend = (index % 2 ? 1 : -1) * Math.min(width, height) * (0.012 + link.open * 0.02);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 - dy * 0.06 + bend, (a.y + b.y) / 2 + dx * 0.06 + bend, b.x, b.y);
    ctx.strokeStyle = link.tension > 0.2 ? `rgba(228,189,109,${0.25 + link.tension * 0.42})` : `rgba(124,215,200,${0.08 + link.tension * 0.55})`;
    ctx.lineWidth = Math.max(0.7, Math.min(width, height) * (0.00065 + link.tension * 0.0012));
    ctx.stroke();
  });
  ctx.restore();
};
const drawCell = (cell, index, width, height, time) => {
  const point = cellPoint(cell, width, height, time);
  const scale = Math.min(width, height);
  const radius = cellRadius(cell, width, height);
  const color = PALETTE[(index + Math.round(cell.proxy * 3) + Math.round(cell.bridge * 2)) % PALETTE.length];
  const selected = state.frame.witnesses.includes(cell.id);
  const hovered = state.hover === cell.id;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(cell.tilt + Math.sin(time * 0.00013 + cell.phase) * (reducedMotion || staticMode ? 0 : 0.018));
  ctx.shadowColor = color;
  ctx.shadowBlur = scale * (0.008 + cell.proxy * 0.022);
  ctx.globalAlpha = 0.17 + cell.voice * 0.18 + cell.proxy * 0.22;
  ctx.fillStyle = color;
  polygonPath(ctx, radius * (1.1 + cell.bridge * 0.12), cell.phase, 7, 0.82);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.7, scale * (0.00085 + cell.proxy * 0.001));
  polygonPath(ctx, radius, cell.phase, 7, 0.82);
  ctx.stroke();
  if (cell.proxy > 0.06) {
    ctx.globalAlpha = 0.62 + cell.proxy * 0.2;
    ctx.strokeStyle = '#eef0e3';
    ctx.lineWidth = Math.max(0.7, scale * 0.0011);
    polygonPath(ctx, radius * (0.57 + cell.proxy * 0.18), cell.phase + 0.22, 6, 0.78);
    ctx.stroke();
  }
  if (cell.voidness > 0.06) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#03050b';
    polygonPath(ctx, radius * (0.36 + cell.voidness * 0.5), cell.phase + 0.1, 6, 0.78);
    ctx.fill();
    ctx.globalAlpha = 0.76;
    ctx.strokeStyle = '#eef0e3';
    ctx.lineWidth = Math.max(0.8, scale * 0.0011);
    polygonPath(ctx, radius * (0.42 + cell.voidness * 0.46), cell.phase + 0.1, 6, 0.78);
    ctx.stroke();
  }
  if (cell.bridge > 0.06) {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#e4bd6d';
    ctx.lineWidth = Math.max(1, scale * (0.0012 + cell.bridge * 0.0012));
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, radius * 0.13);
    ctx.bezierCurveTo(-radius * 0.18, -radius * 0.65, radius * 0.22, radius * 0.65, radius * 0.78, -radius * 0.08);
    ctx.stroke();
  }
  if (hovered && !blindMode) {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ff856b';
    ctx.lineWidth = Math.max(1, scale * 0.0014);
    polygonPath(ctx, radius * 1.3, cell.phase, 7, 0.82);
    ctx.stroke();
  }
  ctx.restore();
};
const drawWitnesses = (width, height, time) => {
  if (blindMode) return;
  const scale = Math.min(width, height);
  state.frame.witnesses.forEach((id, index) => {
    const cell = state.frame.field.cells[id];
    const point = cellPoint(cell, width, height, time);
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = '#ff856b';
    ctx.lineWidth = Math.max(1, scale * 0.0011);
    ctx.setLineDash([scale * 0.004, scale * 0.008]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, cellRadius(cell, width, height) * (1.26 + index * 0.11), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff856b';
    ctx.font = `${Math.max(10, scale * 0.014)}px ui-monospace, monospace`;
    ctx.fillText(String(index + 1), point.x + cellRadius(cell, width, height) * 1.25, point.y - cellRadius(cell, width, height) * 1.05);
    ctx.restore();
  });
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `membrane ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'quorum' : 'quorums'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'quorum-committed') statusElement.textContent = 'quorum spent remotely · proxy / void / bridge';
  else if (state.frame.lastAction === 'witness-added') statusElement.textContent = `${state.frame.witnesses.length} witness${state.frame.witnesses.length === 1 ? '' : 'es'} · the membrane stays exact`;
  else if (state.frame.lastAction === 'witness-duplicate') statusElement.textContent = 'that chamber has already witnessed · choose another';
  else if (state.frame.lastAction === 'quorum-refused-incomplete') statusElement.textContent = 'the quorum refuses · three distinct witnesses required';
  else if (state.frame.lastAction === 'quorum-lifted') statusElement.textContent = 'latest quorum lifted · topology restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before another quorum';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the membrane returns to quiet';
  else statusElement.textContent = 'choose three distinct chambers · the membrane waits';
};
const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);
  drawLinks(state.frame.field, width, height, now);
  drawCentralAbsence(width, height);
  [...state.frame.field.cells].sort((a, b) => a.ring - b.ring || a.id - b.id).forEach((cell) => drawCell(cell, cell.id, width, height, now));
  drawWitnesses(width, height, now);
  updateReadout();
  state.gpu?.render();
};
const renderState = (next) => { state.frame = next; render(); };
const witness = (cell) => {
  const next = witnessCell(state.frame, { cell });
  state.frame = next;
  if (next.witnesses.length === 3 && next.lastAction === 'witness-added') state.frame = commitQuorum(next);
  render();
};
const commit = () => {
  let frame = state.frame;
  for (const cell of [2, 9, 17]) {
    if (!frame.witnesses.includes(cell)) frame = witnessCell(frame, { cell });
  }
  renderState(commitQuorum(frame));
};
const lift = () => renderState(liftLatestQuorum(state.frame));
const release = () => renderState(releaseArchive());
const normalizedPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
};
const closestCell = (point) => state.frame.field.cells
  .map((cell) => ({ id: cell.id, distance: Math.hypot(point.x - cell.x, point.y - cell.y) }))
  .sort((a, b) => a.distance - b.distance)[0];

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
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let wave = 0.012 + 0.008 * sin(pos.x * 0.018 + pos.y * 0.011); return vec4f(0.02 + wave, 0.06 + wave * 0.7, 0.08 + wave, 0.11); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / QUORUM VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

canvas.addEventListener('pointermove', (event) => {
  state.hover = closestCell(normalizedPoint(event))?.id ?? null;
  render();
});
canvas.addEventListener('pointerdown', (event) => {
  const nearest = closestCell(normalizedPoint(event));
  witness(nearest?.id ?? 2);
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
});
document.querySelector('[data-gesture="commit"]')?.addEventListener('click', commit);
document.querySelector('[data-gesture="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-gesture="release"]')?.addEventListener('click', release);
window.addEventListener('resize', resize);

resize();
window.__mutineReady = true;
window.__mutineWebGPUV032 = {
  getState: () => ({ stage: state.frame.stage, memory: state.frame.memory.length, witnesses: [...state.frame.witnesses], signature: geometrySignature(state.frame), event: state.frame.memory.at(-1) ?? null, action: state.frame.lastAction, renderer: state.renderer }),
  getCellPoints: () => state.frame.field.cells.map((cell) => ({ id: cell.id, x: cell.x, y: cell.y })),
  witness,
  commit,
  lift,
  releaseArchive: release
};
setupGPU();
if (!staticMode && !reducedMotion) {
  const loop = (now) => { render(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
