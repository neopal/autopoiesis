import {
  STAGES,
  applyCadence,
  buildTimeline,
  removeLatestCadence
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 3400;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  page: '#0b1018',
  pageMid: '#29445e',
  paper: '#121b28',
  ink: '#f3eddf',
  ghost: '#96a8b5',
  cold: '#8bd0d5',
  accent: '#ff9c72',
  signal: '#bee4ca',
  violet: '#c2b5ef',
  grid: 'rgba(139, 208, 213, .08)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.43 };
let selectedCadenceId = null;
let latestVisitorId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-cadence');
const releaseButton = document.querySelector('#release-sequence');
const placeButton = document.querySelector('#place-cadence');

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
  gradient.addColorStop(0.43, colors.page);
  gradient.addColorStop(1, '#04070c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.55, height * 0.42, 0, width * 0.55, height * 0.42, width * 0.82);
  glow.addColorStop(0, 'rgba(194, 181, 239, .14)');
  glow.addColorStop(.46, 'rgba(139, 208, 213, .045)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = .5;
  ctx.strokeStyle = colors.grid;
  for (let index = 0; index < 21; index += 1) {
    const y = height * (.045 + index * .047);
    ctx.beginPath();
    ctx.moveTo(width * .026, y);
    ctx.lineTo(width * .974, y);
    ctx.stroke();
  }
  for (let index = 0; index < 54; index += 1) {
    const x = width * (.026 + index * .018);
    ctx.beginPath();
    ctx.moveTo(x, height * .04);
    ctx.lineTo(x, height * .96);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 820; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = .0035 + ((index * 17) % 23) / 2100;
    ctx.fillStyle = `rgba(255, 156, 114, ${alpha})`;
    ctx.fillRect(x, y, .72, .72);
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
      ctx.strokeStyle = `rgba(150, 168, 181, ${.012 + offset * .014})`;
      ctx.lineWidth = .5;
      drawSmoothPath(route.points);
    });
  });
}

function drawCadenceWitness(route, record, index) {
  if (blind) return;
  const phraseStart = pointToCanvas(route.points[record.phraseStart]);
  const phraseEnd = pointToCanvas(route.points[record.phraseEnd]);
  const relayEnd = pointToCanvas(route.points[record.relayEnd]);
  const active = record.id === latestVisitorId || record.id === selectedCadenceId;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = active ? 'rgba(255, 156, 114, .58)' : 'rgba(190, 228, 202, .22)';
  ctx.lineWidth = active ? 2.4 : .75;
  ctx.setLineDash(active ? [] : [2, 4]);
  ctx.beginPath();
  ctx.moveTo(phraseStart.x, phraseStart.y);
  ctx.lineTo(phraseEnd.x, phraseEnd.y);
  ctx.lineTo(relayEnd.x, relayEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = index % 2 ? colors.cold : colors.accent;
  ctx.lineWidth = active ? 1.2 : .7;
  ctx.globalAlpha = active ? .76 : .42;
  ctx.beginPath();
  ctx.arc(phraseStart.x, phraseStart.y, active ? 8 : 3.2, 0, Math.PI * 2);
  ctx.arc(relayEnd.x, relayEnd.y, active ? 7 : 3.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRelayTrace(route, record, index) {
  if (blind) return;
  const active = record.id === latestVisitorId || record.id === selectedCadenceId;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = index % 2 ? 'rgba(139, 208, 213, .32)' : 'rgba(255, 156, 114, .25)';
  ctx.lineWidth = active ? 1.5 : .62;
  drawSmoothPath(route.points, record.phraseStart, record.settleEnd);
  ctx.restore();
}

function drawCurrentRoute(route, index) {
  const relayed = route.cadenceHistory.length > 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(243, 237, 223, ${relayed ? .9 : .24 + (index % 3) * .055})`;
  ctx.lineWidth = relayed ? 1.04 + route.weight * .38 : .56 + route.weight * .18;
  drawSmoothPath(route.points);
  ctx.restore();
  route.cadenceHistory.forEach((record, recordIndex) => {
    drawRelayTrace(route, record, recordIndex);
    drawCadenceWitness(route, record, recordIndex);
  });
}

function drawMemory() {
  if (blind) return;
  frameState.cadences.forEach((event, index) => {
    if (!event.relayed) return;
    const point = pointToCanvas(event.point);
    const active = event.id === selectedCadenceId || event.id === latestVisitorId;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = active ? colors.accent : `rgba(139, 208, 213, ${.2 + index * .03})`;
    ctx.lineWidth = active ? 1.35 : .65;
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

  const relayed = frameState.routes.filter((route) => route.cadenceHistory.length > 0).length;
  const maxShift = frameState.cadences.reduce((max, event) => Math.max(max, event.maxCadenceShift), 0);
  drawLabel(`CADENCE RELAY / ${String(stage).padStart(2, '0')}`, width * .04, height * .07, colors.ink);
  drawLabel(latestVisitorId ? 'VISITOR HANDOFF / CADENCE PASSED' : 'MEMORY ACTIVE / CADENCE TRAVELS', width * .96, height * .07, latestVisitorId ? colors.accent : colors.signal, 'right');
  drawLabel(`${relayed} ROUTES IN RELAY · ${frameState.memory.length} HANDOFFS REMEMBERED · MAX SHIFT ${maxShift.toFixed(3)}`, width * .04, height * .93, colors.ghost);
  if (interactive && !staticPreview) drawLabel('CLICK TO PASS · TAB TO ACTIONS · SPACE TO PASS', width * .96, height * .93, colors.ghost, 'right');

  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      selectedCadenceId = frameState.memory.at(-1)?.id ?? null;
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
  frameState = applyCadence(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedCadenceId = latestVisitorId;
  paused = true;
  updateState('The routes passed one another; every exit now carries a borrowed cadence.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = removeLatestCadence(frameState);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedCadenceId = latestVisitorId;
  paused = true;
  updateState('The latest handoff lifted; the earlier sentence is exact again.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  latestVisitorId = null;
  selectedCadenceId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is moving; its routes are separate again.');
  updateButtons();
  drawFrame(startedAt);
  animationFrame = window.requestAnimationFrame(drawFrame);
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v013-cadence-relay.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
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
  if (event.key.toLowerCase() === 'p') {
    paused = !paused;
    if (!paused) {
      startedAt = performance.now() - frameState.stage * STAGE_MS;
      animationFrame = window.requestAnimationFrame(drawFrame);
    }
    updateState(paused ? 'Timeline paused; the cadence is held.' : 'Timeline moving; the next handoff is latent.');
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
placeButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', resize);

window.__mutineHandwritingV013 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((event) => ({ ...event })),
    relayedRoutes: frameState.routes.filter((route) => route.cadenceHistory.length > 0).length,
    maxCadenceShift: frameState.cadences.reduce((max, event) => Math.max(max, event.maxCadenceShift), 0),
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
