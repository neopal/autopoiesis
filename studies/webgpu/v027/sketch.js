import {
  BASIN_COUNT,
  STAGES,
  armWitness,
  buildTimeline,
  commitWake,
  defaultWake,
  geometrySignature,
  liftLatestWake,
  releaseVolume
} from './engine.mjs';

const canvas = document.querySelector('#volume-field');
const gpuCanvas = document.querySelector('#gpu-wash');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  selectedBasin: 4,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  points: [],
  gpu: null,
  renderer: 'CANVAS / WATERSHED VOLUME',
  gesture: null
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const basinElement = document.querySelector('[data-basin]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#100f1b',
  deep: '#17172a',
  violet: '#7062aa',
  aqua: '#6fced0',
  ice: '#b8f0e2',
  coral: '#ef907c',
  amber: '#e2b878',
  ink: '#211e35',
  mist: 'rgba(168, 228, 220, .24)'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.3719) * 43758.5453;
  return raw - Math.floor(raw);
};
const lerp = (a, b, amount) => a + (b - a) * amount;
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

const project = (basin, width, height, time) => {
  const motion = reducedMotion || staticMode ? 0 : time * 0.00013;
  const depth = 0.82 + basin.z * 0.15;
  const pulse = Math.sin(motion + basin.phase) * 0.006;
  const scale = Math.min(width, height) * (0.088 + (basin.z + 0.5) * 0.012) * (basin.scale + pulse);
  return {
    x: width * 0.5 + (basin.x + basin.driftX + Math.sin(motion * 0.7 + basin.phase) * 0.01) * width * 0.31 * depth,
    y: height * 0.52 + (basin.y + basin.driftY + Math.cos(motion * 0.8 + basin.phase) * 0.008) * height * 0.32 * depth,
    scale,
    depth
  };
};

