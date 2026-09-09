import {
  applyGap,
  buildTimeline,
  removeLatestGap
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = 10;
const STAGE_MS = 5200;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#0a0c16',
  pageMid: '#181c31',
  pageGlow: '#2c2440',
  paper: '#111727',
  ink: '#f0e7d1',
  ghost: '#9099ae',
  cold: '#84b9c6',
  accent: '#f07f65',
  signal: '#d4d266',
  violet: '#9b8ad0',
  grid: 'rgba(132, 185, 198, .09)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.42 };
let selectedGapId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-gap');
const releaseButton = document.querySelector('#release-sequence');
const placeButton = document.querySelector('#place-gap');

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

function drawRouteSegments(route) {
  if (route.gapStart < 0 || route.gapEnd < 0) {
    drawSmoothPath(route.points);
    return;
  }
  drawSmoothPath(route.points, 0, route.gapStart);
  drawSmoothPath(route.points, route.gapEnd, route.points.length - 1);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors.pageMid);
  gradient.addColorStop(0.52, colors.page);
  gradient.addColorStop(1, '#05060c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.55, height * 0.46, 0, width * 0.55, height * 0.46, width * 0.78);
  glow.addColorStop(0, 'rgba(155, 138, 208, .13)');
  glow.addColorStop(0.46, 'rgba(132, 185, 198, .035)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 11; index += 1) {
    const y = height * (0.12 + index * 0.071);
    ctx.beginPath();
    ctx.moveTo(width * 0.035, y);
    ctx.lineTo(width * 0.965, y);
    ctx.stroke();
  }
  for (let index = 0; index < 24; index += 1) {
    const x = width * (0.055 + index * 0.038);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.08);
    ctx.lineTo(x, height * 0.9);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 440; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = 0.009 + ((index * 17) % 23) / 1500;
    ctx.fillStyle = `rgba(212, 210, 102, ${alpha})`;
    ctx.fillRect(x, y, 0.75, 0.75);
  }
  ctx.restore();
}

function drawLabel(text, x, y, color = colors.ghost, align = 'left') {
  if (blind) return;
  ctx.fillStyle = color;
  ctx.font = `${Math.max(9, Math.min(12, width / 126))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHistoricRoutes(stage) {
  const from = Math.max(0, stage - 3);
  timeline.slice(from, stage).forEach((entry, offset) => {
    const alpha = 0.022 + offset * 0.018;
    entry.routes.forEach((route) => {
      ctx.strokeStyle = `rgba(144, 153, 174, ${alpha})`;
      ctx.lineWidth = 0.55;
      drawRouteSegments(route);
    });
  });
}

function drawCurrentRoute(route, index) {
  const affected = route.gapStart >= 0;
  const baseAlpha = affected ? 0.78 : 0.38 + (index % 3) * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(240, 231, 209, ${baseAlpha})`;
  ctx.lineWidth = affected ? 1.05 + route.weight * 0.36 : 0.7 + route.weight * 0.2;
  drawRouteSegments(route);
  ctx.restore();

  if (affected) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.strokeStyle = route.gapSource === latestVisitorId ? 'rgba(240, 127, 101, .26)' : 'rgba(212, 210, 102, .19)';
    ctx.lineWidth = 4.2;
    drawRouteSegments(route);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = route.gapSource === latestVisitorId ? colors.accent : colors.signal;
    ctx.globalAlpha = 0.42 + route.gapStrength * 0.32;
    ctx.lineWidth = 0.7;
    drawSmoothPath(route.points, route.gapEnd, Math.min(route.points.length - 1, route.gapEnd + 7));
    ctx.restore();
  }
}

function drawAperture(gap, affectedRoutes, active = false) {
  if (!affectedRoutes) return;
  const point = pointToCanvas(gap);
  const color = active ? colors.accent : colors.signal;
  const radius = Math.max(7, Math.min(26, width * 0.018));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = active ? 'rgba(240, 127, 101, .32)' : 'rgba(212, 210, 102, .2)';
  ctx.lineWidth = active ? 1.1 : 0.7;
  ctx.setLineDash([1.5, 5]);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius * 0.5, radius * 1.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.globalAlpha = active ? 0.72 : 0.36;
  ctx.beginPath();
  ctx.moveTo(point.x - radius * 0.8, point.y);
  ctx.lineTo(point.x + radius * 0.8, point.y);
  ctx.stroke();
  ctx.restore();
}

