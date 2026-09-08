import { buildStage } from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1';
const FINAL_STAGE = 7;
const STAGE_MS = 8500;
const colors = {
  bgTop: '#0d1a1d',
  bgBottom: '#071013',
  grid: 'rgba(185, 211, 148, .085)',
  ghost: 'rgba(185, 211, 148, .14)',
  ink: '#e9eadf',
  branch: '#b9d394',
  muted: '#71847d',
  scar: '#f27963',
  scarDim: 'rgba(242, 121, 99, .23)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let selectedScarId = null;
let liftedScarId = null;
let paused = false;
let frameState = null;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-memory');
const restoreButton = document.querySelector('#restore-memory');
if (interactive) document.body.classList.add('interactive');

function pointToCanvas(point) {
  return { x: point.x * width, y: point.y * height };
}

function drawPath(points, progress = 1) {
  if (!points?.length) return;
  const end = Math.max(1, Math.min(points.length - 1, Math.floor((points.length - 1) * progress)));
  const remainder = Math.min(1, (points.length - 1) * progress - end);
  const first = pointToCanvas(points[0]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index <= end; index += 1) {
    const point = pointToCanvas(points[index]);
    const previous = pointToCanvas(points[index - 1]);
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
    if (index === end && remainder > 0 && index < points.length - 1) {
      const next = pointToCanvas(points[index + 1]);
      ctx.quadraticCurveTo(point.x, point.y, point.x + (next.x - point.x) * remainder, point.y + (next.y - point.y) * remainder);
    } else if (index === end) {
      ctx.quadraticCurveTo(point.x, point.y, point.x, point.y);
    }
  }
  ctx.stroke();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors.bgTop);
  gradient.addColorStop(1, colors.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let x = width * 0.045; x < width; x += width * 0.091) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.09);
    ctx.lineTo(x, height * 0.86);
    ctx.stroke();
  }
  for (let y = height * 0.15; y < height * 0.87; y += height * 0.13) {
    ctx.beginPath();
    ctx.moveTo(width * 0.04, y);
    ctx.lineTo(width * 0.96, y);
    ctx.stroke();
  }
}

