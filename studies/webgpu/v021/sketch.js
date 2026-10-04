import {
  CARRIERS,
  COLS,
  LAYERS,
  NODE_COUNT,
  ROWS,
  STAGES,
  armNode,
  buildTimeline,
  callField,
  geometrySignature,
  liftLatestCall,
  releaseField,
  tuneCarrier
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
  pointerNode: 0,
  time: 0,
  gpu: null,
  renderer: 'CANVAS / RECIPROCAL FALLBACK'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const carrierElement = document.querySelector('[data-carrier]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#080a13',
  ink: '#edf2ff',
  muted: '#9ba7c2',
  violet: '#b6a2ff',
  cyan: '#75e0d0',
  amber: '#f3bd74',
  coral: '#f18b88',
  blue: '#80a9f4',
  void: '#31384f'
};
const CARRIER_COLOURS = [PALETTE.cyan, PALETTE.violet, PALETTE.amber, PALETTE.coral];
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

const projectNode = (node, width, height) => {
  const depthX = node.z * width * 0.18;
  const depthY = node.z * height * -0.15;
  return {
    x: width * 0.5 + node.x * width * 0.7 + depthX,
    y: height * 0.53 + node.y * height * 0.6 + depthY - node.lift * height * 0.035,
    size: Math.min(width, height) * (0.038 + node.lift * 0.008),
    depth: node.z + node.y * 0.12
  };
};

const nearestNode = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = state.frame.armedNode;
  let bestDistance = Infinity;
  for (const node of state.frame.field.nodes) {
    const point = projectNode(node, rect.width, rect.height);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node.id;
    }
  }
  return best;
};

