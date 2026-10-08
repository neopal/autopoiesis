import {
  SECTOR_COUNT,
  STAGES,
  armStrike,
  buildTimeline,
  commitStrike,
  defaultStrike,
  geometrySignature,
  liftLatestStrike,
  releaseCrown
} from './engine.mjs';

const canvas = document.querySelector('#crown-field');
const gpuCanvas = document.querySelector('#gpu-grain');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  selectedSector: 3,
  pointer: null,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  renderer: 'CANVAS / 3D PROJECTION'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const sectorElement = document.querySelector('[data-sector]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#07070a',
  deep: '#0d0c10',
  ink: '#f2eadf',
  copper: '#e58d69',
  rose: '#c86c72',
  teal: '#7fc5bf',
  cream: '#e8c99e',
  smoke: '#655f67'
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.4217) * 43758.5453;
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

const project = (point, width, height, time) => {
  const yaw = (staticMode || reducedMotion ? -0.24 : -0.24 + time * 0.000035);
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const rotatedX = point.x * cosine - point.y * sine;
  const depth = point.x * sine + point.y * cosine;
  const scale = Math.min(width, height) * 0.73;
  return {
    x: width * 0.5 + rotatedX * scale,
    y: height * 0.56 - point.z * scale * 0.73 + depth * scale * 0.24,
    depth
  };
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.54, height * 0.43, 0, width * 0.5, height * 0.52, Math.max(width, height) * 0.84);
  gradient.addColorStop(0, '#24202a');
  gradient.addColorStop(0.28, '#15141a');
  gradient.addColorStop(0.72, '#0c0c11');
  gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.5, height * 0.56);
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = PALETTE.teal;
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 5; ring += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.min(width, height) * (0.09 + ring * 0.065), Math.min(width, height) * (0.035 + ring * 0.028), -0.16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 220; index += 1) {
    const x = hash(index * 1.37 + 2) * width;
    const y = hash(index * 3.81 + 5) * height;
    const size = hash(index * 2.19 + 8) * 1.2 + 0.2;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.save();
  const pulse = 0.5 + Math.sin(time * 0.00023) * 0.5;
  const haze = ctx.createRadialGradient(width * (0.44 + pulse * 0.03), height * 0.52, 0, width * 0.5, height * 0.52, Math.min(width, height) * 0.45);
  haze.addColorStop(0, 'rgba(229,141,105,.12)');
  haze.addColorStop(1, 'rgba(229,141,105,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const drawCavity = (width, height) => {
  const x = width * 0.5;
  const y = height * 0.56;
  const outer = ctx.createRadialGradient(x, y, 0, x, y, Math.min(width, height) * 0.28);
  outer.addColorStop(0, 'rgba(3,3,5,.98)');
  outer.addColorStop(0.58, 'rgba(3,3,5,.74)');
  outer.addColorStop(1, 'rgba(3,3,5,0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.min(width, height) * 0.24, Math.min(width, height) * 0.13, -0.2, 0, Math.PI * 2);
  ctx.fill();
};

const sectorColour = (sector, index) => {
  if (sector.vacancy > 0.24) return `rgba(200,108,114,${0.45 + sector.vacancy * 0.35})`;
  if (Math.abs(sector.shear) > 0.08) return `rgba(229,141,105,${0.52 + sector.density * 0.3})`;
  return [
    `rgba(127,197,191,${0.42 + sector.density * 0.3})`,
    `rgba(232,201,158,${0.42 + sector.density * 0.3})`,
    `rgba(242,234,223,${0.32 + sector.density * 0.3})`,
    `rgba(229,141,105,${0.38 + sector.density * 0.3})`
  ][index % 4];
};

const pathFrom = (points) => {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
};

const drawSector = (sector, index, width, height, time) => {
  const points = sector.vertices.map((point) => project(point, width, height, time));
  const back = points.map((point) => ({ ...point, y: point.y + Math.max(1, Math.min(width, height) * sector.thickness * 0.13) }));
  const changed = sector.vacancy > 0.02 || Math.abs(sector.shear) > 0.02 || sector.lift > 0.02;
  const alpha = clamp(0.64 + (points.reduce((sum, point) => sum + point.depth, 0) / points.length + 0.5) * 0.28, 0.38, 0.96);

  ctx.save();
  ctx.shadowBlur = Math.min(width, height) * (changed ? 0.034 : 0.018);
  ctx.shadowColor = sector.vacancy > 0.18 ? PALETTE.rose : PALETTE.copper;
  ctx.globalAlpha = alpha;
  pathFrom([points[0], points[1], back[1], back[0]]);
  ctx.fillStyle = sector.vacancy > 0.12 ? 'rgba(88,36,47,.72)' : 'rgba(12,16,19,.8)';
  ctx.fill();
  pathFrom(points);
  ctx.fillStyle = sectorColour(sector, index);
  ctx.fill();
  ctx.strokeStyle = changed ? PALETTE.copper : PALETTE.ink;
  ctx.lineWidth = Math.max(0.8, Math.min(width, height) * (changed ? 0.0022 : 0.0011));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = clamp(0.2 + sector.density * 0.32, 0.18, 0.52);
  ctx.strokeStyle = sector.vacancy > 0.18 ? PALETTE.rose : PALETTE.cream;
  ctx.lineWidth = Math.max(0.6, Math.min(width, height) * 0.001);
  ctx.beginPath();
  const inner = lerp(points[0], points[3], 0.52);
  const outer = lerp(points[1], points[2], 0.5);
  ctx.moveTo(inner.x, inner.y);
  ctx.lineTo(outer.x, outer.y);
  ctx.stroke();
  if (sector.vacancy > 0.02) {
    ctx.globalAlpha = clamp(0.28 + sector.vacancy * 0.48, 0.28, 0.76);
    ctx.strokeStyle = PALETTE.ground;
    ctx.lineWidth = Math.max(1, Math.min(width, height) * (0.004 + sector.vacancy * 0.008));
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.stroke();
  }
  ctx.restore();

  if (!blindMode && index === state.selectedSector) {
    ctx.save();
    ctx.globalAlpha = state.pointer ? 0.72 : 0.24;
    ctx.strokeStyle = PALETTE.cream;
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 1;
    pathFrom(points.map((point) => ({ x: point.x * 1.035 + width * -0.0175, y: point.y * 1.035 + height * -0.0196 })));
    ctx.stroke();
    ctx.restore();
  }
};

const drawCrown = (width, height, time) => {
  drawCavity(width, height);
  const ordered = state.frame.chamber.sectors.map((sector, index) => ({ sector, index, depth: sector.vertices.reduce((sum, point) => sum + point.y, 0) / sector.vertices.length })).sort((a, b) => a.depth - b.depth);
  ordered.forEach(({ sector, index }) => drawSector(sector, index, width, height, time));

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = PALETTE.copper;
  ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0012);
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.56, Math.min(width, height) * 0.31, Math.min(width, height) * 0.17, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  const selected = String(state.selectedSector + 1).padStart(2, '0');
  stageElement.textContent = `crown ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'strike' : 'strikes'}`;
  sectorElement.textContent = `tooth ${selected}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'strike-committed') statusElement.textContent = 'pressure kept · a distant vacancy opens';
  else if (state.frame.lastAction === 'strike-armed') statusElement.textContent = `tooth ${selected} addressed · release to strike`;
  else if (state.frame.lastAction === 'strike-lifted') statusElement.textContent = 'latest pressure lifted · crown restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'crown full · lift or release before striking again';
  else if (state.frame.lastAction === 'crown-released') statusElement.textContent = 'crown released · cavity returns to quiet';
  else statusElement.textContent = `${state.frame.chamber.sectors.filter((sector) => sector.vacancy > 0.02).length} vacancies · strike tooth ${selected}`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(width, height, now);
  drawCrown(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr);
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const selectedSectorFromPoint = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - (rect.left + rect.width * 0.5);
  const y = clientY - (rect.top + rect.height * 0.56);
  const angle = Math.atan2(y, x) + Math.PI * 0.5;
  return ((Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SECTOR_COUNT) % SECTOR_COUNT) + SECTOR_COUNT) % SECTOR_COUNT;
};

const arm = (sector, startedAt = performance.now()) => {
  state.selectedSector = clamp(sector, 0, SECTOR_COUNT - 1);
  renderState(armStrike(state.frame, state.selectedSector, startedAt));
};
const strike = () => renderState(commitStrike(state.frame, { ...defaultStrike(), sector: state.selectedSector }));
const lift = () => renderState(liftLatestStrike(state.frame));
const release = () => renderState(releaseCrown());

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let grain = 0.012 + 0.009 * sin(pos.x * 0.018 + pos.y * 0.011); return vec4f(0.16 + grain, 0.07, 0.045, 0.16); }` });
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
    state.renderer = 'WEBGPU / PRESSURE GRAIN';
    render();
  } catch {
    state.gpu = null;
  }
};