const drawGrain = (width, height) => {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = PALETTE.ice;
  for (let index = 0; index < 380; index += 1) {
    const x = pseudo(index * 1.31 + 22) * width;
    const y = pseudo(index * 2.77 + 17) * height;
    const size = pseudo(index * 4.07 + 5) * 1.2 + 0.15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawSurround = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.54, height * 0.46, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.78);
  gradient.addColorStop(0, '#332b55');
  gradient.addColorStop(0.28, '#201e3c');
  gradient.addColorStop(0.7, PALETTE.ground);
  gradient.addColorStop(1, '#090912');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGrain(width, height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = PALETTE.violet;
  ctx.lineWidth = Math.max(0.7, Math.min(width, height) * 0.0012);
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * 0.0002) * 0.025;
  ctx.beginPath();
  ctx.ellipse(width * (0.5 + drift), height * 0.52, width * 0.37, height * 0.36, -0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.52, width * 0.25, height * 0.38, 0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawVolumeShell = (width, height) => {
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = PALETTE.aqua;
  ctx.lineWidth = Math.max(0.6, Math.min(width, height) * 0.0009);
  const left = width * 0.16;
  const right = width * 0.84;
  const top = height * 0.16;
  const bottom = height * 0.84;
  for (let slice = 0; slice < 5; slice += 1) {
    const t = slice / 4;
    const x = lerp(left, right, t);
    ctx.beginPath();
    ctx.moveTo(x, top + height * 0.04);
    ctx.bezierCurveTo(x - width * 0.03, height * 0.35, x + width * 0.03, height * 0.66, x, bottom - height * 0.04);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.12;
  for (let slice = 0; slice < 4; slice += 1) {
    const y = lerp(top, bottom, slice / 3);
    ctx.beginPath();
    ctx.ellipse(width * 0.5, y, width * (0.28 - slice * 0.018), height * 0.08, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

const drawChannel = (channel, from, to, width, height, time) => {
  const mx = (from.x + to.x) * 0.5;
  const my = (from.y + to.y) * 0.5;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const bend = channel.bend * Math.min(width, height) * 0.11;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const baseWidth = Math.max(2, Math.min(width, height) * (0.006 + channel.opening * 0.004));
  const flow = reducedMotion || staticMode ? 0 : time * 0.00018;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.globalAlpha = clamp(0.1 + channel.current * 0.22 + channel.opening * 0.05, 0.1, 0.48);
  ctx.strokeStyle = channel.opening > 0.01 ? PALETTE.coral : PALETTE.aqua;
  ctx.lineWidth = baseWidth * (2.8 + channel.opening * 0.7);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(cx, cy, to.x, to.y);
  ctx.stroke();
  ctx.globalAlpha = 0.74;
  ctx.lineWidth = Math.max(0.7, baseWidth * 0.25);
  ctx.strokeStyle = PALETTE.ice;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(cx, cy, to.x, to.y);
  ctx.stroke();

  for (let particle = 0; particle < 5; particle += 1) {
    const phase = (flow + channel.id * 0.17 + particle * 0.19) % 1;
    const eased = (phase + 1) % 1;
    const px = lerp(from.x, to.x, eased) + (cx - mx) * Math.sin(eased * Math.PI);
    const py = lerp(from.y, to.y, eased) + (cy - my) * Math.sin(eased * Math.PI);
    ctx.globalAlpha = 0.35 + particle * 0.04;
    ctx.fillStyle = particle % 2 ? PALETTE.amber : PALETTE.ice;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, baseWidth * (0.36 + particle * 0.08)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const basinPath = (point, basin, radius, inset = 1) => {
  ctx.beginPath();
  for (let vertex = 0; vertex < 13; vertex += 1) {
    const angle = -Math.PI * 0.5 + vertex * Math.PI * 2 / 13;
    const wobble = 0.78 + pseudo(basin.id * 41 + vertex * 7 + inset * 13) * 0.34;
    const rx = radius * wobble * (1 + basin.relay * 0.035) * inset;
    const ry = radius * (0.62 + pseudo(basin.id * 17 + vertex * 3) * 0.24) * inset;
    const x = point.x + Math.cos(angle + basin.relay * 0.08) * rx;
    const y = point.y + Math.sin(angle + basin.relay * 0.08) * ry;
    if (vertex === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

const drawBasin = (basin, point, width, height) => {
  const radius = point.scale * (1 + basin.swell * 0.2 - basin.contraction * 0.09);
  const changed = basin.swell > 0.01 || basin.contraction > 0.01 || basin.relay > 0.01;
  ctx.save();
  ctx.translate(0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp(0.3 + basin.depth * 0.46 + basin.swell * 0.06, 0.24, 0.9);
  basinPath(point, basin, radius);
  const fill = ctx.createRadialGradient(point.x - radius * 0.2, point.y - radius * 0.3, radius * 0.08, point.x, point.y, radius * 1.3);
  fill.addColorStop(0, changed ? 'rgba(239,144,124,.92)' : 'rgba(184,240,226,.88)');
  fill.addColorStop(0.46, changed ? 'rgba(112,206,208,.58)' : 'rgba(112,98,170,.68)');
  fill.addColorStop(1, 'rgba(33,30,53,.12)');
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = changed ? PALETTE.coral : PALETTE.aqua;
  ctx.lineWidth = Math.max(0.7, Math.min(width, height) * 0.0016);
  basinPath(point, basin, radius);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = 'rgba(16,15,27,.64)';
  basinPath(point, basin, radius * (0.38 + basin.opening * 0.07), 0.84);
  ctx.fill();

  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = PALETTE.ice;
  ctx.lineWidth = Math.max(0.5, Math.min(width, height) * 0.0008);
  basinPath(point, basin, radius * 0.5, 0.88);
  ctx.stroke();

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = changed ? PALETTE.amber : PALETTE.ice;
  ctx.beginPath();
  ctx.arc(point.x - radius * 0.2, point.y - radius * 0.22, Math.max(1.3, radius * 0.08), 0, Math.PI * 2);
  ctx.fill();

  if (!blindMode && basin.id === state.selectedBasin) {
    ctx.globalAlpha = state.frame.armed ? 0.92 : 0.28;
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = PALETTE.coral;
    ctx.lineWidth = 1;
    basinPath(point, basin, radius * 1.28);
    ctx.stroke();
  }
  ctx.restore();
};

const updatePoints = () => {
  const { width, height } = state.view;
  state.points = state.frame.field.basins.map((basin) => project(basin, width, height, state.time));
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSurround(width, height, now);
  drawVolumeShell(width, height);
  updatePoints();
  const projected = state.points;
  [...state.frame.field.channels].sort((a, b) => (a.from + a.to) - (b.from + b.to)).forEach((channel) => drawChannel(channel, projected[channel.from], projected[channel.to], width, height, now));
  [...state.frame.field.basins].sort((a, b) => a.z - b.z).forEach((basin) => drawBasin(basin, projected[basin.id], width, height));
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr);
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `volume ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'wake' : 'wakes'}`;
  basinElement.textContent = `basin ${String(state.selectedBasin + 1).padStart(2, '0')}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'wake-committed') statusElement.textContent = 'wake elected · the missed basin carries the current';
  else if (state.frame.lastAction === 'witness-armed') statusElement.textContent = `trace held · leave after ${state.frame.armed?.trace.length ?? 1} basins`;
  else if (state.frame.lastAction === 'wake-refused-shallow') statusElement.textContent = 'wake refused · a collective trace needs distance';
  else if (state.frame.lastAction === 'wake-lifted') statusElement.textContent = 'latest wake lifted · volume restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'volume full · lift or release before another wake';
  else if (state.frame.lastAction === 'volume-released') statusElement.textContent = 'volume released · channels return to quiet';
  else statusElement.textContent = `${state.frame.field.basins.filter((basin) => basin.swell > 0.01).length} elected basins · move through the volume`;
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const basinAtPoint = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const local = { x: clientX - rect.left, y: clientY - rect.top };
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  state.points.forEach((point, index) => {
    const distance = (point.x - local.x) ** 2 + (point.y - local.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
};

const arm = (witness) => {
  state.selectedBasin = witness.basin;
  renderState(armWitness(state.frame, witness, performance.now()));
};

const leaveWake = (witness = defaultWake()) => {
  const armed = armWitness(state.frame, witness, performance.now());
  renderState(commitWake(armed));
};

const lift = () => renderState(liftLatestWake(state.frame));
const release = () => renderState(releaseVolume());

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let glow = 0.02 + 0.012 * sin(pos.x * 0.017 + pos.y * 0.011); return vec4f(0.12 + glow, 0.18 + glow, 0.26 + glow, 0.12); }` });
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
    state.renderer = 'WEBGPU / VOLUMETRIC WASH';
    render();
  } catch {
    state.gpu = null;
  }
};

const pointerDown = (event) => {
  const basin = basinAtPoint(event.clientX, event.clientY);
  state.gesture = { pointerId: event.pointerId, last: { x: event.clientX, y: event.clientY }, trace: [basin], travel: 0 };
  canvas.setPointerCapture?.(event.pointerId);
  arm({ basin, trace: [basin], travel: 0 });
};

const pointerMove = (event) => {
  if (!state.gesture || state.gesture.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - state.gesture.last.x, event.clientY - state.gesture.last.y);
  state.gesture.travel = clamp(state.gesture.travel + distance / Math.max(1, Math.min(state.view.width, state.view.height)) * 1.7, 0, 1);
  state.gesture.last = { x: event.clientX, y: event.clientY };
  const basin = basinAtPoint(event.clientX, event.clientY);
  if (state.gesture.trace.at(-1) !== basin) state.gesture.trace.push(basin);
  const start = state.gesture.trace[0];
  arm({ basin: start, trace: state.gesture.trace, travel: state.gesture.travel });
};

const pointerUp = (event) => {
  if (!state.gesture || state.gesture.pointerId !== event.pointerId) return;
  const gesture = state.gesture;
  state.gesture = null;
  renderState(commitWake(state.frame, { basin: gesture.trace[0], trace: gesture.trace, travel: gesture.travel }));
};

const handleKey = (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.selectedBasin = (state.selectedBasin + BASIN_COUNT - 3) % BASIN_COUNT;
    render();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.selectedBasin = (state.selectedBasin + 3) % BASIN_COUNT;
    render();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    state.selectedBasin = Math.floor(state.selectedBasin / 3) * 3 + (state.selectedBasin + 2) % 3;
    render();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    state.selectedBasin = Math.floor(state.selectedBasin / 3) * 3 + (state.selectedBasin + 1) % 3;
    render();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (state.frame.armed) renderState(commitWake(state.frame));
    else arm(defaultWake());
  } else if (event.key === ' ') {
    event.preventDefault();
    leaveWake(defaultWake());
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
};

canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('keydown', handleKey);
document.querySelector('[data-gesture="wake"]').addEventListener('click', () => leaveWake(defaultWake()));
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__mutineWebGPUV027 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    events: state.frame.memory,
    armed: state.frame.armed,
    lastAction: state.frame.lastAction,
    signature: state.frame.field.signature,
    basins: state.frame.field.basins,
    channels: state.frame.field.channels,
    selectedBasin: state.selectedBasin,
    renderer: state.renderer,
    gpuAvailable: Boolean(navigator.gpu),
    gpuReady: Boolean(state.gpu),
    gestureTrace: state.gesture?.trace ?? []
  }),
  getBasinPoints: () => state.points.map((point) => ({ x: point.x, y: point.y })),
  geometrySignature: () => geometrySignature(state.frame),
  leaveWake: () => leaveWake(defaultWake()),
  liftLatestWake: lift,
  releaseVolume: release
};

resize();
if (!staticMode) {
  const animate = (now) => {
    render(now);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
setupGPU();
