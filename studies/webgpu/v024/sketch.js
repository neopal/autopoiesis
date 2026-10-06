import {
  LOOP_COUNT,
  LOOP_SEGMENTS,
  MIN_PAUSE_MS,
  STAGES,
  armPause,
  buildTimeline,
  commitPause,
  defaultPause,
  geometrySignature,
  liftLatestPause,
  releaseArchive
} from './engine.mjs';

const canvas = document.querySelector('#archive-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  selectedRing: 7,
  pointer: null,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  renderer: 'CANVAS / LOOP PROJECTION'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const armedElement = document.querySelector('[data-armed]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#05070b',
  deep: '#0a1319',
  ink: '#eef0e9',
  cyan: '#7adbd1',
  amber: '#e7b676',
  violet: '#a69de8',
  coral: '#e18a83',
  blue: '#6e91bc'
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.91731) * 43758.5453;
  return raw - Math.floor(raw);
};
const lerp = (a, b, amount) => a + (b - a) * amount;

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

const loopScreenCenter = (loop, width, height, time) => {
  const rotation = staticMode || reducedMotion ? 0.08 : time * 0.000025;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const rotatedX = loop.x * cosine - loop.z * sine;
  const rotatedZ = loop.x * sine + loop.z * cosine;
  const depth = 1 + rotatedZ * 0.36;
  const scale = Math.min(width, height) * 0.84;
  return {
    x: width * 0.5 + rotatedX * scale / depth,
    y: height * 0.52 + loop.y * scale * 0.79 / depth,
    depth: rotatedZ,
    scale: scale / depth
  };
};