const handleKey = (event) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    state.selectedSector = (state.selectedSector + SECTOR_COUNT - 1) % SECTOR_COUNT;
    render();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    state.selectedSector = (state.selectedSector + 1) % SECTOR_COUNT;
    render();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    strike();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toUpperCase() === 'R') {
    event.preventDefault();
    release();
  }
};

canvas.addEventListener('pointermove', (event) => {
  state.selectedSector = selectedSectorFromPoint(event.clientX, event.clientY);
  if (state.pointer) state.pointer.sector = state.selectedSector;
  render();
});
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  const sector = selectedSectorFromPoint(event.clientX, event.clientY);
  state.pointer = { sector, startedAt: performance.now() };
  arm(sector, state.pointer.startedAt);
});
canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  if (!state.pointer) return;
  const pointer = state.pointer;
  state.pointer = null;
  renderState(commitStrike(state.frame, { ...defaultStrike(), sector: pointer.sector }));
});
canvas.addEventListener('pointercancel', () => { state.pointer = null; render(); });
document.addEventListener('keydown', (event) => {
  if (event.target.closest('a,button,input,textarea,select')) return;
  handleKey(event);
});
document.querySelector('[data-gesture="strike"]').addEventListener('click', strike);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__mutineWebGPUV025 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    selectedSector: state.selectedSector,
    armed: state.frame.armed ? { ...state.frame.armed } : null,
    residue: state.frame.chamber.residue,
    route: state.frame.chamber.route,
    vacancies: state.frame.chamber.sectors.filter((sector) => sector.vacancy > 0.02).length,
    sheared: state.frame.chamber.sectors.filter((sector) => Math.abs(sector.shear) > 0.02).length,
    signature: geometrySignature(state.frame),
    action: state.frame.lastAction,
    renderer: state.renderer
  }),
  arm,
  strike,
  lift,
  release
};

resize();
setupGPU();
if (!staticMode && !reducedMotion) requestAnimationFrame(function tick(now) { render(now); requestAnimationFrame(tick); });
