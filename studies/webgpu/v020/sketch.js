import {
  MEMORY_LIMIT,
  SLICES,
  STAGES,
  armSlice,
  buildTimeline,
  defaultCue,
  geometrySignature,
  liftLatestPulse,
  pulseSheet,
  releaseSheet
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
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  pointerDown: false
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#0b0d0e',
  ink: '#f1eadb',
  muted: '#a69a87',
  lime: '#c4e17d',
  coral: '#ef8e78',
  blue: '#8bb4db',
  ochre: '#d7ad61'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.73137) * 43758.5453;
  return raw - Math.floor(raw);
};
const sliceTone = (slice) => slice.seal > 0.02 ? PALETTE.coral : slice.fold > 0.02 ? PALETTE.lime : slice.fold < -0.02 ? PALETTE.blue : PALETTE.ink;

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
  const gradient = ctx.createRadialGradient(width * 0.54, height * 0.42, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.82);
  gradient.addColorStop(0, '#252018');
  gradient.addColorStop(0.38, '#111517');
  gradient.addColorStop(1, '#080a0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

const drawAmbientFibers = (width, height, time) => {
  ctx.save();
  ctx.globalAlpha = state.gpu ? 0.08 : 0.14;
  ctx.lineWidth = 0.65;
  for (let index = 0; index < 36; index += 1) {
    const y = height * (0.09 + index * 0.024);
    const drift = Math.sin(time * 0.00008 + index * 0.71) * height * 0.006;
    ctx.strokeStyle = index % 4 === 0 ? PALETTE.ochre : PALETTE.lime;
    ctx.beginPath();
    ctx.moveTo(-width * 0.08, y + drift);
    ctx.bezierCurveTo(width * 0.28, y - height * 0.04, width * 0.66, y + height * 0.035, width * 1.08, y - drift);
    ctx.stroke();
  }
  ctx.restore();
};

const projectSlice = (slice, width, height) => {
  const minDimension = Math.min(width, height);
  const centreX = width * (0.5 + slice.x * 0.86);
  const topY = height * (0.15 + slice.depth * 0.19);
  const baseHeight = height * (0.5 - slice.depth * 0.065);
  const sealScale = 1 - slice.seal * 0.28;
  const centreY = topY + baseHeight * (1 - sealScale) * 0.5;
  const span = width * slice.width * 0.72;
  const foldOffset = slice.fold * minDimension * 0.13;
  const left = centreX - span * 0.5;
  const right = centreX + span * 0.5;
  return {
    left,
    right,
    topY: centreY,
    bottomY: centreY + baseHeight * sealScale,
    foldOffset,
    gap: Math.min(span * 0.42, slice.gap * minDimension * 0.42)
  };
};

const polygon = (points, fill, alpha = 1) => {
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

const stroke = (points, colour, alpha = 1, lineWidth = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

const drawSlice = (slice, index, width, height) => {
  const box = projectSlice(slice, width, height);
  const topLeft = { x: box.left, y: box.topY };
  const topRight = { x: box.right, y: box.topY + box.foldOffset };
  const bottomRight = { x: box.right, y: box.bottomY + box.foldOffset * 1.6 };
  const bottomLeft = { x: box.left, y: box.bottomY };
  const cutX = (box.left + box.right) * 0.5;
  const gap = box.gap;
  const fill = sliceTone(slice);
  const gradient = ctx.createLinearGradient(box.left, box.topY, box.right, box.bottomY);
  gradient.addColorStop(0, fill);
  gradient.addColorStop(0.46, slice.seal > 0 ? '#6f574e' : '#c5b89d');
  gradient.addColorStop(1, '#403e36');
  const leftTop = { x: cutX - gap, y: box.topY + box.foldOffset * 0.5 };
  const leftBottom = { x: cutX - gap, y: box.bottomY + box.foldOffset * 0.8 };
  const rightTop = { x: cutX + gap, y: box.topY + box.foldOffset * 0.5 };
  const rightBottom = { x: cutX + gap, y: box.bottomY + box.foldOffset * 0.8 };

  if (gap > 0.5) {
    polygon([topLeft, leftTop, leftBottom, bottomLeft], gradient, 0.84);
    polygon([rightTop, topRight, bottomRight, rightBottom], gradient, 0.84);
  } else {
    polygon([topLeft, topRight, bottomRight, bottomLeft], gradient, 0.84);
  }

  stroke([topLeft, topRight, bottomRight, bottomLeft], PALETTE.ink, slice.seal > 0 ? 0.64 : 0.36, 0.85);
  if (gap > 0.5) {
    ctx.save();
    ctx.strokeStyle = slice.fold >= 0 ? PALETTE.coral : PALETTE.blue;
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 1.25 + slice.load * 0.18;
    ctx.beginPath();
    ctx.moveTo(leftTop.x, leftTop.y);
    ctx.lineTo(leftBottom.x, leftBottom.y);
    ctx.moveTo(rightTop.x, rightTop.y);
    ctx.lineTo(rightBottom.x, rightBottom.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.12 + slice.load * 0.03;
  ctx.strokeStyle = index % 2 ? PALETTE.lime : PALETTE.ochre;
  ctx.lineWidth = 0.55;
  for (let line = 1; line < 5; line += 1) {
    const t = line / 5;
    const x = box.left + (box.right - box.left) * t;
    const bend = box.foldOffset * (0.2 + t);
    ctx.beginPath();
    ctx.moveTo(x, box.topY + bend);
    ctx.lineTo(x + slice.slant * width * 0.35, box.bottomY + bend);
    ctx.stroke();
  }
  ctx.restore();

  if (state.frame.armedSlice === slice.id && !blindMode) {
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = PALETTE.ochre;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 7]);
    ctx.strokeRect(box.left - 7, box.topY - 7, box.right - box.left + 14, box.bottomY - box.topY + 14);
    ctx.setLineDash([]);
    ctx.restore();
  }
};

const drawSheet = (width, height, time) => {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (!state.gpu) drawFallbackBackground(width, height);
  drawAmbientFibers(width, height, time);
  const binder = state.frame.sheet.binder;
  ctx.save();
  ctx.globalAlpha = state.gpu ? 0.11 : 0.18;
  ctx.strokeStyle = PALETTE.ochre;
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 11 + binder * 2]);
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * (0.82 - binder * 0.012));
  ctx.quadraticCurveTo(width * 0.54, height * (0.73 + binder * 0.01), width * 0.94, height * (0.84 - binder * 0.012));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  [...state.frame.sheet.slices].sort((a, b) => a.depth - b.depth).forEach((slice, index) => drawSlice(slice, index, width, height));

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 90; index += 1) {
    const x = hash(index * 2.1 + binder) * width;
    const y = hash(index * 4.7 + 3) * height;
    ctx.fillRect(x, y, 0.7, 0.7);
  }
  ctx.restore();
  ctx.restore();
};

