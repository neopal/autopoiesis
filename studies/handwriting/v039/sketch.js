import {
  appendRoute,
  beginRoute,
  buildFrame,
  commitRoute,
  geometrySignature,
  liftLatest,
  release,
  stateSignature
} from './engine.mjs';

const field = document.querySelector('#route-field');
const canvas = document.querySelector('#route-canvas');
const context = canvas.getContext('2d');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const routeReadout = document.querySelector('[data-route]');
const interactionState = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const deterministicRoute = [0, 3, 7, 10];
const staticRoutes = [
  [0, 3, 7, 10],
  [1, 4, 8, 11],
  [2, 5, 9, 0],
  [3, 6, 10, 1]
];
const palette = {
  ground: '#111614',
  paper: '#d9d0b9',
  muted: '#7f887d',
  coral: '#e8806d',
  ochre: '#d4ab68',
  blue: '#8eafb0',
  moss: '#9eb28e'
};

let frame = buildFrame();
let pointerActive = false;
let animationFrame = 0;
let width = 1;
let height = 1;
let deviceScale = 1;
let time = 0;

if (staticMode) {
  for (const route of staticRoutes) frame = commitRoute(frame, route);
}

const messages = {
  quiet: 'The route is quiet. No junctions have been traced.',
  'route armed': 'A first junction is held as a route beginning. Nothing has moved.',
  'route tracing': 'The route is pending. The traced junctions remain geometrically exact.',
  'route complete': 'Four junctions are traced. Commit to let the topology answer elsewhere.',
  'route rewired remotely': 'The route stayed exact. Three unselected junctions rewired the surrounding paths.',
  'lifted latest': 'The latest remote rewire was lifted. The preceding topology is exact again.',
  'refused route': 'Refused. A route needs four distinct junctions.',
  'refused junction': 'Refused. That position is not a junction in this topology.',
  release: 'Released. The route is back at its quiet seed.'
};

