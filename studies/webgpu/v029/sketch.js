import {
  FIBER_COUNT,
  STRAND_COUNT,
  STAGES,
  armCut,
  buildTimeline,
  commitCompression,
  defaultCut,
  geometrySignature,
  liftLatestCompression,
  releaseArchive
} from './engine.mjs';

const canvas = document.querySelector('#pressure-field');
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
  renderer: 'CANVAS / FIELD',
  gesture: { active: false, start: null, end: null, startedAt: 0 }
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#100d19',
  deep: '#080611',
  violet: '#9e8bcb',
  violetBright: '#d7c7f3',
  coral: '#f27f68',
  lime: '#c9d87e',
  paper: '#efe7cf',
  ink: '#05030b',
  mist: 'rgba(185,168,223,.15)'
};

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

const pointFor = (fiber, width, height, time) => {
  const motion = reducedMotion || staticMode ? 0 : time * 0.00016;
  const sway = Math.sin(motion + fiber.phase) * 0.012 + Math.cos(motion * .63 + fiber.id) * 0.006;
  return {
    x: (fiber.x + fiber.slip * 0.028) * width,
    y: (fiber.y + sway + fiber.shear * 0.018) * height
  };
};

const drawGrain = (width, height) => {
  ctx.save();
  ctx.globalAlpha = .13;
  ctx.fillStyle = PALETTE.paper;
  for (let index = 0; index < 460; index += 1) {
    const x = pseudo(index * 1.31 + 22) * width;
    const y = pseudo(index * 2.77 + 17) * height;
    const size = pseudo(index * 4.07 + 5) * 1.1 + .15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * .52, height * .47, 0, width * .52, height * .5, Math.max(width, height) * .82);
  gradient.addColorStop(0, '#272044');
  gradient.addColorStop(.29, '#1a1530');
  gradient.addColorStop(.7, PALETTE.deep);
  gradient.addColorStop(1, '#04030a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGrain(width, height);

  ctx.save();
  ctx.globalAlpha = .19;
  ctx.strokeStyle = PALETTE.mist;
  ctx.lineWidth = Math.max(.6, Math.min(width, height) * .001);
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * .00018) * width * .012;
  ctx.beginPath();
  ctx.moveTo(width * .06 + drift, height * .86);
  ctx.bezierCurveTo(width * .24, height * .54, width * .58, height * .48, width * .94 - drift, height * .13);
  ctx.stroke();
  ctx.globalAlpha = .08;
  ctx.beginPath();
  ctx.moveTo(width * .08, height * .2);
  ctx.bezierCurveTo(width * .35, height * .5, width * .67, height * .43, width * .92, height * .78);
  ctx.stroke();
  ctx.restore();
};

const fiberPath = (fiber, next, width, height, time) => {
  const a = pointFor(fiber, width, height, time);
  const b = pointFor(next, width, height, time);
  const bend = (next.y - fiber.y) * height * .34 + (fiber.shear - next.shear) * height * .03;
  return { a, b, c1: { x: lerp(a.x, b.x, .28), y: a.y + bend }, c2: { x: lerp(a.x, b.x, .74), y: b.y - bend * .8 } };
};

const strandColor = (strand) => [PALETTE.violetBright, PALETTE.coral, PALETTE.lime][strand % 3];

const drawSegment = (curve, color, width, alpha) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(curve.a.x, curve.a.y);
  ctx.bezierCurveTo(curve.c1.x, curve.c1.y, curve.c2.x, curve.c2.y, curve.b.x, curve.b.y);
  ctx.stroke();
  ctx.restore();
};

const drawFibers = (width, height, time) => {
  const fibers = state.frame.field.fibers;
  for (let strand = 0; strand < STRAND_COUNT; strand += 1) {
    const chain = fibers.filter((fiber) => fiber.strand === strand).sort((a, b) => a.step - b.step);
    for (let index = 0; index < chain.length - 1; index += 1) {
      const fiber = chain[index];
      const next = chain[index + 1];
      const curve = fiberPath(fiber, next, width, height, time);
      const silent = Math.max(fiber.gap, next.gap);
      const pressure = fiber.pressure + next.pressure;
      const alpha = .38 + Math.min(.42, pressure * .08);
      const strokeWidth = Math.max(1.1, Math.min(width, height) * (.002 + fiber.width * .05 + pressure * .0011));
      if (silent < .16) drawSegment(curve, strandColor(strand), strokeWidth, alpha);
      if (silent > .16 && silent < .62) {
        const split = .5 + Math.sin(fiber.id * 1.7) * .12;
        const first = { ...curve, b: { x: lerp(curve.a.x, curve.b.x, split - .08), y: lerp(curve.a.y, curve.b.y, split - .08) } };
        const second = { ...curve, a: { x: lerp(curve.a.x, curve.b.x, split + .1), y: lerp(curve.a.y, curve.b.y, split + .1) } };
        drawSegment(first, strandColor(strand), strokeWidth, alpha * .8);
        drawSegment(second, strandColor(strand), strokeWidth, alpha * .74);
      }
    }
  }
};