const colourFor = (node) => {
  if (node.mode === 'caller') return PALETTE.ink;
  if (node.mode === 'distant-reply' || node.mode === 'reply' || node.mode === 'relay') return CARRIER_COLOURS[state.frame.carrier];
  if (node.mode === 'withheld') return PALETTE.void;
  return node.layer === 1 ? PALETTE.blue : 'rgba(237, 242, 255, .68)';
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.56, height * 0.34, 0, width * 0.52, height * 0.54, Math.max(width, height) * 0.8);
  gradient.addColorStop(0, '#252344');
  gradient.addColorStop(.36, '#11182e');
  gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = .17;
  ctx.strokeStyle = PALETTE.violet;
  ctx.lineWidth = .55;
  for (let index = 0; index < 32; index += 1) {
    const y = height * (.11 + index * .027);
    const drift = Math.sin(time * .00006 + index * .41) * height * .012;
    ctx.beginPath();
    ctx.moveTo(-width * .08, y + drift);
    ctx.bezierCurveTo(width * .33, y - height * .05, width * .72, y + height * .035, width * 1.08, y - drift);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .32;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 150; index += 1) {
    const x = hash(index * 1.73) * width;
    const y = hash(index * 4.11 + 3) * height;
    const size = hash(index * 3.37) * 1.1 + .25;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawBridge = (from, to, width, height) => {
  const start = projectNode(from, width, height);
  const end = projectNode(to, width, height);
  ctx.save();
  ctx.globalAlpha = .38;
  ctx.strokeStyle = CARRIER_COLOURS[state.frame.carrier];
  ctx.lineWidth = 1.2 + Math.min(2, from.load * .06);
  ctx.setLineDash([2, 7]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.bezierCurveTo((start.x + end.x) * .5, start.y - height * .13, (start.x + end.x) * .5, end.y + height * .13, end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

const drawCube = (node, width, height) => {
  const point = projectNode(node, width, height);
  const size = point.size * (0.84 + node.active * .18);
  const slant = node.tilt * size * .24;
  const depth = size * .46;
  const half = size * .5;
  const top = { x: point.x, y: point.y - half };
  const left = { x: point.x - half, y: point.y - half * .55 };
  const right = { x: point.x + half, y: point.y - half * .55 + slant };
  const bottom = { x: point.x, y: point.y + half + slant };
  const topBack = { x: top.x + depth, y: top.y - depth * .42 };
  const rightBack = { x: right.x + depth, y: right.y - depth * .42 };
  const bottomBack = { x: bottom.x + depth, y: bottom.y - depth * .42 };
  const fill = colourFor(node);
  const alpha = node.active < .2 ? .18 : .78;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(rightBack.x, rightBack.y); ctx.lineTo(topBack.x, topBack.y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = node.mode === 'withheld' ? '#252b40' : (node.layer === 1 ? '#5687b9' : '#6c5eb2');
  ctx.beginPath();
  ctx.moveTo(top.x, top.y); ctx.lineTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bottomBack.x, bottomBack.y); ctx.lineTo(topBack.x, topBack.y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = node.mode === 'withheld' ? '#1c2235' : '#34466e';
  ctx.beginPath();
  ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bottomBack.x, bottomBack.y); ctx.lineTo(rightBack.x, rightBack.y); ctx.lineTo(right.x, right.y); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = .72;
  ctx.strokeStyle = fill;
  ctx.lineWidth = node.mode === 'caller' ? 2.2 : 0.72;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y); ctx.closePath();
  ctx.stroke();

  if (node.gap > .05 || node.mode === 'withheld') {
    ctx.globalAlpha = .85;
    ctx.strokeStyle = node.mode === 'withheld' ? PALETTE.muted : PALETTE.coral;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(point.x - half * .46, point.y - half * .16);
    ctx.lineTo(point.x + half * .46, point.y + half * .16 + slant);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
};

const drawLattice = (width, height, time) => {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, time);
  const nodes = [...state.frame.field.nodes].sort((a, b) => projectNode(a, width, height).depth - projectNode(b, width, height).depth);
  for (const bridge of state.frame.field.bridges) {
    const from = state.frame.field.nodes[bridge.from];
    const to = state.frame.field.nodes[bridge.to];
    if (from && to) drawBridge(from, to, width, height);
  }
  for (const node of nodes) drawCube(node, width, height);

  if (!blindMode) {
    const armed = state.frame.field.nodes[state.frame.armedNode];
    if (armed) {
      const point = projectNode(armed, width, height);
      ctx.save();
      ctx.globalAlpha = .82;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size * .9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  ctx.restore();
};

const updateReadout = () => {
  stageElement.textContent = `lattice ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'call' : 'calls'}`;
  carrierElement.textContent = `carrier ${String(state.frame.carrier + 1).padStart(2, '0')}`;
  rendererElement.textContent = state.renderer;
  statusElement.textContent = state.pointerDown
    ? 'pointer tap refused — tune a carrier, then call'
    : `node ${String(state.frame.armedNode).padStart(3, '0')} armed · ${state.frame.field.responses.length} replies · ${state.frame.field.vacancies.length} withheld`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawLattice(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr, state.frame.field.resistance, state.frame.carrier);
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const commit = () => renderState(callField(state.frame, { node: state.frame.armedNode, carrier: state.frame.carrier }));
const lift = () => renderState(liftLatestCall(state.frame));
const release = () => renderState(releaseField());
const chooseNode = (node) => {
  if (node !== state.frame.armedNode) renderState(armNode(state.frame, { node }));
};
const chooseCarrier = (carrier) => renderState(tuneCarrier(state.frame, { carrier }));
const chooseCarrierByOffset = (offset) => chooseCarrier((state.frame.carrier + offset + CARRIERS) % CARRIERS);

canvas.addEventListener('pointermove', (event) => chooseNode(nearestNode(event.clientX, event.clientY)));
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
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    chooseCarrierByOffset(1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    chooseCarrierByOffset(-1);
  } else if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    chooseCarrier(Number(event.key) - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

document.querySelector('[data-gesture="call"]').addEventListener('click', commit);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

const gpuVertex = `
struct Uniforms { time: f32, resistance: f32, carrier: f32, pad: f32 };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@vertex fn vsMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(positions[index], 0.0, 1.0);
}`;
const gpuFragment = `
struct Uniforms { time: f32, resistance: f32, carrier: f32, pad: f32 };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@fragment fn fsMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = position.xy / vec2<f32>(1280.0, 900.0);
  let wave = sin((uv.x * 8.0 + uv.y * 5.0) + uniforms.time * 0.00025 + uniforms.carrier * 1.3) * 0.5 + 0.5;
  let pulse = 0.5 + 0.5 * sin(uniforms.time * 0.00015 + uniforms.resistance * 1.7);
  let colour = vec3<f32>(0.04 + wave * 0.05, 0.05 + pulse * 0.07, 0.13 + wave * 0.12);
  return vec4<f32>(colour, 1.0);
}`;

const initGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const moduleVertex = device.createShaderModule({ code: gpuVertex });
    const moduleFragment = device.createShaderModule({ code: gpuFragment });
    const uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bindGroupLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: {} }] });
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: moduleVertex, entryPoint: 'vsMain' },
      fragment: { module: moduleFragment, entryPoint: 'fsMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] });
    state.gpu = {
      render(now, width, height, resistance, carrier) {
        const values = new Float32Array([now, resistance, carrier, 0]);
        device.queue.writeBuffer(uniformBuffer, 0, values);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: .02, g: .03, b: .08, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      }
    };
    state.renderer = 'WEBGPU / CHORUS FIELD';
    render();
  } catch {
    state.gpu = null;
    state.renderer = 'CANVAS / RECIPROCAL FALLBACK';
    render();
  }
};

window.__mutineWebgpuV021 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    carrier: state.frame.carrier,
    armedNode: state.frame.armedNode,
    replies: state.frame.field.responses.length,
    vacancies: state.frame.field.vacancies.length,
    answeredLayers: state.frame.field.answeredLayers,
    resistance: state.frame.field.resistance,
    signature: geometrySignature(state.frame),
    renderer: state.renderer
  })
};

resize();
initGPU();
if (!staticMode && !reducedMotion) {
  const loop = (now) => {
    render(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