const colorFor = (mode, alpha = 1) => {
  const base = mode === 'turn' ? palette.coral : mode === 'splice' ? palette.blue : mode === 'stutter' ? palette.ochre : palette.paper;
  return `${base}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
};

const resize = () => {
  const rect = field.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  deviceScale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  render();
};

const pointFor = (junction) => ({ x: junction.x * width, y: junction.y * height });
const nearestJunction = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = null;
  let bestDistance = Infinity;
  for (const junction of frame.field.junctions) {
    const point = pointFor(junction);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < bestDistance) {
      best = junction.id;
      bestDistance = distance;
    }
  }
  return bestDistance <= Math.max(34, Math.min(width, height) * 0.105) ? best : null;
};

const curveFor = (edge, junctions) => {
  const a = pointFor(junctions[edge.a]);
  const b = pointFor(junctions[edge.b]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const bend = edge.bend * Math.min(width, height) * 0.42;
  return {
    a,
    b,
    control: {
      x: (a.x + b.x) / 2 + normalX * bend,
      y: (a.y + b.y) / 2 + normalY * bend
    }
  };
};

const drawCurve = (edge, junctions, options = {}) => {
  const curve = curveFor(edge, junctions);
  const alpha = options.alpha ?? 1;
  context.beginPath();
  context.moveTo(curve.a.x, curve.a.y);
  context.quadraticCurveTo(curve.control.x, curve.control.y, curve.b.x, curve.b.y);
  context.strokeStyle = options.color ?? colorFor(edge.mode, alpha);
  context.lineWidth = options.width ?? Math.max(0.65, edge.weight * Math.min(width, height) * 0.0044);
  context.lineCap = 'round';
  context.setLineDash(options.dash ?? []);
  context.stroke();
  context.setLineDash([]);
};

const drawBackground = () => {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#242a22');
  gradient.addColorStop(0.42, palette.ground);
  gradient.addColorStop(1, '#0b0e0d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(width * 0.22, height * 0.18, 0, width * 0.22, height * 0.18, Math.max(width, height) * 0.68);
  glow.addColorStop(0, 'rgba(212,171,104,.14)');
  glow.addColorStop(0.48, 'rgba(142,175,176,.035)');
  glow.addColorStop(1, 'rgba(17,22,20,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.13;
  context.strokeStyle = palette.paper;
  context.lineWidth = 0.5;
  for (let index = 0; index < 32; index += 1) {
    const y = height * (0.08 + index * 0.029);
    context.beginPath();
    context.moveTo(width * 0.04, y + Math.sin(index * 1.7) * 4);
    context.bezierCurveTo(width * 0.32, y - 18, width * 0.67, y + 21, width * 0.96, y + Math.cos(index) * 5);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.18;
  for (let index = 0; index < 180; index += 1) {
    const x = ((index * 83) % 997) / 997 * width;
    const y = ((index * 47 + 19) % 991) / 991 * height;
    const size = 0.35 + ((index * 13) % 7) * 0.13;
    context.fillStyle = index % 5 === 0 ? palette.ochre : palette.paper;
    context.fillRect(x, y, size, size);
  }
  context.restore();
};

const drawEdges = () => {
  const junctions = frame.field.junctions;
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const edge of frame.field.edges) {
    const pulse = reducedMotion || staticMode ? 0 : Math.sin(time * 0.0012 + edge.phase * 6.28) * 0.08;
    drawCurve(edge, junctions, { alpha: 0.13 + pulse, width: Math.max(6, edge.weight * Math.min(width, height) * 0.020), color: colorFor(edge.mode, 0.11 + pulse) });
  }
  for (const edge of frame.field.edges) {
    const pulse = reducedMotion || staticMode ? 0 : Math.sin(time * 0.001 + edge.phase * 5) * 0.12;
    drawCurve(edge, junctions, { alpha: 0.42 + pulse, width: Math.max(0.7, edge.weight * Math.min(width, height) * 0.004), color: colorFor(edge.mode, 0.43 + pulse) });
    if (edge.mode !== 'quiet') {
      drawCurve(edge, junctions, { alpha: 0.6, width: 0.8, dash: [2, 7], color: colorFor(edge.mode, 0.62) });
    }
  }
  context.restore();
};

const drawJunctions = () => {
  const pending = frame.pending;
  for (const junction of frame.field.junctions) {
    const point = pointFor(junction);
    const selected = pending.includes(junction.id);
    const radius = Math.min(width, height) * (0.010 + junction.spread * 0.008);
    const pulse = reducedMotion || staticMode ? 0 : Math.sin(time * 0.0015 + junction.phase * 6.28) * 0.08;
    context.save();
    context.translate(point.x, point.y);
    context.rotate((junction.angle * Math.PI) / 180);
    context.strokeStyle = selected ? palette.coral : colorFor(junction.mode, 0.74 + pulse);
    context.lineWidth = selected ? 2.2 : Math.max(0.8, junction.weight * 1.3);
    context.beginPath();
    context.arc(0, 0, radius * 1.9, -Math.PI * 0.82, Math.PI * 0.65);
    context.stroke();
    context.beginPath();
    context.moveTo(-radius * 2.8, radius * 0.36);
    context.lineTo(radius * 2.9, -radius * 0.36);
    context.stroke();
    if (selected) {
      context.globalAlpha = 0.22;
      context.fillStyle = palette.coral;
      context.beginPath();
      context.arc(0, 0, radius * 4.8, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
};

const drawPending = () => {
  if (!frame.pending.length) return;
  const junctions = frame.field.junctions;
  context.save();
  context.strokeStyle = palette.coral;
  context.globalAlpha = 0.92;
  context.lineWidth = Math.max(1.2, Math.min(width, height) * 0.004);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.setLineDash([5, 8]);
  context.beginPath();
  frame.pending.forEach((id, index) => {
    const point = pointFor(junctions[id]);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
  context.restore();
};

const render = () => {
  context.clearRect(0, 0, width, height);
  drawBackground();
  drawEdges();
  drawPending();
  drawJunctions();
};

const renderUi = () => {
  const pending = frame.pending.map((id) => String(id).padStart(2, '0'));
  routeReadout.textContent = pending.length ? pending.join(' · ') : '· · · ·';
  stage.textContent = `${frame.lastEvent} / ${pending.length ? `${pending.length} junction${pending.length === 1 ? '' : 's'} pending` : 'no route traced'}`;
  memoryReadout.textContent = `${frame.memory.length} remote rewir${frame.memory.length === 1 ? 'ing' : 'ings'} · 12 junctions`;
  interactionState.textContent = messages[frame.lastEvent] ?? `The topology reports: ${frame.lastEvent}.`;
};

const announce = (next) => {
  frame = next;
  renderUi();
  render();
};

const pointerRoute = (event) => {
  const id = nearestJunction(event.clientX, event.clientY);
  if (id === null) return;
  const next = frame.pending.length ? appendRoute(frame, id) : beginRoute(frame, id);
  if (next !== frame) announce(next);
};

field.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  pointerActive = true;
  field.setPointerCapture?.(event.pointerId);
  field.focus();
  pointerRoute(event);
});
field.addEventListener('pointermove', (event) => {
  if (pointerActive && frame.pending.length < deterministicRoute.length) pointerRoute(event);
});
field.addEventListener('pointerup', (event) => {
  pointerActive = false;
  field.releasePointerCapture?.(event.pointerId);
  if (frame.pending.length === deterministicRoute.length) announce(commitRoute(frame));
});
field.addEventListener('pointercancel', () => { pointerActive = false; });

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    const index = frame.pending.length;
    if (index < deterministicRoute.length) {
      announce(index === 0 ? beginRoute(frame, deterministicRoute[index]) : appendRoute(frame, deterministicRoute[index]));
    }
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    announce(commitRoute(frame));
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    announce(liftLatest(frame));
    return;
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    frame = { ...release(), lastEvent: 'release' };
    renderUi();
    render();
  }
});

document.querySelector('[data-action="rewire"]').addEventListener('click', () => {
  field.focus();
  announce(commitRoute(frame, deterministicRoute));
});
document.querySelector('[data-action="lift"]').addEventListener('click', () => {
  field.focus();
  announce(liftLatest(frame));
});
document.querySelector('[data-action="release"]').addEventListener('click', () => {
  field.focus();
  frame = { ...release(), lastEvent: 'release' };
  renderUi();
  render();
});

window.__mutineHandwritingV039 = {
  getFrame: () => frame,
  getState: () => ({
    memory: frame.memory.length,
    pending: [...frame.pending],
    lastEvent: frame.lastEvent,
    changedJunctionIds: [...frame.changedJunctionIds],
    changedEdgeIds: [...frame.changedEdgeIds],
    reducedMotion
  }),
  getSignature: () => geometrySignature(frame),
  getStateSignature: () => stateSignature(frame),
  getJunctions: () => frame.field.junctions.map((junction) => ({ ...junction }))
};

new ResizeObserver(resize).observe(field);
resize();
renderUi();
window.__mutineReady = true;

const animate = (timestamp) => {
  time = timestamp;
  render();
  animationFrame = window.requestAnimationFrame(animate);
};
if (!reducedMotion && !staticMode) animationFrame = window.requestAnimationFrame(animate);
void animationFrame;
