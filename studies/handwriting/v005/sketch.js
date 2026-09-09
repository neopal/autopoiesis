import {
  applyRefusal,
  buildFrame,
  buildTimeline,
  removeLatestRefusal
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1';
const FINAL_STAGE = 8;
const STAGE_MS = 7200;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#0b0d13',
  pageMid: '#171522',
  pageGlow: '#2a2027',
  ink: '#f1e5cf',
  ghost: '#928897',
  cold: '#8eb5c9',
  accent: '#ef8f67',
  signal: '#d8c86c',
  line: 'rgba(241, 229, 207, .12)',
  grid: 'rgba(142, 181, 201, .09)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.52, y: 0.42 };
let selectedMemoryId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-memory');
const restoreButton = document.querySelector('#restore-memory');
const placeButton = document.querySelector('#place-refusal');
if (interactive) document.body.classList.add('interactive');

function pointToCanvas(point) {
  return { x: point.x * width, y: point.y * height };
}

function drawSmoothPath(points, start = 0, end = points.length - 1) {
  if (!points?.length || end < start) return;
  const safeStart = Math.max(0, Math.min(start, points.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(end, points.length - 1));
  const first = pointToCanvas(points[safeStart]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = safeStart + 1; index <= safeEnd; index += 1) {
    const previous = pointToCanvas(points[index - 1]);
    const point = pointToCanvas(points[index]);
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
    if (index === safeEnd) ctx.quadraticCurveTo(point.x, point.y, point.x, point.y);
  }
  ctx.stroke();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors.pageMid);
  gradient.addColorStop(0.48, colors.page);
  gradient.addColorStop(1, '#07090d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.52, height * 0.44, 0, width * 0.52, height * 0.44, width * 0.7);
  glow.addColorStop(0, 'rgba(239, 143, 103, .11)');
  glow.addColorStop(0.46, 'rgba(142, 181, 201, .035)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 7; index += 1) {
    const y = height * (0.16 + index * 0.105);
    ctx.beginPath();
    ctx.moveTo(width * 0.035, y);
    ctx.lineTo(width * 0.965, y);
    ctx.stroke();
  }
  for (let index = 0; index < 15; index += 1) {
    const x = width * (0.055 + index * 0.052);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.1);
    ctx.lineTo(x, height * 0.84);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 330; index += 1) {
    const x = ((index * 73.17) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = 0.012 + ((index * 17) % 23) / 1200;
    ctx.fillStyle = `rgba(216, 200, 108, ${alpha})`;
    ctx.fillRect(x, y, 0.8, 0.8);
  }
  ctx.restore();
}

function drawLabel(text, x, y, color = colors.ghost, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${Math.max(9, Math.min(12, width / 126))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHistoricRoutes(stage) {
  const from = Math.max(0, stage - 4);
  timeline.slice(from, stage).forEach((entry, offset) => {
    const alpha = 0.025 + offset * 0.018;
    entry.routes.forEach((route) => {
      ctx.strokeStyle = `rgba(146, 136, 151, ${alpha})`;
      ctx.lineWidth = 0.6;
      drawSmoothPath(route.points);
    });
  });
}

function drawBorrowedRoute(route, active) {
  const start = route.borrowStart >= 0 ? route.borrowStart : route.points.length;
  if (start >= route.points.length - 1) return;
  const end = route.points.length - 1;
  const color = route.borrowSource === latestVisitorId ? colors.accent : colors.signal;

  ctx.save();
  ctx.strokeStyle = active ? `${color}88` : `${color}3f`;
  ctx.lineWidth = active ? 4.6 : 2.2;
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'screen';
  drawSmoothPath(route.points, start, end);
  ctx.strokeStyle = active ? color : `${color}b8`;
  ctx.lineWidth = active ? 0.95 + route.borrowStrength * 0.7 : 0.6;
  drawSmoothPath(route.points, start, end);
  ctx.restore();
}

function drawRoute(route, index) {
  const active = Boolean(route.borrowed);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = active ? 'rgba(241, 229, 207, .78)' : `rgba(241, 229, 207, ${0.34 + (index % 3) * 0.08})`;
  ctx.lineWidth = active ? 1.05 + route.weight * 0.42 : 0.7 + route.weight * 0.24;
  drawSmoothPath(route.points);
  ctx.restore();
  if (active) drawBorrowedRoute(route, true);
}

function drawSharedBaseline(routes) {
  const grouped = new Map();
  routes.filter((route) => route.borrowed).forEach((route) => {
    const key = route.borrowSource;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(route);
  });

  grouped.forEach((members, sourceId) => {
    if (members.length < 2) return;
    const start = Math.min(...members.map((route) => route.borrowStart));
    const y = members.reduce((sum, route) => sum + route.points[start].y, 0) / members.length;
    const x = members.reduce((sum, route) => sum + route.points[start].x, 0) / members.length;
    ctx.save();
    ctx.strokeStyle = sourceId === latestVisitorId ? 'rgba(239, 143, 103, .46)' : 'rgba(216, 200, 108, .26)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(x * width, y * height);
    ctx.lineTo(width * 0.94, y * height);
    ctx.stroke();
    ctx.restore();
  });
}

function drawMemory(memory, stage) {
  memory.filter((refusal) => refusal.stage <= stage).slice(-24).forEach((refusal, index, visible) => {
    const point = pointToCanvas(refusal);
    const active = refusal.id === selectedMemoryId;
    const visitor = refusal.id === latestVisitorId;
    ctx.save();
    ctx.strokeStyle = visitor ? colors.accent : `rgba(142, 181, 201, ${0.16 + index / Math.max(1, visible.length) * 0.32})`;
    ctx.lineWidth = active ? 1.7 : 0.7;
    ctx.setLineDash(visitor ? [] : [2, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 10 : visitor ? 5 : 3.2 + index % 2, 0, Math.PI * 2);
    ctx.stroke();
    if (visitor) {
      ctx.beginPath();
      ctx.moveTo(point.x - 8, point.y);
      ctx.lineTo(point.x + 8, point.y);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (liftButton) liftButton.disabled = !frameState.memory.length;
  if (restoreButton) restoreButton.disabled = !latestVisitorId;
}

function draw(now) {
  const stage = frameState.stage;
  drawBackground();
  drawHistoricRoutes(stage);
  drawSharedBaseline(frameState.routes);
  frameState.routes.forEach(drawRoute);
  drawMemory(frameState.memory, stage);

  drawLabel(`BORROWED BASELINE / ${String(stage).padStart(2, '0')}`, width * 0.045, height * 0.075, colors.ink);
  const compact = width < 600;
  const label = latestVisitorId ? 'VISITOR REFUSAL / ROUTES BORROW' : 'MEMORY ACTIVE / ROUTES LISTEN';
  drawLabel(label, compact ? width * 0.045 : width * 0.955, compact ? height * 0.11 : height * 0.075, latestVisitorId ? colors.accent : colors.signal, compact ? 'left' : 'right');
  const borrowed = frameState.routes.filter((route) => route.borrowed).length;
  drawLabel(`${borrowed} ROUTES BORROWING · ${frameState.memory.length} REFUSALS`, width * 0.045, height * 0.91, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO PLACE · TAB TO ACTIONS · SPACE TO PLACE', width * 0.955, height * 0.91, colors.ghost, 'right');

  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) frameState = timeline[nextStage];
    animationFrame = window.requestAnimationFrame(draw);
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  draw(performance.now());
}

function placeAt(position) {
  if (!interactive || staticPreview) return;
  frameState = applyRefusal(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedMemoryId = latestVisitorId;
  paused = true;
  updateState('The route borrowed a neighbour; later lines are carrying the refusal.');
  updateButtons();
  draw(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length) return;
  const latest = frameState.memory.at(-1);
  selectedMemoryId = latest.id;
  frameState = removeLatestRefusal(frameState);
  latestVisitorId = null;
  paused = true;
  updateState('Latest refusal lifted; the earlier baseline is restored.');
  updateButtons();
  draw(performance.now());
}

function restore() {
  frameState = timeline[FINAL_STAGE];
  latestVisitorId = null;
  selectedMemoryId = null;
  paused = true;
  updateState('The sentence is carrying its remembered baseline.');
  updateButtons();
  draw(performance.now());
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v005-borrowed-baseline.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerup', (event) => {
  if (!interactive || staticPreview) return;
  const rect = canvas.getBoundingClientRect();
  lastPointer = {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height
  };
  placeAt(lastPointer);
});

canvas.addEventListener('keydown', (event) => {
  if (!interactive || staticPreview) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    placeAt(lastPointer);
  }
  if (event.key.toLowerCase() === 'r') restore();
  if (event.key.toLowerCase() === 's') saveStill();
  if (event.key.toLowerCase() === 'p') {
    paused = !paused;
    if (!paused) {
      startedAt = performance.now() - frameState.stage * STAGE_MS;
      animationFrame = window.requestAnimationFrame(draw);
    }
    updateState(paused ? 'Timeline paused; the borrowed baseline is held.' : 'Timeline moving; routes are still learning from refusal.');
  }
});

placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
restoreButton?.addEventListener('click', restore);
new ResizeObserver(resize).observe(canvas);
updateButtons();
resize();
if (!paused) animationFrame = window.requestAnimationFrame(draw);

window.__mutineHandwritingV005 = {
  getState: () => ({
    stage: frameState.stage,
    paused,
    memoryCount: frameState.memory.length,
    latestVisitorId,
    borrowedRoutes: frameState.routes.filter((route) => route.borrowed).length,
    routeSignature: frameState.routes.map((route) => route.points.at(-1))
  }),
  stop: () => {
    paused = true;
    window.cancelAnimationFrame(animationFrame);
  }
};