const drawFiberNodes = (width, height, time) => {
  state.frame.field.fibers.forEach((fiber) => {
    const point = pointFor(fiber, width, height, time);
    const pressure = clamp(fiber.pressure, 0, 1.8);
    const gap = clamp(fiber.gap, 0, .82);
    const radius = Math.max(2.5, Math.min(width, height) * (.009 + fiber.width * .09 + pressure * .005));
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(fiber.shear * .12 + fiber.slip * .08);
    ctx.globalAlpha = .45 + Math.min(.4, pressure * .1);
    ctx.fillStyle = strandColor(fiber.strand);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (1.2 + pressure * .18), radius * (.7 + fiber.wake * .1), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = .6;
    ctx.strokeStyle = gap > .16 ? PALETTE.paper : PALETTE.mist;
    ctx.lineWidth = Math.max(.6, radius * .12);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (1.75 + gap * .22), radius * (1.15 + pressure * .1), 0, 0, Math.PI * 2);
    ctx.stroke();
    if (gap > .16) {
      ctx.globalAlpha = Math.min(.92, .35 + gap);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = Math.max(2, radius * .55);
      ctx.beginPath();
      ctx.moveTo(-radius * 1.8, -radius * .1);
      ctx.lineTo(radius * 1.8, radius * .1);
      ctx.stroke();
    }
    ctx.restore();
  });
};

const drawPressureMarks = (width, height, time) => {
  state.frame.memory.forEach((event, index) => {
    const knot = state.frame.field.fibers[event.knot];
    const counter = state.frame.field.fibers[event.counter];
    const a = pointFor(knot, width, height, time);
    const b = pointFor(counter, width, height, time);
    ctx.save();
    ctx.globalAlpha = .18 + index * .04;
    ctx.strokeStyle = index % 2 ? PALETTE.coral : PALETTE.violetBright;
    ctx.lineWidth = Math.max(.7, Math.min(width, height) * .0011);
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(lerp(a.x, b.x, .22), a.y - height * .1, lerp(a.x, b.x, .75), b.y + height * .1, b.x, b.y);
    ctx.stroke();
    ctx.restore();
  });
};

const drawGesture = (width, height) => {
  const { start, end, active } = state.gesture;
  if (!active || !start || !end) return;
  ctx.save();
  ctx.globalAlpha = .72;
  ctx.strokeStyle = PALETTE.paper;
  ctx.lineWidth = Math.max(1, Math.min(width, height) * .0015);
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(start.x * width, start.y * height);
  ctx.lineTo(end.x * width, end.y * height);
  ctx.stroke();
  ctx.fillStyle = PALETTE.coral;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(start.x * width, start.y * height, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(end.x * width, end.y * height, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `field ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'compression' : 'compressions'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'compression-committed') statusElement.textContent = 'cut released · resistance moved to a remote knot';
  else if (state.frame.lastAction === 'cut-armed') statusElement.textContent = 'cut held · release to ask the field where pressure goes';
  else if (state.frame.lastAction === 'compression-refused-short' || state.frame.lastAction === 'compression-refused-same-band') statusElement.textContent = 'the field refuses a short cut · no history added';
  else if (state.frame.lastAction === 'compression-lifted') statusElement.textContent = 'latest compression lifted · braid restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before another cut';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the braid returns to quiet';
  else statusElement.textContent = `${FIBER_COUNT} fibers · draw a cut across the braid`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(width, height, now);
  drawFibers(width, height, now);
  drawPressureMarks(width, height, now);
  drawFiberNodes(width, height, now);
  drawGesture(width, height);
  updateReadout();
  state.gpu?.render();
};

const renderState = (next) => { state.frame = next; render(); };
const commit = () => {
  const next = commitCompression(state.frame);
  state.gesture = { active: false, start: null, end: null, startedAt: 0 };
  renderState(next);
};
const lift = () => renderState(liftLatestCompression(state.frame));
const release = () => renderState(releaseArchive());

const normalizedPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
  };
};

const beginPointer = (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  const point = normalizedPoint(event);
  state.gesture = { active: true, start: point, end: point, startedAt: performance.now() };
  renderState(armCut(state.frame, { start: point.x, end: point.x, startedAt: state.gesture.startedAt, releasedAt: state.gesture.startedAt }));
};
const movePointer = (event) => {
  if (!state.gesture.active) return;
  state.gesture.end = normalizedPoint(event);
  render();
};
const endPointer = (event) => {
  if (!state.gesture.active) return;
  const point = normalizedPoint(event);
  const releasedAt = performance.now();
  state.gesture.end = point;
  const armed = armCut(state.frame, { start: state.gesture.start.x, end: point.x, startedAt: state.gesture.startedAt, releasedAt });
  state.frame = armed;
  commit();
};

const deterministicCommit = () => {
  const cut = state.frame.armed?.start !== state.frame.armed?.end
    ? state.frame.armed
    : { ...defaultCut(), startedAt: 10, releasedAt: 280 };
  renderState(armCut(state.frame, cut));
  commit();
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
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let signal = 0.018 + 0.011 * sin(pos.x * 0.011 + pos.y * 0.019); return vec4f(0.09 + signal, 0.05 + signal * 0.55, 0.16 + signal, 0.14); }` });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    state.gpu = { device, context, pipeline, render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / FIELD VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

canvas.addEventListener('pointerdown', beginPointer);
canvas.addEventListener('pointermove', movePointer);
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', () => { state.gesture = { active: false, start: null, end: null, startedAt: 0 }; render(); });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); deterministicCommit(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
});
document.querySelector('[data-gesture="compress"]')?.addEventListener('click', deterministicCommit);
document.querySelector('[data-gesture="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-gesture="release"]')?.addEventListener('click', release);
window.addEventListener('resize', resize);

resize();
window.__mutineReady = true;
window.__mutineProbe = () => ({ memory: state.frame.memory.length, signature: geometrySignature(state.frame), action: state.frame.lastAction });
setupGPU();
if (!staticMode && !reducedMotion) {
  const tick = (now) => { render(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

void geometrySignature;
