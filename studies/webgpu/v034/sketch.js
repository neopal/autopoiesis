import {
  STAGES,
  buildFrame,
  buildTimeline,
  attendChorus,
  moveChorus,
  releaseChorus,
  liftLatestRelay,
  releaseArchive,
  defaultRelay
} from './engine.mjs';

const canvas = document.querySelector('#chorus-field');
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
  pointerActive: false,
  gpu: null,
  renderer: 'CANVAS / ORBITAL CHORUS'
};
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const TAU = Math.PI * 2;
const PALETTE = {
  night: [4, 3, 14],
  violet: [155, 140, 255],
  cyan: [99, 229, 220],
  coral: [255, 143, 134],
  gold: [240, 199, 122],
  bone: [236, 233, 255]
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
const pseudo = (value) => {
  const raw = Math.sin(value * 11.713 + 2.41) * 43758.5453;
  return raw - Math.floor(raw);
};
const normalizeAngle = (value) => ((value % 1) + 1) % 1;
const angleFromPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = ((event.clientY - rect.top) / rect.height - 0.53) / 0.78;
  return normalizeAngle(Math.atan2(y, x) / TAU);
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
const orbitPoint = (agent, width, height, time) => {
  const span = Math.min(width, height);
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * 0.00009 + agent.id * 0.37) * 0.008;
  const theta = agent.angle * TAU + agent.phase * 0.42 + drift;
  const orbitX = span * (0.12 + agent.radius * 0.31);
  const orbitY = span * (0.08 + agent.radius * 0.19);
  return {
    x: width * 0.5 + Math.cos(theta) * orbitX,
    y: height * 0.53 + Math.sin(theta) * orbitY - agent.depth * span * 0.07,
    theta,
    span
  };
};
const fillBlade = (agent, point, color, alpha) => {
  const length = point.span * (0.018 + agent.aperture * 0.042 + agent.reciprocity * 0.016);
  const width = point.span * (0.003 + agent.reciprocity * 0.013);
  const angle = point.theta + Math.PI * 0.5 + agent.phase * 1.6;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const px = -ny;
  const py = nx;
  const tip = { x: point.x + nx * length, y: point.y + ny * length };
  const tail = { x: point.x - nx * length * 0.6, y: point.y - ny * length * 0.6 };
  ctx.beginPath();
  ctx.moveTo(tail.x + px * width, tail.y + py * width);
  ctx.lineTo(point.x + px * width * 0.58, point.y + py * width * 0.58);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(point.x - px * width * 0.58, point.y - py * width * 0.58);
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.bone, 0.16 + agent.reciprocity * 0.2);
  ctx.lineWidth = Math.max(0.45, point.span * 0.0007);
  ctx.stroke();
};
const drawBackground = (width, height) => {
  const gradient = ctx.createRadialGradient(width * 0.48, height * 0.48, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.76);
  gradient.addColorStop(0, '#1b1742');
  gradient.addColorStop(0.28, '#0d1231');
  gradient.addColorStop(0.72, '#06071b');
  gradient.addColorStop(1, '#02020a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = 0.2;
  for (let index = 0; index < 420; index += 1) {
    const x = pseudo(index * 1.31 + 2) * width;
    const y = pseudo(index * 2.73 + 7) * height;
    const size = pseudo(index * 4.17 + 11) * 1.6 + 0.2;
    ctx.fillStyle = index % 3 ? rgba(PALETTE.bone, 0.18) : rgba(PALETTE.cyan, 0.25);
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};
const drawAbsence = (width, height) => {
  const span = Math.min(width, height);
  const halo = ctx.createRadialGradient(width * 0.5, height * 0.53, span * 0.03, width * 0.5, height * 0.53, span * 0.3);
  halo.addColorStop(0, 'rgba(0,0,0,.84)');
  halo.addColorStop(0.54, 'rgba(3,3,11,.56)');
  halo.addColorStop(1, 'rgba(3,3,11,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width * 0.5, height * 0.53);
  ctx.rotate(-0.12);
  ctx.strokeStyle = rgba(PALETTE.violet, 0.18);
  ctx.lineWidth = Math.max(0.7, span * 0.001);
  ctx.setLineDash([span * 0.006, span * 0.017]);
  ctx.beginPath();
  ctx.ellipse(0, 0, span * 0.29, span * 0.16, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.12);
  ctx.beginPath();
  ctx.ellipse(0, 0, span * 0.18, span * 0.085, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
};
const drawOrbitEchoes = (width, height, time) => {
  const span = Math.min(width, height);
  ctx.save();
  ctx.translate(width * 0.5, height * 0.53);
  ctx.rotate(-0.1);
  for (let index = 0; index < 7; index += 1) {
    const radiusX = span * (0.17 + index * 0.027);
    const radiusY = span * (0.095 + index * 0.016);
    const start = -0.4 + Math.sin(index * 2.2 + time * 0.00008) * 0.06;
    const end = start + Math.PI * (0.52 + (index % 3) * 0.22);
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, start, end);
    ctx.strokeStyle = index % 2 ? rgba(PALETTE.violet, 0.11) : rgba(PALETTE.cyan, 0.09);
    ctx.lineWidth = Math.max(0.45, span * (0.00055 + index * 0.00006));
    ctx.stroke();
  }
  ctx.restore();
};
const drawRelays = (width, height) => {
  const agents = state.frame.field.agents;
  const span = Math.min(width, height);
  state.frame.memory.forEach((event, index) => {
    const source = agents[event.sourceSector];
    const reply = agents[event.replySector];
    if (!source || !reply) return;
    const a = orbitPoint(source, width, height, state.time);
    const b = orbitPoint(reply, width, height, state.time);
    const bend = (index % 2 ? -1 : 1) * span * (0.06 + index * 0.012);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(width * 0.5 + bend, height * 0.2, width * 0.5 - bend, height * 0.82, b.x, b.y);
    ctx.strokeStyle = rgba(index % 2 ? PALETTE.cyan : PALETTE.coral, 0.12 + index * 0.025);
    ctx.lineWidth = Math.max(0.65, span * 0.0012);
    ctx.setLineDash([span * 0.004, span * 0.018]);
    ctx.stroke();
    ctx.restore();
  });
};
const drawAgents = (width, height) => {
  const sorted = [...state.frame.field.agents].sort((a, b) => a.depth - b.depth);
  sorted.forEach((agent) => {
    const point = orbitPoint(agent, width, height, state.time);
    const warmth = clamp(agent.reciprocity * 0.9 + (agent.radius - 0.45) * 0.7, 0, 1);
    const color = mix(mix(PALETTE.violet, PALETTE.cyan, agent.aperture * 0.7), PALETTE.coral, warmth);
    ctx.save();
    ctx.shadowColor = rgba(color, 0.75);
    ctx.shadowBlur = point.span * (0.012 + agent.reciprocity * 0.022);
    ctx.globalAlpha = 0.3 + agent.depth * 0.35;
    fillBlade(agent, point, color, 0.42 + agent.reciprocity * 0.4);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.32 + agent.reciprocity * 0.42;
    fillBlade(agent, point, mix(color, PALETTE.bone, 0.32), 0.26);
    ctx.restore();
  });
};
const drawListeningGate = (width, height) => {
  if (blindMode || !state.frame.attention) return;
  const span = Math.min(width, height);
  const start = state.frame.attention.startAngle * TAU;
  const current = state.frame.attention.currentAngle * TAU;
  ctx.save();
  ctx.translate(width * 0.5, height * 0.53);
  ctx.rotate(-0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, span * 0.31, span * 0.17, 0, start, current);
  ctx.strokeStyle = rgba(PALETTE.coral, 0.82);
  ctx.lineWidth = Math.max(1.3, span * 0.0015);
  ctx.setLineDash([span * 0.008, span * 0.014]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};
const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `rehearsal ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'relay' : 'relays'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'relay-committed') statusElement.textContent = 'relay released · the answer widened elsewhere';
  else if (state.frame.lastAction === 'listen-armed' || state.frame.lastAction === 'listen-moving') statusElement.textContent = 'listening armed · the orbit remains exact';
  else if (state.frame.lastAction === 'listen-refused-bounds') statusElement.textContent = 'the relation refuses · cross farther and release in time';
  else if (state.frame.lastAction === 'listen-refused-no-arm') statusElement.textContent = 'no listener offered · the chorus stays quiet';
  else if (state.frame.lastAction === 'relay-lifted') statusElement.textContent = 'latest relay lifted · the prior distance returns';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'chorus full · lift or release before another relay';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'chorus released · the orbit returns to quiet';
  else statusElement.textContent = 'trace an arc · release the answer elsewhere';
};
const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);
  drawAbsence(width, height);
  drawOrbitEchoes(width, height, now);
  drawRelays(width, height);
  drawAgents(width, height);
  drawListeningGate(width, height);
  updateReadout();
  state.gpu?.render();
};
const renderState = (next) => { state.frame = next; render(); };
const relay = () => {
  const [startAngle, endAngle] = defaultRelay(state.frame);
  let next = attendChorus(state.frame, { angle: startAngle, at: 0 });
  next = releaseChorus(next, { angle: endAngle, releasedAt: 420 });
  renderState(next);
};
const lift = () => renderState(liftLatestRelay(state.frame));
const release = () => renderState(releaseArchive());
const beginPointer = (event) => {
  state.pointerActive = true;
  const angle = angleFromPoint(event);
  state.frame = attendChorus(state.frame, { angle, at: performance.now() });
  canvas.setPointerCapture?.(event.pointerId);
  render();
};
const movePointer = (event) => {
  if (state.pointerActive) state.frame = moveChorus(state.frame, { angle: angleFromPoint(event) });
  render();
};
const finishPointer = (event) => {
  if (!state.pointerActive) return;
  state.pointerActive = false;
  const angle = angleFromPoint(event);
  renderState(releaseChorus(state.frame, { angle, releasedAt: performance.now() }));
  canvas.releasePointerCapture?.(event.pointerId);
};
const keyboard = (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); relay(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
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
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let grain = 0.008 * sin(pos.x * 0.019 + pos.y * 0.011); return vec4f(0.03 + grain, 0.02 + grain * 0.5, 0.09 + grain, 0.12); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / ORBITAL VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

canvas.addEventListener('pointerdown', beginPointer);
canvas.addEventListener('pointermove', movePointer);
canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('keydown', keyboard);
document.querySelector('[data-gesture="relay"]').addEventListener('click', relay);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);
window.__mutineWebGPUV034 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    attention: state.frame.attention,
    signature: state.frame.field.signature,
    agents: state.frame.field.agents.map((agent) => ({ ...agent })),
    event: state.frame.memory.at(-1) ?? null,
    lastAction: state.frame.lastAction,
    renderer: state.renderer
  })
};
resize();
setupGPU();