function drawMemory() {
  if (blind) return;
  frameState.apertures.forEach((aperture, index) => {
    if (!aperture.affectedRoutes) return;
    const active = aperture.id === selectedGapId || aperture.id === latestVisitorId;
    drawAperture(aperture, aperture.affectedRoutes, active);
    const point = pointToCanvas(aperture);
    ctx.save();
    ctx.strokeStyle = aperture.id === latestVisitorId ? colors.accent : `rgba(132, 185, 198, ${0.2 + index * 0.04})`;
    ctx.lineWidth = active ? 1.5 : 0.65;
    ctx.setLineDash(aperture.id === latestVisitorId ? [] : [2, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 8 : 3.5 + (index % 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawFrame(now) {
  const stage = frameState.stage;
  drawBackground();
  drawHistoricRoutes(stage);
  frameState.routes.forEach(drawCurrentRoute);
  drawMemory();

  const affected = frameState.routes.filter((route) => route.gapStart >= 0).length;
  drawLabel(`COUNTERFORM / ${String(stage).padStart(2, '0')}`, width * 0.045, height * 0.075, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR GAP / ROUTES DISAPPEAR TOGETHER' : 'MEMORY ACTIVE / ROUTES SHARE THE MOUTH', width * 0.955, height * 0.075, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${affected} ROUTES IN APERTURE · ${frameState.memory.length} GAPS REMEMBERED`, width * 0.045, height * 0.925, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO OPEN · TAB TO ACTIONS · SPACE TO OPEN', width * 0.955, height * 0.925, colors.ghost, 'right');

  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      updateButtons();
    }
    if (nextStage < FINAL_STAGE) animationFrame = window.requestAnimationFrame(drawFrame);
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
  drawFrame(performance.now());
}

function placeAt(position) {
  if (!interactive || staticPreview) return;
  frameState = applyGap(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedGapId = latestVisitorId;
  paused = true;
  updateState('A gap opened; neighbouring routes are sharing its disappearance.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  const latest = frameState.memory.at(-1);
  selectedGapId = latest.id;
  frameState = removeLatestGap(frameState);
  latestVisitorId = null;
  paused = true;
  updateState('Latest gap lifted; the earlier sentence is restored exactly.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  frameState = timeline[0];
  latestVisitorId = null;
  selectedGapId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is released; new openings will arrive in sequence.');
  updateButtons();
  window.cancelAnimationFrame(animationFrame);
  drawFrame(performance.now());
  animationFrame = window.requestAnimationFrame(drawFrame);
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (liftButton) liftButton.disabled = !interactive || staticPreview || !frameState.memory.length;
  if (releaseButton) releaseButton.disabled = !interactive || staticPreview;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v006-counterform.png';
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
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
  if (event.key.toLowerCase() === 'p') {
    paused = !paused;
    if (!paused) {
      startedAt = performance.now() - frameState.stage * STAGE_MS;
      animationFrame = window.requestAnimationFrame(drawFrame);
    }
    updateState(paused ? 'Timeline paused; the shared opening is held.' : 'Timeline moving; routes are still learning the gaps.');
  }
});

placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
new ResizeObserver(resize).observe(canvas);
updateButtons();
resize();
if (!paused) animationFrame = window.requestAnimationFrame(drawFrame);

window.__mutineHandwritingV006 = {
  getState: () => ({
    stage: frameState.stage,
    paused,
    memoryCount: frameState.memory.length,
    latestVisitorId,
    apertureCount: frameState.apertures.filter((aperture) => aperture.affectedRoutes > 0).length,
    sharedRoutes: frameState.routes.filter((route) => route.sharedGate).length,
    routeSignature: frameState.routes.map((route) => route.points.at(-1)),
    structuralGapRoutes: frameState.routes.filter((route) => route.gapStart < route.gapEnd).length
  }),
  stop: () => {
    paused = true;
    window.cancelAnimationFrame(animationFrame);
  }
};
