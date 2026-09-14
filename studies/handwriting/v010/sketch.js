import {
  STAGES,
  applyHinge,
  buildTimeline,
  deleteLatestHinge
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 3900;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#080b16',
  pageMid: '#1b2b4a',
  paper: '#10182a',
  ink: '#f5ecd9',
  ghost: '#91a0b4',
  cold: '#8ecbd9',
  accent: '#ffab76',
  signal: '#b9e2c3',
  violet: '#c8b5ef',
  grid: 'rgba(142, 203, 217, .09)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.43 };
let selectedHingeId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-hinge');
const releaseButton = document.querySelector('#release-sequence');
const placeButton = document.querySelector('#place-hinge');

function pointToCanvas(point) {
  return { x: point.x * width, y: point.y * height };
}

function drawSmoothPath(points) {
  if (!points?.length) return;
  const first = pointToCanvas(points[0]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = pointToCanvas(points[index - 1]);
    const point = pointToCanvas(points[index]);
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
    if (index === points.length - 1) ctx.quadraticCurveTo(point.x, point.y, point.x, point.y);
  }
  ctx.stroke();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors.pageMid);
  gradient.addColorStop(0.45, colors.page);
  gradient.addColorStop(1, '#03050b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.52, height * 0.48, 0, width * 0.52, height * 0.48, width * 0.74);
  glow.addColorStop(0, 'rgba(200, 181, 239, .14)');
  glow.addColorStop(0.44, 'rgba(142, 203, 217, .05)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 16; index += 1) {
    const y = height * (0.08 + index * 0.055);
    ctx.beginPath();
    ctx.moveTo(width * 0.03, y);
    ctx.lineTo(width * 0.97, y);
    ctx.stroke();
  }
  for (let index = 0; index < 42; index += 1) {
    const x = width * (0.03 + index * 0.023);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.05);
    ctx.lineTo(x, height * 0.94);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 620; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = 0.005 + ((index * 17) % 23) / 1900;
    ctx.fillStyle = `rgba(255, 171, 118, ${alpha})`;
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
      ctx.strokeStyle = `rgba(145, 160, 180, ${0.012 + offset * 0.014})`;
      ctx.lineWidth = 0.5;
      drawSmoothPath(route.points);
    });
  });
}

function drawHingeWitness(route, index) {
  if (blind || route.hingeIndex < 0 || !route.hingePoint) return;
  const pivot = pointToCanvas(route.hingePoint);
  const start = pointToCanvas(route.points[route.hingeStart]);
  const end = pointToCanvas(route.points[route.hingeEnd]);
  const active = route.hingeSource === latestVisitorId || route.hingeIndex === selectedHingeId;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = active ? 'rgba(255, 171, 118, .48)' : 'rgba(185, 226, 195, .2)';
  ctx.lineWidth = active ? 3 : 1.1;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(pivot.x, pivot.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.strokeStyle = index % 2 ? colors.signal : colors.accent;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.58;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, active ? 9 : 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCurrentRoute(route, index) {
  const hinged = route.hingeIndex >= 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(245, 236, 217, ${hinged ? 0.88 : 0.29 + (index % 3) * 0.055})`;
  ctx.lineWidth = hinged ? 1.12 + route.weight * 0.35 : 0.64 + route.weight * 0.18;
  drawSmoothPath(route.points);
  ctx.restore();
  if (hinged) drawHingeWitness(route, index);
}

function drawMemory() {
  if (blind) return;
  frameState.hinges.forEach((event, index) => {
    if (!event.hinged) return;
    const point = pointToCanvas(event.point);
    const active = event.id === selectedHingeId || event.id === latestVisitorId;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = active ? colors.accent : `rgba(142, 203, 217, ${0.2 + index * 0.03})`;
    ctx.lineWidth = active ? 1.4 : 0.65;
    ctx.setLineDash(active ? [] : [2, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 12 : 5 + (index % 2), 0, Math.PI * 2);
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

  const hinged = frameState.routes.filter((route) => route.hingeIndex >= 0).length;
  const maxFold = frameState.hinges.reduce((max, event) => Math.max(max, event.foldAngle), 0);
  drawLabel(`HINGE / ${String(stage).padStart(2, '0')}`, width * 0.04, height * 0.07, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR HINGE / ANGLE CARRIED' : 'MEMORY ACTIVE / FOLDS ARE LEARNING', width * 0.96, height * 0.07, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${hinged} ROUTES BENT · ${frameState.memory.length} HINGES REMEMBERED · MAX FOLD ${maxFold.toFixed(2)} RAD`, width * 0.04, height * 0.93, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO HINGE · TAB TO ACTIONS · SPACE TO HINGE', width * 0.96, height * 0.93, colors.ghost, 'right');

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

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (placeButton) placeButton.disabled = !interactive || staticPreview;
  if (liftButton) liftButton.disabled = !interactive || staticPreview || frameState.memory.length === 0;
  if (releaseButton) releaseButton.disabled = !interactive || staticPreview;
}

function positionFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / Math.max(1, rect.width),
    y: (event.clientY - rect.top) / Math.max(1, rect.height)
  };
}

function placeAt(position) {
  if (!interactive || staticPreview) return;
  lastPointer = position;
  frameState = applyHinge(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedHingeId = latestVisitorId;
  paused = true;
  updateState('The routes pivoted; their exits are carrying the hinge downstream.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = deleteLatestHinge(frameState);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedHingeId = latestVisitorId;
  paused = true;
  updateState('The latest hinge lifted; the earlier sentence is exact again.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  latestVisitorId = null;
  selectedHingeId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is moving; its hinges are still latent.');
  updateButtons();
  drawFrame(startedAt);
}

canvas.addEventListener('pointermove', (event) => {
  lastPointer = positionFromEvent(event);
});
canvas.addEventListener('pointerup', (event) => {
  if (interactive) placeAt(positionFromEvent(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    placeAt(lastPointer);
  }
  if (event.key.toLowerCase() === 'p') canvas.focus();
  if (event.key.toLowerCase() === 'r') releaseSequence();
});
placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', resize);

window.__mutineHandwritingV010 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((event) => ({ ...event })),
    paused,
    interactive,
    blind
  }),
  placeAt,
  liftLatest,
  releaseSequence,
  getCanvas: () => canvas
};

updateButtons();
resize();
