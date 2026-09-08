import { buildStage } from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1';
const FINAL_STAGE = 8;
const STAGE_MS = 7600;
const colors = {
  bgTop: '#12262c',
  bgBottom: '#050b10',
  grid: 'rgba(137, 182, 186, .095)',
  ghost: 'rgba(137, 182, 186, .18)',
  ink: '#e7eadf',
  reentry: '#c7d58c',
  muted: '#7c9293',
  refusal: '#f28567',
  refusalDim: 'rgba(242, 133, 103, .24)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let selectedRefusalId = null;
let liftedRefusalId = null;
let paused = false;
let frameState = null;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-memory');
const restoreButton = document.querySelector('#restore-memory');
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
  gradient.addColorStop(0, colors.bgTop);
  gradient.addColorStop(.48, '#0a1920');
  gradient.addColorStop(1, colors.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const bloom = ctx.createRadialGradient(width * .64, height * .48, 0, width * .64, height * .48, width * .7);
  bloom.addColorStop(0, 'rgba(74, 117, 112, .14)');
  bloom.addColorStop(.55, 'rgba(35, 68, 73, .035)');
  bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = .5;
  ctx.strokeStyle = colors.grid;
  for (let x = width * .052; x < width * .97; x += width * .064) {
    ctx.beginPath();
    ctx.moveTo(x, height * .12);
    ctx.lineTo(x, height * .88);
    ctx.stroke();
  }
  for (let y = height * .16; y < height * .88; y += height * .105) {
    ctx.beginPath();
    ctx.moveTo(width * .035, y);
    ctx.lineTo(width * .965, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 260; index += 1) {
    const x = ((index * 73.17) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = .018 + ((index * 17) % 23) / 1000;
    ctx.fillStyle = `rgba(199, 213, 140, ${alpha})`;
    ctx.fillRect(x, y, .7, .7);
  }
  ctx.restore();
}

function drawLabel(text, x, y, color = colors.muted, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${Math.max(9, Math.min(12, width / 125))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHistoricRoutes(history, stage) {
  const from = Math.max(0, stage - 4);
  history.slice(from, stage).forEach((entry, offset) => {
    const alpha = .035 + offset * .018;
    entry.routes.forEach((route) => {
      ctx.strokeStyle = `rgba(137, 182, 186, ${alpha})`;
      ctx.lineWidth = .55;
      drawSmoothPath(route.points);
    });
  });
}

function drawRoute(route, progress, isCurrent) {
  const end = Math.max(1, Math.min(route.points.length - 1, Math.floor((route.points.length - 1) * progress)));
  const hasGap = route.gapStart >= 0 && route.gapStart < end;
  const firstEnd = hasGap ? Math.min(route.gapStart, end) : end;
  const secondStart = hasGap ? Math.min(route.gapEnd, end) : end + 1;
  const alpha = isCurrent ? .82 : .18;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(231, 234, 223, ${alpha * .2})`;
  ctx.lineWidth = isCurrent ? 4.5 + route.pause * 4 : 2;
  drawSmoothPath(route.points, 0, firstEnd);
  if (hasGap && secondStart <= end) drawSmoothPath(route.points, secondStart, end);
  ctx.strokeStyle = `rgba(231, 234, 223, ${alpha})`;
  ctx.lineWidth = isCurrent ? .72 + route.weight * .72 + route.pause * .9 : .52;
  drawSmoothPath(route.points, 0, firstEnd);
  if (hasGap && secondStart <= end) drawSmoothPath(route.points, secondStart, end);
  ctx.restore();

  if (isCurrent && hasGap && secondStart <= end) {
    const reentry = pointToCanvas(route.points[secondStart]);
    ctx.save();
    ctx.strokeStyle = `rgba(199, 213, 140, ${.22 + route.pause * .48})`;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(reentry.x - width * .012, reentry.y + height * .004);
    ctx.lineTo(reentry.x, reentry.y);
    ctx.stroke();
    ctx.restore();
  }

  if (isCurrent && route.failed && route.failureSegment >= 0 && route.failureSegment <= end) {
    const refusal = pointToCanvas(route.points[route.failureSegment]);
    ctx.save();
    ctx.strokeStyle = colors.refusal;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(refusal.x - width * .012, refusal.y - height * .012);
    ctx.lineTo(refusal.x + width * .012, refusal.y + height * .012);
    ctx.stroke();
    ctx.restore();
  }
}

function eligibleRefusals(memory, stage) {
  return memory.filter((refusal) => refusal.stage < stage);
}

function drawMemory(memory, stage) {
  const refusals = eligibleRefusals(memory, stage).slice(-28);
  refusals.forEach((refusal, index) => {
    const point = pointToCanvas(refusal);
    const active = refusal.id === selectedRefusalId;
    const lifted = refusal.id === liftedRefusalId;
    ctx.save();
    ctx.strokeStyle = lifted ? 'rgba(143, 160, 157, .42)' : `rgba(242, 133, 103, ${.16 + index / Math.max(1, refusals.length) * .45})`;
    ctx.lineWidth = active ? 1.5 : .65;
    ctx.setLineDash(lifted ? [2, 5] : []);
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 9 : 3.5 + index % 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x - (active ? 12 : 6), point.y);
    ctx.lineTo(point.x + (active ? 12 : 6), point.y);
    ctx.stroke();
    ctx.restore();
  });
}

function selectLatestRefusal() {
  const refusals = eligibleRefusals(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  return refusals.at(-1) ?? refusals.at(-2) ?? null;
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function refreshButtons() {
  const hasLift = Boolean(liftedRefusalId);
  if (liftButton) liftButton.textContent = hasLift ? 'lift another refusal' : 'lift a refusal';
  if (restoreButton) restoreButton.disabled = !hasLift;
}

function toggleRefusal(refusal) {
  if (!refusal) {
    updateState('No earlier refusal is available in this stage.');
    return;
  }
  selectedRefusalId = refusal.id;
  liftedRefusalId = liftedRefusalId === refusal.id ? null : refusal.id;
  refreshButtons();
  updateState(liftedRefusalId
    ? `Refusal ${refusal.stage}.${String(refusal.route).padStart(2, '0')} lifted — later beats rebuilt.`
    : 'The refusal returns; the sentence loses its place again.');
  render(performance.now());
}

function liftLatestRefusal() {
  const refusals = eligibleRefusals(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  const next = refusals.findLast((refusal) => refusal.id !== liftedRefusalId) ?? selectLatestRefusal();
  toggleRefusal(next);
}

function restoreMemory() {
  liftedRefusalId = null;
  selectedRefusalId = null;
  refreshButtons();
  updateState('The sentence is carrying a lost beat.');
  render(performance.now());
}

function pickRefusal(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const refusals = eligibleRefusals(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  let closest = null;
  let closestDistance = .045;
  for (const refusal of refusals) {
    const gap = Math.hypot(refusal.x - x, refusal.y - y);
    if (gap < closestDistance) {
      closest = refusal;
      closestDistance = gap;
    }
  }
  return closest;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v004.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function render(now) {
  const elapsed = reduced || staticPreview || paused ? STAGE_MS * FINAL_STAGE : Math.max(0, now - startedAt);
  const stage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
  const progress = stage === FINAL_STAGE ? 1 : (elapsed % STAGE_MS) / STAGE_MS;
  const data = buildStage(stage, { omitScarId: liftedRefusalId });
  frameState = { stage, progress, data };

  drawBackground();
  drawHistoricRoutes(data.history, stage);
  data.routes.forEach((route) => drawRoute(route, stage === FINAL_STAGE ? 1 : Math.min(1, progress * 1.3), true));
  drawMemory(data.memory, stage);

  drawLabel(`LOST BEAT / ${String(stage).padStart(2, '0')}`, width * .045, height * .075, colors.ink);
  const compact = width < 600;
  const memoryLabel = liftedRefusalId
    ? (compact ? 'LIFTED / RE-ENTERING' : 'REFUSAL LIFTED / RE-ENTERING')
    : (compact ? 'ACTIVE / ONE HAND' : 'MEMORY ACTIVE / ONE HAND');
  drawLabel(memoryLabel, compact ? width * .045 : width * .955, compact ? height * .11 : height * .075, liftedRefusalId ? colors.refusal : colors.reentry, compact ? 'left' : 'right');
  const pauseCount = data.routes.filter((route) => route.pause > 0).length;
  drawLabel(`${pauseCount} LOST BEATS · ${data.memory.length} REFUSALS`, width * .045, height * .91, colors.muted);
  if (interactive && !staticPreview) drawLabel('CLICK A REFUSAL · TAB TO ACTIONS · SPACE TO LIFT', width * .955, height * .91, colors.muted, 'right');
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  render(performance.now());
}

function animate(now) {
  render(now);
  if (!(reduced || staticPreview || paused)) window.requestAnimationFrame(animate);
}

canvas.addEventListener('pointerup', (event) => {
  const refusal = pickRefusal(event.clientX, event.clientY);
  if (refusal) toggleRefusal(refusal);
});
canvas.addEventListener('keydown', (event) => {
  const refusals = eligibleRefusals(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const currentIndex = Math.max(0, refusals.findIndex((refusal) => refusal.id === selectedRefusalId));
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    selectedRefusalId = refusals[(currentIndex + delta + refusals.length) % refusals.length]?.id ?? null;
    updateState(selectedRefusalId ? `Refusal ${selectedRefusalId.replace('stage-', '').replace('-route-', '.')} selected.` : 'No remembered refusal selected.');
    render(performance.now());
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleRefusal(refusals.find((refusal) => refusal.id === selectedRefusalId) ?? selectLatestRefusal());
  }
  if (event.key.toLowerCase() === 'r') restoreMemory();
  if (event.key.toLowerCase() === 's') saveStill();
  if (event.key.toLowerCase() === 'p') {
    paused = !paused;
    updateState(paused ? 'Timeline paused; the lost place is held.' : 'Timeline moving; the sentence is carrying a lost beat.');
    if (!paused && !reduced && !staticPreview) {
      startedAt = performance.now() - FINAL_STAGE * STAGE_MS;
      window.requestAnimationFrame(animate);
    }
  }
});

liftButton?.addEventListener('click', liftLatestRefusal);
restoreButton?.addEventListener('click', restoreMemory);
new ResizeObserver(resize).observe(canvas);
refreshButtons();
resize();
if (!(reduced || staticPreview)) window.requestAnimationFrame(animate);

window.__mutineHandwriting = {
  getState: () => ({
    stage: frameState?.stage ?? null,
    liftedRefusalId,
    selectedRefusalId,
    lostBeatCount: frameState?.data.routes.filter((route) => route.pause > 0).length ?? 0
  })
};
