import {
  ANCHORS,
  BAND_COUNT,
  MEMORY_WINDOW,
  STAGES,
  buildFrame,
  buildTimeline,
  commitSlip,
  geometrySignature,
  liftLatestSlip,
  releaseSlip
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3200;
const DOUBLE_TAP_MS = 620;
const DOUBLE_TAP_DISTANCE = 96;

const field = document.querySelector('#slip-field');
const canvas = document.querySelector('#naive-field');
const ctx = canvas.getContext('2d', { alpha: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const slipControl = document.querySelector('#slip-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');

let startedAt = performance.now();
let currentFrame = timeline[0];
let interactionFrame = null;
let lastInteraction = 'sequence';
let lastTapAt = 0;
let lastTapPoint = null;
let tapTimer = null;
let armedBand = null;

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : currentFrame);
}

function setInteraction(value) {
  lastInteraction = value;
  field.dataset.interaction = value;
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.memory.length,
    memoryWindow: MEMORY_WINDOW,
    wrongLandingCount: frame.scene.trace.wrongLandingCount,
    intendedGapCount: frame.scene.trace.intendedGapCount,
    changedFutureBands: frame.scene.trace.changedFutureBands,
    routeLength: frame.scene.trace.routeLength,
    armedBand,
    interaction: interactionFrame?.interaction ?? lastInteraction,
    geometrySignature: geometrySignature(frame)
  };
}

window.__mutineNaiveV023 = { getState: stateSnapshot };
field.dataset.witness = 'wrong-landing';

if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}
if (blindMode) canvas.setAttribute('aria-label', 'A continuous painted route with an absent arrival and a distant inherited knot');

