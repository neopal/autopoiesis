import {
  STAGES,
  applyAttention,
  buildTimeline,
  deleteAttention,
  geometrySignature,
  releaseAttention
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const PALETTE = ['#b8d8d2', '#e1b96f', '#7191a6', '#9d6570', '#ebe1c4'];
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  armedPoint: { x: 0.5, y: 0.5 },
  pointerInside: false,
  view: { width: 1, height: 1, dpr: 1 }
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
  canvas.width = Math.floor(state.view.width * dpr);
  canvas.height = Math.floor(state.view.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
};

const localPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0.08, Math.min(0.92, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.08, Math.min(0.92, (event.clientY - rect.top) / rect.height))
  };
};

const project = (body) => {
  const { width, height } = state.view;
  const marginX = Math.min(74, width * 0.1);
  const marginY = Math.min(74, height * 0.11);
  return {
    x: marginX + body.x * (width - marginX * 2) + (body.depth - 0.5) * Math.min(82, width * 0.12),
    y: marginY + body.y * (height - marginY * 2) - body.depth * Math.min(66, height * 0.11),
    size: Math.max(9, Math.min(44, Math.min(width / 18, height / 14) * body.size * (0.82 + body.depth * 0.2)))
  };
};

const polygon = (points, fill, stroke, alpha = 1) => {
  context.save();
  context.globalAlpha = alpha;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 0.7;
    context.stroke();
  }
  context.restore();
};

const drawBody = (body) => {
  if (body.hidden > 0.74) return;
  const point = project(body);
  const width = point.size * body.width;
  const height = point.size * body.height;
  const skew = Math.sin(body.yaw) * point.size * 0.36;
  const lift = Math.cos(body.yaw) * point.size * 0.18;
  const depthShift = (1 - body.depth) * point.size * 0.7;
  const x = point.x;
  const y = point.y;
  const alpha = Math.max(0.12, 1 - body.hidden * 0.72);
  const face = PALETTE[body.tint];
  const edge = body.age > 0 ? '#f0d39b' : 'rgba(231,241,235,.36)';

  polygon([
    [x - width * 0.52 + depthShift, y - height * 0.42 - lift],
    [x + width * 0.46 + depthShift, y - height * 0.5 + lift],
    [x + width * 0.52, y + height * 0.36],
    [x - width * 0.44, y + height * 0.48]
  ], 'rgba(8, 14, 23, .86)', null, alpha);
  polygon([
    [x + width * 0.46 + depthShift, y - height * 0.5 + lift],
    [x + width * 0.58 + skew, y - height * 0.24],
    [x + width * 0.62, y + height * 0.27],
    [x + width * 0.52, y + height * 0.36]
  ], '#385064', edge, alpha * 0.9);
  polygon([
    [x - width * 0.52 + depthShift, y - height * 0.42 - lift],
    [x + width * 0.46 + depthShift, y - height * 0.5 + lift],
    [x + width * 0.52, y + height * 0.36],
    [x - width * 0.44, y + height * 0.48]
  ], face, edge, alpha);
  context.save();
  context.globalAlpha = alpha * 0.22;
  context.strokeStyle = '#fff6d9';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x - width * 0.2, y - height * 0.31);
  context.lineTo(x + width * 0.25, y + height * 0.22);
  context.stroke();
  context.restore();
};

const drawCavity = (cavity, index) => {
  const pseudoBody = { x: cavity.x, y: cavity.y, depth: cavity.depth, size: 1 };
  const point = project(pseudoBody);
  const radius = Math.max(18, point.size * (1.9 + index * 0.18));
  context.save();
  context.translate(point.x, point.y);
  context.rotate(-0.22 + index * 0.28);
  context.scale(1.2, 0.72);
  const gradient = context.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(2, 5, 10, .98)');
  gradient.addColorStop(0.58, 'rgba(11, 23, 38, .9)');
  gradient.addColorStop(1, 'rgba(95, 159, 175, .04)');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(0, 0, radius, radius * 0.7, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(227, 184, 114, .62)';
  context.lineWidth = 1;
  context.setLineDash([radius * 0.14, radius * 0.18]);
  context.beginPath();
  context.ellipse(0, 0, radius * 0.82, radius * 0.54, 0, 0.2, Math.PI * 1.76);
  context.stroke();
  context.restore();
};

const drawBackdrop = () => {
  const { width, height } = state.view;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0b1523');
  gradient.addColorStop(0.52, '#111a27');
  gradient.addColorStop(1, '#070c14');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = '#7db5c9';
  context.lineWidth = 1;
  for (let index = 0; index < 9; index += 1) {
    const y = height * (0.16 + index * 0.1);
    context.beginPath();
    context.moveTo(width * 0.04, y);
    context.lineTo(width * 0.96, y - height * 0.06);
    context.stroke();
  }
  context.restore();
};

const drawWitness = () => {
  if (blindMode || !state.pointerInside) return;
  const point = project({ x: state.armedPoint.x, y: state.armedPoint.y, depth: 0.04, size: 1 });
  context.save();
  context.strokeStyle = 'rgba(227, 184, 114, .74)';
  context.lineWidth = 1;
  context.setLineDash([3, 5]);
  context.beginPath();
  context.arc(point.x, point.y, 13, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(point.x - 18, point.y);
  context.lineTo(point.x + 18, point.y);
  context.moveTo(point.x, point.y - 18);
  context.lineTo(point.x, point.y + 18);
  context.stroke();
  context.restore();
};

const render = () => {
  drawBackdrop();
  const bodies = [...state.frame.bodies].sort((a, b) => a.depth - b.depth);
  for (const body of bodies) drawBody(body);
  state.frame.archive.cavities.forEach(drawCavity);
  drawWitness();
  updateReadout();
};

const updateReadout = () => {
  stageElement.textContent = `stage ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'cavity' : 'cavities'}`;
  rendererElement.textContent = navigator.gpu ? 'WEBGPU / CAVITY CHECK' : 'CANVAS / CAVITY CHECK';
};

const witness = (point = state.armedPoint) => {
  state.frame = applyAttention(state.frame, point);
  render();
};
const lift = () => {
  state.frame = deleteAttention(state.frame);
  render();
};
const release = () => {
  state.frame = releaseAttention();
  render();
};

canvas.addEventListener('pointermove', (event) => {
  state.armedPoint = localPoint(event);
  state.pointerInside = true;
  render();
});
canvas.addEventListener('pointerenter', () => { state.pointerInside = true; render(); });
canvas.addEventListener('pointerleave', () => { state.pointerInside = false; render(); });
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  state.armedPoint = localPoint(event);
  canvas.setPointerCapture?.(event.pointerId);
  witness();
});
canvas.addEventListener('pointerup', (event) => { canvas.releasePointerCapture?.(event.pointerId); });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    witness();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
});

document.querySelector('[data-gesture="witness"]').addEventListener('click', () => witness());
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__MUTINE_STATE__ = {
  get frame() { return state.frame; },
  get signature() { return geometrySignature(state.frame); },
  witness,
  lift,
  release
};

resize();
