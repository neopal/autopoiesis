import {
  STAGES,
  applyStutter,
  buildTimeline,
  deleteLatestStutter
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 3600;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#080b16',
  pageMid: '#1e3152',
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
  gradient.addColorStop(0.43, colors.page);
  gradient.addColorStop(1, '#03050b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.52, height * 0.46, 0, width * 0.52, height * 0.46, width * 0.76);
  glow.addColorStop(0, 'rgba(200, 181, 239, .14)');
  glow.addColorStop(.42, 'rgba(142, 203, 217, .05)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = .5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 18; index += 1) {
    const y = height * (.06 + index * .052);
    ctx.beginPath();
    ctx.moveTo(width * .03, y);
    ctx.lineTo(width * .97, y);
    ctx.stroke();
  }
  for (let index = 0; index < 48; index += 1) {
    const x = width * (.03 + index * .021);
    ctx.beginPath();
    ctx.moveTo(x, height * .04);
    ctx.lineTo(x, height * .95);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 720; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = .004 + ((index * 17) % 23) / 1900;
    ctx.fillStyle = `rgba(255, 171, 118, ${alpha})`;
    ctx.fillRect(x, y, .75, .75);
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
      ctx.strokeStyle = `rgba(145, 160, 180, ${.012 + offset * .014})`;
      ctx.lineWidth = .5;
      drawSmoothPath(route.points);
    });
  });
}

function drawStutterWitness(route, record, index) {
  if (blind) return;
  const start = pointToCanvas(route.points[record.start]);
  const pivot = pointToCanvas(route.points[record.index]);
  const repeat = pointToCanvas(route.points[record.repeatEnd]);
  const active = record.id === latestVisitorId || record.id === selectedStutterId;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = active ? 'rgba(255, 171, 118, .55)' : 'rgba(185, 226, 195, .22)';
  ctx.lineWidth = active ? 2.8 : 1;
  ctx.setLineDash(active ? [] : [2, 4]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(pivot.x, pivot.y);
  ctx.lineTo(repeat.x, repeat.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = index % 2 ? colors.signal : colors.accent;
  ctx.lineWidth = active ? 1.2 : .75;
  ctx.globalAlpha = .62;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, active ? 9 : 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRehearsalTrace(route, record, index) {
  if (blind) return;
  const active = record.id === latestVisitorId || record.id === selectedStutterId;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = active ? 1.8 : .7;
  ctx.strokeStyle = index % 2 ? 'rgba(142, 203, 217, .34)' : 'rgba(255, 171, 118, .28)';
  ctx.beginPath();
  const trace = route.points.slice(record.backtrackStart, record.repeatEnd + 1);
  drawSmoothPath(trace);
  ctx.restore();
}

function drawCurrentRoute(route, index) {
  const stuttered = route.stutterHistory.length > 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(245, 236, 217, ${stuttered ? .88 : .27 + (index % 3) * .055})`;
  ctx.lineWidth = stuttered ? 1.08 + route.weight * .35 : .58 + route.weight * .18;
  drawSmoothPath(route.points);
  ctx.restore();
  if (stuttered) {
    route.stutterHistory.forEach((record, recordIndex) => {
      drawRehearsalTrace(route, record, recordIndex);
      drawStutterWitness(route, record, recordIndex);
    });
  }
}

function drawMemory() {
  if (blind) return;
  frameState.stutters.forEach((event, index) => {
    if (!event.stuttered) return;
    const point = pointToCanvas(event.point);
    const active = event.id === selectedStutterId || event.id === latestVisitorId;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = active ? colors.accent : `rgba(142, 203, 217, ${.2 + index * .03})`;
    ctx.lineWidth = active ? 1.4 : .65;
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

  const stuttered = frameState.routes.filter((route) => route.stutterHistory.length > 0).length;
  const maxBacktrack = frameState.stutters.reduce((max, event) => Math.max(max, event.backtrackDistance), 0);
  drawLabel(`STUTTER / ${String(stage).padStart(2, '0')}`, width * .04, height * .07, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR STUTTER / CADENCE CARRIED' : 'MEMORY ACTIVE / HESITATIONS ARE LEARNING', width * .96, height * .07, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${stuttered} ROUTES REHEARSING · ${frameState.memory.length} STUTTERS REMEMBERED · MAX RETURN ${maxBacktrack.toFixed(3)}`, width * .04, height * .93, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO STUTTER · TAB TO ACTIONS · SPACE TO STUTTER', width * .96, height * .93, colors.ghost, 'right');

  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      selectedStutterId = frameState.memory.at(-1)?.id ?? null;
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
  window.cancelAnimationFrame(animationFrame);
  lastPointer = position;
  frameState = applyStutter(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedStutterId = latestVisitorId;
  paused = true;
  updateState('The routes stuttered; their resumed cadence is carrying the hesitation downstream.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = deleteLatestStutter(frameState);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedStutterId = latestVisitorId;
  paused = true;
  updateState('The latest stutter lifted; the earlier sentence is exact again.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  latestVisitorId = null;
  selectedStutterId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is moving; its stutters are still latent.');
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

window.__mutineHandwritingV011 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((event) => ({ ...event })),
    stutteredRoutes: frameState.routes.filter((route) => route.stutterHistory.length > 0).length,
    maxBacktrack: frameState.stutters.reduce((max, event) => Math.max(max, event.backtrackDistance), 0),
    paused,
    interactive,
    blind
  }),
  placeAt,
  liftLatest,
  releaseSequence,
  getFrameSignature: () => canvas.toDataURL(),
  getCanvas: () => canvas
};

updateButtons();
resize();