function drawLabel(text, x, y, color = colors.muted, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${Math.max(9, Math.min(12, width / 125))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHistoricRoutes(history, stage) {
  const from = Math.max(0, stage - 3);
  history.slice(from, stage).forEach((entry, offset) => {
    const alpha = 0.07 + offset * 0.025;
    entry.routes.forEach((route) => {
      ctx.strokeStyle = `rgba(185, 211, 148, ${alpha})`;
      ctx.lineWidth = 0.65;
      drawPath(route.points, 1);
    });
  });
}

function drawRoute(route, progress, isCurrent) {
  const visibility = isCurrent ? 0.88 : 0.22;
  if (route.fracture > 0 && route.branchPoints) {
    ctx.save();
    ctx.strokeStyle = `rgba(242, 121, 99, ${isCurrent ? 0.31 : 0.13})`;
    ctx.lineWidth = isCurrent ? 0.65 : 0.45;
    ctx.setLineDash([2, 8]);
    drawPath(route.draftPoints, progress);
    ctx.restore();
  }

  ctx.strokeStyle = isCurrent ? `rgba(233, 234, 223, ${visibility})` : `rgba(233, 234, 223, .18)`;
  ctx.lineWidth = isCurrent ? 1.05 + route.fracture * 0.9 : 0.6;
  drawPath(route.points, progress);

  if (route.branchPoints) {
    ctx.save();
    ctx.strokeStyle = isCurrent ? `rgba(185, 211, 148, ${0.38 + route.fracture * 0.34})` : 'rgba(185, 211, 148, .13)';
    ctx.lineWidth = isCurrent ? 0.8 : 0.45;
    drawPath(route.branchPoints, progress);
    ctx.restore();
  }

  if (isCurrent && route.failed && route.failureSegment >= 0) {
    const start = pointToCanvas(route.points[route.failureSegment]);
    const end = pointToCanvas(route.points[Math.min(route.failureSegment + 1, route.points.length - 1)]);
    ctx.save();
    ctx.strokeStyle = colors.scar;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }
}

function eligibleScars(memory, stage) {
  return memory.filter((scar) => scar.stage < stage);
}

function drawMemory(memory, stage) {
  const scars = eligibleScars(memory, stage).slice(-22);
  scars.forEach((scar, index) => {
    const point = pointToCanvas(scar);
    const active = scar.id === selectedScarId;
    const lifted = scar.id === liftedScarId;
    ctx.save();
    ctx.strokeStyle = lifted ? 'rgba(149, 163, 157, .45)' : `rgba(242, 121, 99, ${0.2 + index / scars.length * 0.5})`;
    ctx.lineWidth = active ? 1.5 : 0.7;
    ctx.setLineDash(lifted ? [2, 5] : []);
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 10 : 5 + (index % 3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x - (active ? 14 : 8), point.y);
    ctx.lineTo(point.x + (active ? 14 : 8), point.y);
    ctx.stroke();
    ctx.restore();
  });
}

function selectLatestScar() {
  const scars = eligibleScars(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  return scars.at(-1) ?? scars.at(-2) ?? null;
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function refreshButtons() {
  const hasLift = Boolean(liftedScarId);
  if (liftButton) liftButton.textContent = hasLift ? 'lift another scar' : 'lift a scar';
  if (restoreButton) restoreButton.disabled = !hasLift;
}

function toggleScar(scar) {
  if (!scar) {
    updateState('No earlier refusal is available in this stage.');
    return;
  }
  selectedScarId = scar.id;
  liftedScarId = liftedScarId === scar.id ? null : scar.id;
  refreshButtons();
  updateState(liftedScarId
    ? `Scar ${scar.stage}.${String(scar.route).padStart(2, '0')} lifted — later handwriting recomposed.`
    : 'The lifted scar returns; the sentence carries its fracture again.');
  render(performance.now());
}

function liftLatestScar() {
  const scars = eligibleScars(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  const next = scars.findLast((scar) => scar.id !== liftedScarId) ?? selectLatestScar();
  toggleScar(next);
}

function restoreMemory() {
  liftedScarId = null;
  selectedScarId = null;
  refreshButtons();
  updateState('The route is carrying its refusals.');
  render(performance.now());
}

function pickScar(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const scars = eligibleScars(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  let closest = null;
  let closestDistance = 0.045;
  for (const scar of scars) {
    const gap = Math.hypot(scar.x - x, scar.y - y);
    if (gap < closestDistance) {
      closest = scar;
      closestDistance = gap;
    }
  }
  return closest;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v003.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function render(now) {
  const elapsed = reduced || staticPreview || paused ? STAGE_MS * FINAL_STAGE : Math.max(0, now - startedAt);
  const stage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
  const progress = stage === FINAL_STAGE ? 1 : (elapsed % STAGE_MS) / STAGE_MS;
  const data = buildStage(stage, { omitScarId: liftedScarId });
  frameState = { stage, progress, data };

  drawBackground();
  drawHistoricRoutes(data.history, stage);
  data.routes.forEach((route) => drawRoute(route, stage === FINAL_STAGE ? 1 : Math.min(1, progress * 1.35), true));
  drawMemory(data.memory, stage);

  drawLabel(`FRACTURE FIELD / ${String(stage).padStart(2, '0')}`, width * 0.045, height * 0.075, colors.ink);
  const compact = width < 600;
  const memoryLabel = liftedScarId
    ? (compact ? 'LIFTED / REBUILT' : 'MEMORY LIFTED / RECOMPUTING')
    : (compact ? 'ACTIVE / SPLIT' : 'MEMORY ACTIVE / ROUTE SPLIT');
  drawLabel(memoryLabel, compact ? width * 0.045 : width * 0.955, compact ? height * 0.11 : height * 0.075, liftedScarId ? colors.scar : colors.branch, compact ? 'left' : 'right');
  drawLabel(`${data.routes.filter((route) => route.failed).length} REFUSALS · ${data.routes.filter((route) => route.fracture > 0).length} SPLITS`, width * 0.045, height * 0.91, colors.muted);
  if (interactive && !staticPreview) drawLabel('CLICK A SCAR · TAB TO ACTIONS · SPACE TO LIFT', width * 0.955, height * 0.91, colors.muted, 'right');
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
  const scar = pickScar(event.clientX, event.clientY);
  if (scar) toggleScar(scar);
});
canvas.addEventListener('keydown', (event) => {
  const scars = eligibleScars(frameState?.data.memory ?? [], frameState?.stage ?? FINAL_STAGE);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const currentIndex = Math.max(0, scars.findIndex((scar) => scar.id === selectedScarId));
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    selectedScarId = scars[(currentIndex + delta + scars.length) % scars.length]?.id ?? null;
    updateState(selectedScarId ? `Scar ${selectedScarId.replace('stage-', '').replace('-route-', '.')} selected.` : 'No remembered refusal selected.');
    render(performance.now());
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleScar(scars.find((scar) => scar.id === selectedScarId) ?? selectLatestScar());
  }
  if (event.key.toLowerCase() === 'r') restoreMemory();
  if (event.key.toLowerCase() === 's') saveStill();
  if (event.key.toLowerCase() === 'p') {
    paused = !paused;
    updateState(paused ? 'Timeline paused; the current route is held.' : 'Timeline moving; the route is carrying its refusals.');
    if (!paused && !reduced && !staticPreview) { startedAt = performance.now() - FINAL_STAGE * STAGE_MS; window.requestAnimationFrame(animate); }
  }
});

liftButton?.addEventListener('click', liftLatestScar);
restoreButton?.addEventListener('click', restoreMemory);
new ResizeObserver(resize).observe(canvas);
refreshButtons();
resize();
if (!(reduced || staticPreview)) window.requestAnimationFrame(animate);

window.__mutineHandwriting = {
  getState: () => ({ stage: frameState?.stage ?? null, liftedScarId, selectedScarId, splitCount: frameState?.data.routes.filter((route) => route.fracture > 0).length ?? 0 })
};
