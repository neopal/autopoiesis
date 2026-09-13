import {
  STAGES,
  applySwitch,
  buildTimeline,
  deleteLatestSwitch
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 4200;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#0a0d18',
  pageMid: '#172541',
  paper: '#111a2b',
  ink: '#f4ecdc',
  ghost: '#8f9caf',
  cold: '#8ec8d6',
  accent: '#ff9f72',
  signal: '#b9dfbd',
  violet: '#c4b2ee',
  grid: 'rgba(142, 200, 214, .09)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.42 };
let selectedSwitchId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-switch');
const releaseButton = document.querySelector('#release-sequence');
const placeButton = document.querySelector('#place-switch');

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
  gradient.addColorStop(0.46, colors.page);
  gradient.addColorStop(1, '#04060c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.52, height * 0.51, 0, width * 0.52, height * 0.51, width * 0.72);
  glow.addColorStop(0, 'rgba(196, 178, 238, .12)');
  glow.addColorStop(0.48, 'rgba(142, 200, 214, .045)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 14; index += 1) {
    const y = height * (0.105 + index * 0.055);
    ctx.beginPath();
    ctx.moveTo(width * 0.03, y);
    ctx.lineTo(width * 0.97, y);
    ctx.stroke();
  }
  for (let index = 0; index < 40; index += 1) {
    const x = width * (0.04 + index * 0.024);
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
    const alpha = 0.006 + ((index * 17) % 23) / 1900;
    ctx.fillStyle = `rgba(255, 159, 114, ${alpha})`;
    ctx.fillRect(x, y, 0.75, 0.75);
  }
  ctx.restore();
}

function drawLabel(text, x, y, color = colors.ghost, align = 'left') {
  if (blind) return;
  ctx.fillStyle = color;
  ctx.font = `${Math.max(9, Math.min(12, width / 128))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawHistoricRoutes(stage) {
  const from = Math.max(0, stage - 3);
  timeline.slice(from, stage).forEach((entry, offset) => {
    entry.routes.forEach((route) => {
      ctx.strokeStyle = `rgba(143, 156, 175, ${0.014 + offset * 0.014})`;
      ctx.lineWidth = 0.5;
      drawSmoothPath(route.points);
    });
  });
}

function drawCrossingWitness(route, index) {
  if (blind || route.switchStart < 0) return;
  const start = pointToCanvas(route.points[route.switchStart]);
  const end = pointToCanvas(route.points[route.switchEnd]);
  const cross = pointToCanvas(route.points[route.crossingIndex]);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = route.switchSource === latestVisitorId ? 'rgba(255, 159, 114, .46)' : 'rgba(185, 223, 189, .2)';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.strokeStyle = index % 2 ? colors.signal : colors.accent;
  ctx.globalAlpha = 0.48;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cross.x - 8, cross.y - (index % 2 ? -8 : 8));
  ctx.lineTo(cross.x + 8, cross.y + (index % 2 ? -8 : 8));
  ctx.stroke();
  ctx.restore();
}

function drawCurrentRoute(route, index) {
  const switched = route.reordered;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(244, 236, 220, ${switched ? 0.86 : 0.29 + (index % 3) * 0.06})`;
  ctx.lineWidth = switched ? 1.08 + route.weight * 0.34 : 0.64 + route.weight * 0.18;
  drawSmoothPath(route.points);
  ctx.restore();
  if (switched) drawCrossingWitness(route, index);
}

function drawMemory() {
  if (blind) return;
  frameState.switches.forEach((event, index) => {
    if (!event.reordered) return;
    const point = pointToCanvas(event.point);
    const active = event.id === selectedSwitchId || event.id === latestVisitorId;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = active ? colors.accent : `rgba(142, 200, 214, ${0.2 + index * 0.035})`;
    ctx.lineWidth = active ? 1.4 : 0.65;
    ctx.setLineDash(active ? [] : [2, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 9 : 4 + (index % 2), 0, Math.PI * 2);
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

  const switched = frameState.routes.filter((route) => route.reordered).length;
  const crossings = frameState.routes.filter((route) => route.crossingIndex >= 0).map((route) => route.crossingIndex);
  const spread = crossings.length ? Math.max(...crossings) - Math.min(...crossings) : 0;
  drawLabel(`SWITCH / ${String(stage).padStart(2, '0')}`, width * 0.04, height * 0.07, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR SWITCH / ORDER HELD' : 'MEMORY ACTIVE / LANES ARE LEARNING', width * 0.96, height * 0.07, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${switched} ROUTES CHANGED · ${frameState.memory.length} SWITCHES REMEMBERED · ${spread} POINT SPREAD`, width * 0.04, height * 0.93, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO SWITCH · TAB TO ACTIONS · SPACE TO SWITCH', width * 0.96, height * 0.93, colors.ghost, 'right');

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
  frameState = applySwitch(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedSwitchId = latestVisitorId;
  paused = true;
  updateState('The lanes crossed; each route is carrying the other downstream.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  selectedSwitchId = frameState.memory.at(-1).id;
  frameState = deleteLatestSwitch(frameState);
  latestVisitorId = null;
  paused = true;
  updateState('Latest switch lifted; the earlier sentence is restored exactly.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  frameState = timeline[0];
  latestVisitorId = null;
  selectedSwitchId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is released; the lanes will separate and cross again.');
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
  link.download = 'mutine-handwriting-v009-lane-switch.png';
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
    updateState(paused ? 'Timeline paused; the switch is held.' : 'Timeline moving; the next lane change is forming.');
  }
});

placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
new ResizeObserver(resize).observe(canvas);
window.__mutineHandwritingV009 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.length,
    paused,
    switchedRoutes: frameState.routes.filter((route) => route.reordered).length,
    crossingIndexes: frameState.routes.filter((route) => route.crossingIndex >= 0).map((route) => route.crossingIndex)
  }),
  getFrameSignature: () => JSON.stringify(frameState.routes.map((route) => route.points)),
  getCanvasDataUrl: () => canvas.toDataURL('image/png')
};
updateButtons();
resize();
if (!paused) animationFrame = window.requestAnimationFrame(drawFrame);
