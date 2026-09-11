import {
  applyRelay,
  buildTimeline,
  removeLatestRelay
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = 12;
const STAGE_MS = 4300;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#090d12',
  pageMid: '#1b2940',
  pageGlow: '#302645',
  paper: '#111b24',
  ink: '#f1eadb',
  ghost: '#9ca7ae',
  cold: '#8bbad1',
  accent: '#f2a56f',
  signal: '#a9d8c8',
  violet: '#bca4df',
  grid: 'rgba(139, 186, 209, .09)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.42 };
let selectedRelayId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-relay');
const releaseButton = document.querySelector('#release-sequence');
const placeButton = document.querySelector('#place-relay');

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
  gradient.addColorStop(1, '#040608');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.64, height * 0.45, 0, width * 0.64, height * 0.45, width * 0.82);
  glow.addColorStop(0, 'rgba(188, 164, 223, .14)');
  glow.addColorStop(0.48, 'rgba(139, 186, 209, .045)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 15; index += 1) {
    const y = height * (0.105 + index * 0.052);
    ctx.beginPath();
    ctx.moveTo(width * 0.028, y);
    ctx.lineTo(width * 0.972, y);
    ctx.stroke();
  }
  for (let index = 0; index < 36; index += 1) {
    const x = width * (0.038 + index * 0.027);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.06);
    ctx.lineTo(x, height * 0.93);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 560; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = 0.007 + ((index * 17) % 23) / 1800;
    ctx.fillStyle = `rgba(242, 165, 111, ${alpha})`;
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
      ctx.strokeStyle = `rgba(156, 167, 174, ${alpha})`;
      ctx.lineWidth = 0.55;
      drawSmoothPath(route.points);
    });
  });
}

function drawCurrentRoute(route, index) {
  const affected = route.relayStart >= 0;
  const baseAlpha = affected ? 0.82 : 0.32 + (index % 3) * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(241, 234, 219, ${baseAlpha})`;
  ctx.lineWidth = affected ? 1.02 + route.weight * 0.38 : 0.68 + route.weight * 0.2;
  drawSmoothPath(route.points);
  ctx.restore();

  if (affected && !blind) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.strokeStyle = route.relaySource === latestVisitorId ? 'rgba(242, 165, 111, .27)' : 'rgba(169, 216, 200, .17)';
    ctx.lineWidth = 4.2;
    drawSmoothPath(route.points, route.relayStart, route.relayEnd);
    ctx.strokeStyle = route.relaySource === latestVisitorId ? colors.accent : colors.signal;
    ctx.globalAlpha = 0.38 + route.relayStrength * 0.3;
    ctx.lineWidth = 0.75;
    drawSmoothPath(route.points, route.relayStart, route.relayEnd);
    ctx.restore();
  }
}

function drawRelayWitness(relay, active = false) {
  if (blind) return;
  const point = pointToCanvas(relay);
  const radius = Math.max(8, Math.min(30, width * 0.019));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = active ? 'rgba(242, 165, 111, .48)' : 'rgba(169, 216, 200, .22)';
  ctx.lineWidth = active ? 1.25 : 0.7;
  ctx.setLineDash(active ? [] : [1.5, 5]);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius * 0.92, radius * 0.42, -0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = active ? colors.accent : colors.signal;
  ctx.globalAlpha = active ? 0.78 : 0.42;
  ctx.beginPath();
  ctx.moveTo(point.x - radius * 0.62, point.y - radius * 0.23);
  ctx.quadraticCurveTo(point.x, point.y + radius * 0.44, point.x + radius * 0.62, point.y - radius * 0.23);
  ctx.stroke();
  ctx.restore();
}

function drawMemory() {
  frameState.relays.forEach((relay, index) => {
    if (!relay.affectedRoutes) return;
    const active = relay.id === selectedRelayId || relay.id === latestVisitorId;
    drawRelayWitness(relay, active);
    if (!blind) {
      const point = pointToCanvas(relay);
      ctx.save();
      ctx.strokeStyle = relay.id === latestVisitorId ? colors.accent : `rgba(139, 186, 209, ${0.2 + index * 0.04})`;
      ctx.lineWidth = active ? 1.4 : 0.65;
      ctx.setLineDash(relay.id === latestVisitorId ? [] : [2, 4]);
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

  const affected = frameState.routes.filter((route) => route.relayStart >= 0).length;
  const stagger = frameState.routes.filter((route) => route.handoffIndex >= 0).map((route) => route.relayStart);
  const spread = stagger.length ? Math.max(...stagger) - Math.min(...stagger) : 0;
  drawLabel(`RELAY / ${String(stage).padStart(2, '0')}`, width * 0.04, height * 0.07, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR RELAY / HANDOFF HELD' : 'MEMORY ACTIVE / THE BREAK IS MOVING', width * 0.96, height * 0.07, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${affected} ROUTES IN HANDOFF · ${frameState.memory.length} RELAYS REMEMBERED · ${spread} POINT SPREAD`, width * 0.04, height * 0.93, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO RELAY · TAB TO ACTIONS · SPACE TO RELAY', width * 0.96, height * 0.93, colors.ghost, 'right');

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
  frameState = applyRelay(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedRelayId = latestVisitorId;
  paused = true;
  updateState('The break was handed onward; several routes now carry its changed cadence.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  const latest = frameState.memory.at(-1);
  selectedRelayId = latest.id;
  frameState = removeLatestRelay(frameState);
  latestVisitorId = null;
  paused = true;
  updateState('Latest relay lifted; the earlier sentence is restored exactly.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  frameState = timeline[0];
  latestVisitorId = null;
  selectedRelayId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is released; a new handoff will arrive.');
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
  link.download = 'mutine-handwriting-v008-walking-break.png';
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
    updateState(paused ? 'Timeline paused; the relay is held.' : 'Timeline moving; the break is still learning the routes.');
  }
});

placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
new ResizeObserver(resize).observe(canvas);
window.__mutineHandwritingV008 = {
  getState: () => ({ stage: frameState.stage, memory: frameState.memory.length, paused, affectedRoutes: frameState.routes.filter((route) => route.relayStart >= 0).length }),
  getFrameSignature: () => JSON.stringify(frameState.routes.map((route) => route.points))
};
updateButtons();
resize();
if (!paused) animationFrame = window.requestAnimationFrame(drawFrame);