const updateReadout = () => {
  stageElement.textContent = `sheet ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'pulse' : 'pulses'}`;
  rendererElement.textContent = state.gpu ? 'WEBGPU / MATERIAL FIELD' : 'CANVAS / GPU FALLBACK';
  statusElement.textContent = state.pointerDown
    ? 'pointer tap refused — wheel to choose'
    : `slice ${String(state.frame.armedSlice + 1).padStart(2, '0')} armed · binder ${state.frame.sheet.binder.toFixed(2)}`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSheet(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr, state.frame.sheet.binder);
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const selectedPressure = () => Number((0.56 + (state.frame.armedSlice % 4) * 0.16).toFixed(2));
const commit = () => renderState(pulseSheet(state.frame, { slice: state.frame.armedSlice, pressure: selectedPressure() }));
const lift = () => renderState(liftLatestPulse(state.frame));
const release = () => renderState(releaseSheet());

const armFromX = (clientX) => {
  const rect = canvas.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  const slice = Math.round(ratio * (SLICES - 1));
  if (slice !== state.frame.armedSlice) renderState(armSlice(state.frame, { slice }));
};
const armByOffset = (offset) => {
  const slice = (state.frame.armedSlice + offset + SLICES) % SLICES;
  renderState(armSlice(state.frame, { slice }));
};

canvas.addEventListener('pointermove', (event) => armFromX(event.clientX));
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  state.pointerDown = true;
  render();
});
canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  state.pointerDown = false;
  render();
});
canvas.addEventListener('pointercancel', () => {
  state.pointerDown = false;
  render();
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  armByOffset(event.deltaY >= 0 ? 1 : -1);
}, { passive: false });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    armByOffset(1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    armByOffset(-1);
  } else if (event.key === 'Enter' || event.key === ' ') {
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

document.querySelector('[data-gesture="pulse"]').addEventListener('click', commit);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

const gpuVertex = `
struct Uniforms { time: f32, width: f32, height: f32, binder: f32 };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@vertex fn vsMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(positions[index], 0.0, 1.0);
}`;
const gpuFragment = `
@fragment fn fsMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = position.xy / vec2<f32>(uniforms.width, uniforms.height);
  let wave = 0.5 + 0.5 * sin((uv.x * 15.0 + uv.y * 21.0) + uniforms.time * 0.00017 + uniforms.binder * 0.85);
  let grain = fract(sin(dot(uv + uniforms.binder * 0.02, vec2<f32>(91.17, 37.61))) * 43758.5453);
  let r = 0.025 + wave * 0.045 + grain * 0.018;
  let g = 0.035 + wave * 0.052 + grain * 0.022;
  let b = 0.038 + wave * 0.03 + grain * 0.017;
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
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });
    state.gpu = {
      render: (now, width, height, binder) => {
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([now, width, height, binder]));
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.03, g: 0.04, b: 0.04, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });
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

window.__MUTINE_STATE__ = {
  get frame() { return state.frame; },
  get signature() { return geometrySignature(state.frame); },
  pulse: commit,
  lift,
  release,
  arm: (slice) => renderState(armSlice(state.frame, { slice })),
  wheel: (direction = 1) => armByOffset(direction),
  pointerTap: () => ({ memory: state.frame.memory.length, refused: true })
};

resize();
window.__MUTINE_READY__ = true;
initWebGPU().then((ready) => {
  window.__MUTINE_GPU_READY__ = ready;
  render();
});

const animate = (now) => {
  render(now);
  window.requestAnimationFrame(animate);
};
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
