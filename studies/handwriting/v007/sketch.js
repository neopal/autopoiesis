import {
  applyStutter,
  buildTimeline,
  removeLatestStutter
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = 12;
const STAGE_MS = 4400;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#080b12',
  pageMid: '#182337',
  pageGlow: '#2a2440',
  paper: '#111c28',
  ink: '#f4ead7',
  ghost: '#94a2b3',
  cold: '#86afd8',
  accent: '#ffbe69',
  signal: '#b7d8c2',
  violet: '#b38cd9',
  grid: 'rgba(134, 175, 216, .09)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.42 };
let selectedStutterId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-stutter');
const releaseButton = document.querySelector('#release-sequence');
const placeButton = document.querySelector('#place-stutter');

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
  gradient.addColorStop(1, '#04060a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.42, height * 0.45, 0, width * 0.42, height * 0.45, width * 0.8);
  glow.addColorStop(0, 'rgba(179, 140, 217, .14)');
  glow.addColorStop(0.48, 'rgba(134, 175, 216, .045)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 13; index += 1) {
    const y = height * (0.105 + index * 0.063);
    ctx.beginPath();
    ctx.moveTo(width * 0.028, y);
    ctx.lineTo(width * 0.972, y);
    ctx.stroke();
  }
  for (let index = 0; index < 32; index += 1) {
    const x = width * (0.045 + index * 0.0295);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.06);
    ctx.lineTo(x, height * 0.93);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 520; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = 0.007 + ((index * 17) % 23) / 1800;
    ctx.fillStyle = `rgba(255, 190, 105, ${alpha})`;
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
    const alpha = 0.018 + offset * 0.016;
    entry.routes.forEach((route) => {
      ctx.strokeStyle = `rgba(148, 162, 179, ${alpha})`;
      ctx.lineWidth = 0.55;
      drawSmoothPath(route.points);
    });
  });
}

function drawCurrentRoute(route, index) {
  const affected = route.stutterStart >= 0;
  const baseAlpha = affected ? 0.8 : 0.34 + (index % 3) * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(244, 234, 215, ${baseAlpha})`;
  ctx.lineWidth = affected ? 1.08 + route.weight * 0.38 : 0.68 + route.weight * 0.2;
  drawSmoothPath(route.points);
  ctx.restore();

  if (affected && !blind) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.strokeStyle = route.stutterSource === latestVisitorId ? 'rgba(255, 190, 105, .28)' : 'rgba(183, 216, 194, .17)';
    ctx.lineWidth = 4.4;
    drawSmoothPath(route.points, route.stutterStart, route.stutterEnd);
    ctx.strokeStyle = route.stutterSource === latestVisitorId ? colors.accent : colors.signal;
    ctx.globalAlpha = 0.4 + route.stutterStrength * 0.3;
    ctx.lineWidth = 0.75;
    drawSmoothPath(route.points, route.stutterStart, route.stutterEnd);
    ctx.restore();
  }
}

function drawStutterWitness(stutter, affectedRoutes, active = false) {
  if (blind || !affectedRoutes) return;
  const point = pointToCanvas(stutter);
  const radius = Math.max(8, Math.min(30, width * 0.019));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = active ? 'rgba(255, 190, 105, .46)' : 'rgba(183, 216, 194, .22)';
  ctx.lineWidth = active ? 1.25 : 0.7;
  ctx.setLineDash(active ? [] : [1.5, 5]);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius * 0.92, radius * 0.42, -0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = active ? colors.accent : colors.signal;
  ctx.globalAlpha = active ? 0.78 : 0.4;
  ctx.beginPath();
  ctx.moveTo(point.x - radius * 0.62, point.y - radius * 0.23);
  ctx.quadraticCurveTo(point.x, point.y + radius * 0.44, point.x + radius * 0.62, point.y - radius * 0.23);
  ctx.stroke();
  ctx.restore();
}

function drawMemory() {
  frameState.stutters.forEach((stutter, index) => {
    if (!stutter.affectedRoutes) return;
    const active = stutter.id === selectedStutterId || stutter.id === latestVisitorId;
    drawStutterWitness(stutter, stutter.affectedRoutes, active);
    if (!blind) {
      const point = pointToCanvas(stutter);
      ctx.save();
      ctx.strokeStyle = stutter.id === latestVisitorId ? colors.accent : `rgba(134, 175, 216, ${0.2 + index * 0.04})`;
      ctx.lineWidth = active ? 1.4 : 0.65;
      ctx.setLineDash(stutter.id === latestVisitorId ? [] : [2, 4]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, active ? 8 : 3.5 + (index % 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawFrame(now) {
  const stage = frameState.stage;
  drawBackground();
  drawHistoricRoutes(stage);
  frameState.routes.forEach(drawCurrentRoute);
  drawMemory();

  const affected = frameState.routes.filter((route) => route.stutterStart >= 0).length;
  drawLabel(`STUTTER / ${String(stage).padStart(2, '0')}`, width * 0.04, height * 0.07, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR STUTTER / CADENCE DISPLACED' : 'MEMORY ACTIVE / ROUTES REPEAT TOGETHER', width * 0.96, height * 0.07, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${affected} ROUTES IN REPEAT · ${frameState.memory.length} STUTTERS REMEMBERED`, width * 0.04, height * 0.93, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO STUTTER · TAB TO ACTIONS · SPACE TO STUTTER', width * 0.96, height * 0.93, colors.ghost, 'right');

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
  frameState = applyStutter(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedStutterId = latestVisitorId;
  paused = true;
  updateState('A shared stutter landed; neighbouring routes are repeating its hook.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  const latest = frameState.memory.at(-1);
  selectedStutterId = latest.id;
  frameState = removeLatestStutter(frameState);
  latestVisitorId = null;
  paused = true;
  updateState('Latest stutter lifted; the earlier sentence is restored exactly.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  frameState = timeline[0];
  latestVisitorId = null;
  selectedStutterId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is released; a new shared hesitation will arrive.');
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
  link.download = 'mutine-handwriting-v007-shared-stutter.png';
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
    updateState(paused ? 'Timeline paused; the shared hesitation is held.' : 'Timeline moving; routes are still learning the stutters.');
  }
});

placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
new ResizeObserver(resize).observe(canvas);
window.__mutineHandwritingV007 = {
  getState: () => ({ stage: frameState.stage, memory: frameState.memory.length, paused, affectedRoutes: frameState.routes.filter((route) => route.stutterStart >= 0).length }),
  getFrameSignature: () => JSON.stringify(frameState.routes.map((route) => route.points))
};
updateButtons();
resize();
if (!paused) animationFrame = window.requestAnimationFrame(drawFrame);