function pointFor(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function nearestBand(point) {
  if (!point) return null;
  let closest = null;
  let distance = Infinity;
  for (let index = 0; index < ANCHORS.length; index += 1) {
    const dx = point.x - ANCHORS[index].x;
    const dy = point.y - ANCHORS[index].y;
    const next = dx * dx + dy * dy;
    if (next < distance) {
      distance = next;
      closest = index % BAND_COUNT;
    }
  }
  return closest;
}

function renderFrame(frame) {
  stageReadout.textContent = `stage ${String(frame.stage).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} slip${frame.memory.length === 1 ? '' : 's'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.wrongLandings = String(frame.scene.trace.wrongLandingCount);
  field.dataset.intendedGaps = String(frame.scene.trace.intendedGapCount);
  field.dataset.changedFutureBands = String(frame.scene.trace.changedFutureBands);
  field.dataset.geometrySignature = geometrySignature(frame);
  drawScene(frame);
}

function pathFor(points, scale = 1, offsetX = 0, offsetY = 0) {
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = point.x * canvas.width * scale + offsetX;
    const y = point.y * canvas.height * scale + offsetY;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function drawStroke(stroke) {
  const width = stroke.width * canvas.width;
  pathFor(stroke.points, 1, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(32,40,59,.23)';
  ctx.lineWidth = width * 1.62;
  ctx.stroke();

  pathFor(stroke.points);
  ctx.strokeStyle = stroke.tone;
  ctx.lineWidth = width;
  ctx.stroke();

  pathFor(stroke.points);
  ctx.strokeStyle = 'rgba(255,246,222,.34)';
  ctx.lineWidth = Math.max(2, width * .12);
  ctx.stroke();

  const end = stroke.points.at(-1);
  if (stroke.slip) {
    const x = end.x * canvas.width;
    const y = end.y * canvas.height;
    ctx.save();
    ctx.strokeStyle = 'rgba(32,40,59,.64)';
    ctx.lineWidth = Math.max(2, width * .10);
    ctx.beginPath();
    ctx.arc(x, y, width * 1.05, 0.2, Math.PI * 1.72);
    ctx.stroke();
    ctx.restore();
  }
}

function drawScene(frame) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const ground = ctx.createRadialGradient(W * .48, H * .44, 18, W * .5, H * .5, W * .72);
  ground.addColorStop(0, '#faf1dd');
  ground.addColorStop(.7, '#f2e4c8');
  ground.addColorStop(1, '#e4d1ad');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  for (let index = 0; index < 180; index += 1) {
    const x = ((index * 83) % 997) / 997 * W;
    const y = ((index * 149 + 37) % 991) / 991 * H;
    const radius = 0.4 + (index % 4) * 0.35;
    ctx.fillStyle = index % 3 === 0 ? 'rgba(32,40,59,.055)' : 'rgba(255,252,237,.18)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(32,40,59,.07)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 14]);
  ctx.beginPath();
  ctx.ellipse(W * .51, H * .48, W * .34, H * .34, -.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  frame.scene.strokes.forEach(drawStroke);

  frame.scene.voids.forEach((hole) => {
    const x = hole.x * W;
    const y = hole.y * H;
    const radius = hole.radius * W;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.13, radius * .78, -.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(32,40,59,.27)';
    ctx.lineWidth = Math.max(1.5, radius * .055);
    ctx.setLineDash([radius * .20, radius * .16]);
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.18, radius * .82, -.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function clearTapWindow() {
  lastTapAt = 0;
  lastTapPoint = null;
  armedBand = null;
  field.dataset.armedBand = '';
  if (tapTimer) window.clearTimeout(tapTimer);
  tapTimer = null;
}

function commit(bandIndex = null) {
  interactionFrame = commitSlip(activeFrame(), { bandIndex });
  setInteraction('slip-committed');
  clearTapWindow();
  renderFrame(interactionFrame);
}

function refuse(reason = 'single-tap-waits') {
  setInteraction(reason);
  field.dataset.armedBand = armedBand === null ? '' : String(armedBand);
}

function undo() {
  interactionFrame = liftLatestSlip(activeFrame());
  setInteraction('slip-lifted');
  clearTapWindow();
  renderFrame(interactionFrame);
}

function release() {
  interactionFrame = releaseSlip();
  currentFrame = timeline[0];
  startedAt = performance.now();
  setInteraction('released');
  clearTapWindow();
  renderFrame(interactionFrame);
}

function saveSnapshot() {
  const blob = new Blob([JSON.stringify(stateSnapshot(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-naive-v023-wrong-landing.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function handlePointerUp(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const point = pointFor(event);
  if (!point) return;
  const now = performance.now();
  const closeEnough = lastTapPoint && Math.hypot((point.x - lastTapPoint.x) * canvas.width, (point.y - lastTapPoint.y) * canvas.height) <= DOUBLE_TAP_DISTANCE;
  if (lastTapAt && now - lastTapAt <= DOUBLE_TAP_MS && closeEnough) {
    commit(armedBand ?? nearestBand(point));
    event.preventDefault();
    return;
  }
  armedBand = nearestBand(point);
  lastTapAt = now;
  lastTapPoint = point;
  field.dataset.armedBand = String(armedBand ?? '');
  refuse('waiting-for-second-tap');
  if (tapTimer) window.clearTimeout(tapTimer);
  tapTimer = window.setTimeout(() => {
    if (lastTapAt && performance.now() - lastTapAt >= DOUBLE_TAP_MS) {
      clearTapWindow();
      refuse('tap-expired');
    }
  }, DOUBLE_TAP_MS + 20);
  event.preventDefault();
}

field.addEventListener('pointerup', handlePointerUp);
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(armedBand);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    undo();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  } else if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveSnapshot();
  }
});
slipControl.addEventListener('click', () => commit());
undoControl.addEventListener('click', undo);
releaseControl.addEventListener('click', release);

function animate(now) {
  if (!frozen && !interactionFrame) {
    currentFrame = frameAt(now);
    renderFrame(currentFrame);
  }
  window.requestAnimationFrame(animate);
}

renderFrame(activeFrame());
window.requestAnimationFrame(animate);