const projectPoint = (loop, theta, width, height, time, phaseShift = 0) => {
  const center = loopScreenCenter(loop, width, height, time);
  const angle = theta + loop.rotation + phaseShift;
  const localX = Math.cos(angle) * loop.radiusX * center.scale;
  const localY = Math.sin(angle) * loop.radiusY * center.scale;
  const localDepth = Math.sin(angle) * 0.12 * center.scale;
  const tilt = Math.sin(loop.rotation) * localY * 0.15;
  return {
    x: center.x + localX + tilt,
    y: center.y + localY,
    depth: center.depth + localDepth / Math.max(1, center.scale),
    center
  };
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.57, height * 0.38, 0, width * 0.5, height * 0.54, Math.max(width, height) * 0.86);
  gradient.addColorStop(0, '#172630');
  gradient.addColorStop(.3, '#0c171e');
  gradient.addColorStop(.72, '#081016');
  gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = .28;
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 1;
  ctx.setLineDash([1, Math.max(5, width * .012)]);
  ctx.beginPath();
  ctx.moveTo(width * .5, height * .12);
  ctx.lineTo(width * .5, height * .88);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .28;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 240; index += 1) {
    const x = hash(index * 1.73 + 1) * width;
    const y = hash(index * 4.11 + 3) * height;
    const size = hash(index * 3.37 + 4) * 1.1 + .25;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .22;
  const pulse = .5 + Math.sin(time * .00032) * .5;
  const haze = ctx.createRadialGradient(width * .52, height * (.48 + pulse * .03), 0, width * .52, height * .5, Math.min(width, height) * .34);
  haze.addColorStop(0, PALETTE.violet);
  haze.addColorStop(1, 'transparent');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const isInGap = (loop, theta) => {
  const gapSize = loop.opening * 1.7;
  if (gapSize <= 0.015) return false;
  const centered = ((theta - loop.phase + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return Math.abs(centered) < gapSize * 0.5;
};

const loopColour = (loop, index) => {
  if (loop.delay > .52) return PALETTE.coral;
  if (loop.opening > .22) return PALETTE.amber;
  return [PALETTE.cyan, PALETTE.violet, PALETTE.blue, PALETTE.ink][index % 4];
};

const drawLoop = (loop, index, width, height, time) => {
  const points = Array.from({ length: LOOP_SEGMENTS + 1 }, (_, segment) => {
    const theta = (segment / LOOP_SEGMENTS) * Math.PI * 2;
    return { theta, point: projectPoint(loop, theta, width, height, time) };
  });
  const colour = loopColour(loop, index);
  const baseWeight = Math.max(0.8, Math.min(width, height) * (.0021 + loop.weight * .0014));
  const changed = loop.delay > .02 || loop.opening > .02;

  if (changed) {
    ctx.save();
    ctx.globalAlpha = clamp(.10 + loop.delay * .12, .1, .25);
    ctx.strokeStyle = PALETTE.violet;
    ctx.lineWidth = baseWeight * 2.6;
    ctx.beginPath();
    points.forEach(({ theta, point }, segment) => {
      if (isInGap(loop, theta)) return;
      const ghost = projectPoint(loop, theta, width, height, time, loop.lag * .72);
      if (segment === 0 || isInGap(loop, points[Math.max(0, segment - 1)].theta)) ctx.moveTo(ghost.x + loop.lag * 18, ghost.y);
      else ctx.lineTo(ghost.x + loop.lag * 18, ghost.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = colour;
  ctx.shadowBlur = Math.min(width, height) * (changed ? .026 : .014);
  ctx.shadowColor = colour;
  ctx.lineWidth = baseWeight * (changed ? 1.18 : 1);
  ctx.globalAlpha = clamp(.48 + (pointDepth(loop, width, height, time) + .4) * .4, .38, .92);
  ctx.beginPath();
  let previousGap = true;
  points.forEach(({ theta, point }) => {
    const gap = isInGap(loop, theta);
    if (gap) {
      previousGap = true;
      return;
    }
    if (previousGap) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
    previousGap = false;
  });
  ctx.stroke();
  ctx.restore();

  if (changed) {
    const center = loopScreenCenter(loop, width, height, time);
    ctx.save();
    ctx.globalAlpha = .62;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(1.5, baseWeight * 1.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

const pointDepth = (loop, width, height, time) => loopScreenCenter(loop, width, height, time).depth;

const drawArchive = (width, height, time) => {
  const loops = state.frame.archive.loops;
  const ordered = loops.map((loop, index) => ({ loop, index, depth: pointDepth(loop, width, height, time) })).sort((a, b) => a.depth - b.depth);

  ctx.save();
  ctx.globalAlpha = .24;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = Math.max(0.6, Math.min(width, height) * .001);
  ctx.beginPath();
  ordered.forEach(({ loop }, index) => {
    const center = loopScreenCenter(loop, width, height, time);
    if (index === 0) ctx.moveTo(center.x, center.y);
    else ctx.lineTo(center.x, center.y);
  });
  ctx.stroke();
  ctx.restore();

  ordered.forEach(({ loop, index }) => drawLoop(loop, index, width, height, time));

  const selected = loops[state.selectedRing];
  if (selected && !document.documentElement.classList.contains('blind-mode')) {
    const center = loopScreenCenter(selected, width, height, time);
    ctx.save();
    ctx.globalAlpha = state.pointer ? .52 : .18;
    ctx.strokeStyle = PALETTE.amber;
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.min(width, height) * .095, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  const selected = String(state.selectedRing + 1).padStart(2, '0');
  stageElement.textContent = `interval ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'pause' : 'pauses'}`;
  armedElement.textContent = `ring ${selected}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'pause-too-short') statusElement.textContent = `pause refused · hold longer than ${MIN_PAUSE_MS}ms`;
  else if (state.frame.lastAction === 'pause-armed') statusElement.textContent = `ring ${selected} is listening · release to measure`;
  else if (state.frame.lastAction === 'pause-committed') statusElement.textContent = 'interval kept · downstream loops arrive late';
  else if (state.frame.lastAction === 'pause-lifted') statusElement.textContent = 'latest interval lifted · procession restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before pausing again';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · no delay retained';
  else statusElement.textContent = `${state.frame.archive.loops.filter((loop) => loop.delay > 0).length} delayed loops · pause on ring ${selected}`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(width, height, now);
  drawArchive(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr);
};

const renderState = (next) => {
  state.frame = next;
  render();
};
const selectedRingFromY = (clientY) => {
  const rect = canvas.getBoundingClientRect();
  return clamp(Math.floor(((clientY - rect.top) / Math.max(1, rect.height)) * LOOP_COUNT), 0, LOOP_COUNT - 1);
};
const arm = (ring, startedAt = performance.now()) => {
  state.selectedRing = clamp(ring, 0, LOOP_COUNT - 1);
  renderState(armPause(state.frame, state.selectedRing, startedAt));
};
const measure = () => renderState(commitPause(state.frame, { ...defaultPause(), ring: state.selectedRing }));
const lift = () => renderState(liftLatestPause(state.frame));
const release = () => renderState(releaseArchive());

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let glow = 0.018 + 0.014 * sin(pos.y * 0.006); return vec4f(0.02, 0.075 + glow, 0.09 + glow, 0.25); }` });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    state.gpu = {
      device,
      context,
      pipeline,
      render() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      }
    };
    state.renderer = 'WEBGPU / INTERVAL VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

const handleKey = (event) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    state.selectedRing = (state.selectedRing + LOOP_COUNT - 1) % LOOP_COUNT;
    render();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    state.selectedRing = (state.selectedRing + 1) % LOOP_COUNT;
    render();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    measure();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toUpperCase() === 'R') {
    event.preventDefault();
    release();
  }
};

canvas.addEventListener('pointermove', (event) => {
  state.selectedRing = selectedRingFromY(event.clientY);
  if (state.pointer) state.pointer.ring = state.selectedRing;
  render();
});
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  state.selectedRing = selectedRingFromY(event.clientY);
  state.pointer = { ring: state.selectedRing, startedAt: performance.now() };
  arm(state.selectedRing, state.pointer.startedAt);
});
canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  if (!state.pointer) return;
  const pointer = state.pointer;
  const duration = performance.now() - pointer.startedAt;
  state.pointer = null;
  renderState(commitPause(state.frame, { ring: pointer.ring, duration }));
});
canvas.addEventListener('pointercancel', () => { state.pointer = null; render(); });
document.addEventListener('keydown', (event) => {
  if (event.target.closest('a,button,input,textarea,select')) return;
  handleKey(event);
});
document.querySelector('[data-gesture="measure"]').addEventListener('click', measure);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__mutineWebGPUV024 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    selectedRing: state.selectedRing,
    armed: state.frame.armed ? { ...state.frame.armed } : null,
    residue: state.frame.archive.residue,
    route: state.frame.archive.route,
    delayedLoops: state.frame.archive.loops.filter((loop) => loop.delay > 0).length,
    openedLoops: state.frame.archive.loops.filter((loop) => loop.opening > 0).length,
    signature: geometrySignature(state.frame),
    action: state.frame.lastAction,
    renderer: state.renderer
  }),
  arm,
  measure,
  lift,
  release
};

resize();
setupGPU();
if (!staticMode && !reducedMotion) requestAnimationFrame(function tick(now) { render(now); requestAnimationFrame(tick); });
