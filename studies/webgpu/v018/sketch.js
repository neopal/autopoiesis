import {
  NODES,
  STAGES,
  armWitness,
  buildTimeline,
  commitWitness,
  defaultCue,
  geometrySignature,
  liftLatestWitness,
  releaseField
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
  pointer: { x: 0.5, y: 0.5 },
  press: null,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#071017',
  ink: '#e8f0ed',
  muted: '#8ca5a4',
  mint: '#82dec5',
  amber: '#edbb72',
  rose: '#ec8d85',
  blue: '#6d9be5'
};

const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.73137) * 43758.5453;
  return raw - Math.floor(raw);
};
const nodePoint = (node) => ({ x: node.x * state.view.width, y: node.y * state.view.height });
const nodeRadius = (node) => node.radius * Math.min(state.view.width, state.view.height);

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

const drawFallbackBackground = (width, height) => {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, '#10252a');
  gradient.addColorStop(0.48, PALETTE.ground);
  gradient.addColorStop(1, '#03070b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

const drawMicrofield = (width, height, time) => {
  ctx.save();
  ctx.globalAlpha = state.gpu ? 0.1 : 0.18;
  ctx.fillStyle = PALETTE.mint;
  for (let index = 0; index < 130; index += 1) {
    const x = hash(index * 2.3) * width;
    const y = hash(index * 4.1 + 7) * height;
    const pulse = 0.25 + hash(index * 3.7) * 0.9 + Math.sin(time * 0.0002 + index) * 0.16;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.2, pulse), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawOrbit = (width, height, time) => {
  const cx = width * 0.5;
  const cy = height * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(time * 0.00008) * 0.012);
  ctx.strokeStyle = PALETTE.mint;
  ctx.globalAlpha = state.gpu ? 0.18 : 0.24;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([1, 9]);
  for (const radius of [Math.min(width, height) * 0.22, Math.min(width, height) * 0.31]) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
};

const polygon = (node, radius, angleOffset = 0, count = 9) => {
  const point = nodePoint(node);
  return Array.from({ length: count }, (_, index) => {
    const angle = node.rotation + angleOffset + index * Math.PI * 2 / count;
    const wobble = 0.88 + hash(node.id * 11 + index * 4.3) * 0.17;
    return { x: point.x + Math.cos(angle) * radius * wobble, y: point.y + Math.sin(angle) * radius * wobble };
  });
};

const fillPolygon = (points, fill, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const strokePolygon = (points, stroke, alpha = 1, width = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

const drawVacancy = (node, radius) => {
  const point = nodePoint(node);
  const gapAngle = node.rotation + 0.34;
  const gapWidth = 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.arc(point.x, point.y, radius * 1.18, gapAngle - gapWidth, gapAngle + gapWidth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = PALETTE.rose;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(point.x + Math.cos(gapAngle - gapWidth) * radius * 0.72, point.y + Math.sin(gapAngle - gapWidth) * radius * 0.72);
  ctx.lineTo(point.x + Math.cos(gapAngle - gapWidth) * radius * 1.18, point.y + Math.sin(gapAngle - gapWidth) * radius * 1.18);
  ctx.moveTo(point.x + Math.cos(gapAngle + gapWidth) * radius * 0.72, point.y + Math.sin(gapAngle + gapWidth) * radius * 0.72);
  ctx.lineTo(point.x + Math.cos(gapAngle + gapWidth) * radius * 1.18, point.y + Math.sin(gapAngle + gapWidth) * radius * 1.18);
  ctx.stroke();
  ctx.restore();
};

const drawAperture = (node, radius) => {
  const point = nodePoint(node);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = PALETTE.amber;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

const drawReply = (source, remote, serial) => {
  const a = nodePoint(source);
  const b = nodePoint(remote);
  const bend = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 - Math.min(state.view.width, state.view.height) * (0.06 + serial * 0.01) };
  ctx.save();
  ctx.globalAlpha = 0.17 + serial * 0.035;
  ctx.strokeStyle = PALETTE.amber;
  ctx.lineWidth = 0.8 + serial * 0.16;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(bend.x, bend.y, b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

const drawNode = (node) => {
  const point = nodePoint(node);
  const radius = nodeRadius(node) * node.scale;
  const isArmed = state.frame.armedNode === node.id;
  const hue = node.aperture > 0 ? PALETTE.amber : node.vacancy > 0 ? PALETTE.rose : (node.id % 3 === 0 ? PALETTE.blue : PALETTE.mint);
  if (isArmed) {
    ctx.save();
    ctx.strokeStyle = PALETTE.ink;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 1.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  fillPolygon(polygon(node, radius), hue, node.vacancy > 0 ? 0.66 : 0.82);
  strokePolygon(polygon(node, radius * 1.02, 0.03), PALETTE.ink, 0.42, 0.8);
  fillPolygon(polygon(node, radius * 0.53, Math.PI / 9, 7), PALETTE.ground, 0.55);
  if (node.vacancy > 0) drawVacancy(node, radius);
  if (node.aperture > 0) drawAperture(node, radius);
};

const drawField = (width, height, time) => {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (!state.gpu) drawFallbackBackground(width, height);
  drawMicrofield(width, height, time);
  drawOrbit(width, height, time);
  const centre = { x: width * 0.5, y: height * 0.5 };
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 6]);
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, Math.min(width, height) * 0.078, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  for (const event of state.frame.field.events) {
    const source = state.frame.field.nodes[event.sourceNode];
    const remote = state.frame.field.nodes[event.remoteNode];
    drawReply(source, remote, event.serial);
  }
  for (const node of state.frame.field.nodes) drawNode(node);
  ctx.restore();
};

const updateReadout = () => {
  stageElement.textContent = `field ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'witness' : 'witnesses'}`;
  rendererElement.textContent = state.gpu ? 'WEBGPU / RADIAL FIELD' : 'CANVAS / GPU FALLBACK';
  statusElement.textContent = state.frame.armedNode >= 0 ? `witness ${String(state.frame.armedNode + 1).padStart(2, '0')} armed` : state.frame.memory.length ? 'wrong reply retained' : 'field awaiting a witness';
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr, state.frame.memory.length);
};

const commit = (cue = null) => {
  const selected = cue || (state.frame.armedNode >= 0 ? { node: state.frame.armedNode } : defaultCue());
  const next = commitWitness(state.frame, selected);
  if (next !== state.frame) {
    state.frame = next;
    render();
  }
};
const lift = () => { state.frame = liftLatestWitness(state.frame); render(); };
const release = () => { state.frame = releaseField(); render(); };
const armFromEvent = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  state.pointer = { x, y };
  let nearest = -1;
  let distance = Infinity;
  state.frame.field.nodes.forEach((node) => {
    const dx = node.x - x;
    const dy = node.y - y;
    const candidate = Math.hypot(dx, dy);
    if (candidate < distance) { distance = candidate; nearest = node.id; }
  });
  if (nearest >= 0 && distance < 0.14 && state.frame.armedNode !== nearest) {
    state.frame = armWitness(state.frame, { node: nearest });
    render();
  }
};

const gpuVertex = `
struct Uniforms { time: f32, width: f32, height: f32, memory: f32 };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@vertex fn vsMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(positions[index], 0.0, 1.0);
}`;
const gpuFragment = `
@fragment fn fsMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = position.xy / vec2<f32>(uniforms.width, uniforms.height);
  let q = uv - vec2<f32>(0.5, 0.5);
  let radius = length(q);
  let sweep = 0.5 + 0.5 * sin(radius * 28.0 - uniforms.time * 0.00032 + uniforms.memory * 0.24);
  let core = exp(-radius * 5.0);
  let r = 0.018 + core * 0.035 + sweep * 0.012;
  let g = 0.045 + core * 0.09 + sweep * 0.02;
  let b = 0.058 + core * 0.1 + sweep * 0.026;
  return vec4<f32>(r, g, b, 1.0);
}`;

const initWebGPU = async () => {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    if (!context) return false;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const module = device.createShaderModule({ code: `${gpuVertex}\n${gpuFragment}` });
    const uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsMain' },
      fragment: { module, entryPoint: 'fsMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] });
    state.gpu = {
      render: (now, width, height, memory) => {
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([now, width, height, memory]));
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0.02, g: 0.04, b: 0.05, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      }
    };
    return true;
  } catch {
    return false;
  }
};

canvas.addEventListener('pointermove', armFromEvent);
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  armFromEvent(event);
  state.press = { node: state.frame.armedNode, started: performance.now(), pointerId: event.pointerId };
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  const press = state.press;
  state.press = null;
  canvas.releasePointerCapture?.(event.pointerId);
  if (press && press.node >= 0 && performance.now() - press.started >= 420) commit({ node: press.node });
});
canvas.addEventListener('pointercancel', () => { state.press = null; });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

document.querySelector('[data-gesture="witness"]').addEventListener('click', () => commit());
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__MUTINE_STATE__ = {
  get frame() { return state.frame; },
  get signature() { return geometrySignature(state.frame); },
  witness: commit,
  lift,
  release,
  arm: (node) => { state.frame = armWitness(state.frame, { node }); render(); },
  pointer: () => ({ ...state.pointer })
};

resize();
window.__MUTINE_READY__ = true;
initWebGPU().then((ready) => {
  if (ready) render();
  window.__MUTINE_GPU_READY__ = ready;
});

const animate = (now) => {
  render(now);
  window.requestAnimationFrame(animate);
};
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
