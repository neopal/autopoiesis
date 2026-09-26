import {
  BANDS,
  SEGMENTS,
  STAGES,
  advanceTurn,
  buildTimeline,
  defaultCue,
  geometrySignature,
  liftLatestTurn,
  releaseTurns
} from './engine.mjs';

const canvas = document.querySelector('#field');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const gpuAvailable = Boolean(navigator.gpu);
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  pointer: { x: 0.5, y: 0.5 },
  dragging: false,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#080916',
  ground2: '#11142a',
  ink: '#eef2ff',
  muted: '#8e94b5',
  cyan: '#77e1d0',
  lilac: '#b3a4ff',
  coral: '#f18f79',
  sun: '#f3c36d',
  blue: '#6585db'
};

const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.73137) * 43758.5453;
  return raw - Math.floor(raw);
};

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
  canvas.width = Math.floor(state.view.width * dpr);
  canvas.height = Math.floor(state.view.height * dpr);
  render(performance.now());
};

const bandY = (band, height) => height * (0.17 + band * 0.092);
const segmentBounds = (slot, width) => ({
  left: width * (0.045 + slot / SEGMENTS * 0.91),
  right: width * (0.045 + (slot + 1) / SEGMENTS * 0.91)
});

const drawBackground = (width, height) => {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.28, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
  gradient.addColorStop(0, PALETTE.ground2);
  gradient.addColorStop(0.5, PALETTE.ground);
  gradient.addColorStop(1, '#04050d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = blindMode ? 0.1 : 0.18;
  for (let index = 0; index < 170; index += 1) {
    const x = hash(index * 2.3) * width;
    const y = hash(index * 4.1 + 7) * height;
    const radius = 0.25 + hash(index * 3.7) * 1.15;
    ctx.fillStyle = index % 3 === 0 ? PALETTE.cyan : PALETTE.lilac;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawAtmosphere = (width, height, time) => {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 1;
  for (let band = 0; band < BANDS; band += 1) {
    const y = bandY(band, height) + height * 0.046;
    ctx.beginPath();
    ctx.moveTo(width * 0.035, y);
    for (let x = width * 0.035; x <= width * 0.965; x += width / 16) {
      const wobble = Math.sin(x * 0.004 + band * 0.8 + time * 0.00018) * 2.2;
      ctx.lineTo(x, y + wobble);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const fillFor = (segment, band) => {
  if (segment.relay > 0) return band % 2 ? PALETTE.coral : PALETTE.sun;
  const colors = [PALETTE.cyan, PALETTE.lilac, PALETTE.blue, '#8ed7e6'];
  return colors[(band + segment.homeSlot) % colors.length];
};

const drawSegment = (segment, width, height, time) => {
  const bounds = segmentBounds(segment.slot, width);
  const y = bandY(segment.band, height);
  const heightBase = height * (0.064 + segment.tension * 0.004);
  const phase = segment.phase + time * 0.00012 * (segment.relay ? 0.22 : 1);
  const wave = Math.sin(phase + segment.homeSlot * 0.52) * height * 0.006;
  const left = bounds.left + width * 0.004;
  const right = bounds.right - width * 0.008;
  const top = y + wave - heightBase * 0.5;
  const bottom = y + wave + heightBase * 0.5;
  const radius = Math.min(18, heightBase * 0.28);
  const color = fillFor(segment, segment.band);
  const alpha = segment.relay ? 0.92 : 0.58 + segment.band * 0.025;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.quadraticCurveTo((left + right) * 0.5, top - wave * 0.55, right - radius, top + height * 0.004);
  ctx.quadraticCurveTo(right, top + heightBase * 0.18, right, top + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo((left + right) * 0.5, bottom + wave * 0.55, left + radius, bottom - height * 0.004);
  ctx.quadraticCurveTo(left, bottom - heightBase * 0.18, left, bottom - radius);
  ctx.lineTo(left, top + radius);
  ctx.quadraticCurveTo(left, top, left + radius, top);
  ctx.fill();

  ctx.globalAlpha = segment.relay ? 0.72 : 0.2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = segment.relay ? 1.4 : 0.7;
  ctx.beginPath();
  ctx.moveTo(left + 5, top + heightBase * 0.28);
  ctx.quadraticCurveTo((left + right) * 0.52, y + wave, right - 8, bottom - heightBase * 0.24);
  ctx.stroke();

  ctx.globalAlpha = segment.relay ? 0.34 : 0.16;
  ctx.strokeStyle = PALETTE.ground;
  for (let mark = 0; mark < 3; mark += 1) {
    const x = left + (right - left) * (0.22 + mark * 0.24);
    ctx.beginPath();
    ctx.moveTo(x, top + heightBase * 0.18);
    ctx.lineTo(x + Math.sin(phase + mark) * 4, bottom - heightBase * 0.2);
    ctx.stroke();
  }
  ctx.restore();
};

const drawGap = (gap, width, height) => {
  const bounds = segmentBounds(gap.slot, width);
  const y = bandY(gap.band, height);
  const gapHeight = height * 0.075;
  const left = bounds.left + width * 0.006;
  const right = bounds.right - width * 0.012;
  ctx.save();
  ctx.fillStyle = 'rgba(5, 6, 16, .92)';
  ctx.fillRect(left, y - gapHeight * 0.58, right - left, gapHeight * 1.16);
  ctx.strokeStyle = PALETTE.coral;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left, y - gapHeight * 0.46);
  ctx.lineTo(right, y - gapHeight * 0.46);
  ctx.moveTo(left, y + gapHeight * 0.46);
  ctx.lineTo(right, y + gapHeight * 0.46);
  ctx.stroke();
  ctx.restore();
};

const drawDelay = (entry, width, height) => {
  const fromBounds = segmentBounds(entry.slot, width);
  const toBounds = segmentBounds(entry.slot, width);
  const fromX = (fromBounds.left + fromBounds.right) * 0.5;
  const toX = (toBounds.left + toBounds.right) * 0.5;
  const fromY = bandY(entry.band, height);
  const toY = bandY(entry.band, height);
  const destinationBand = state.frame.score.segments.find((segment) => segment.id === entry.id)?.band ?? entry.band;
  const destinationY = bandY(destinationBand, height);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = PALETTE.sun;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(fromX + width * 0.04, fromY + (destinationY - fromY) * 0.34, toX - width * 0.04, destinationY - (destinationY - fromY) * 0.2, toX, destinationY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(toX, destinationY, 2.5 + entry.lag * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawScore = (width, height, time) => {
  const ordered = [...state.frame.score.segments].sort((a, b) => a.band - b.band || a.slot - b.slot || a.id - b.id);
  for (const segment of ordered) drawSegment(segment, width, height, time);
  for (const gap of state.frame.score.removedSegments) drawGap(gap, width, height);
  for (const entry of state.frame.score.delayedSegments) drawDelay(entry, width, height);
};

const updateReadout = () => {
  stageElement.textContent = `stage ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'turn' : 'turns'}`;
  rendererElement.textContent = gpuAvailable ? 'WEBGPU READY / TEMPORAL FALLBACK' : 'CANVAS / TEMPORAL FALLBACK';
  if (statusElement) statusElement.textContent = state.frame.memory.length ? 'cohort deferred' : 'score awaiting a turn';
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(width, height);
  drawAtmosphere(width, height, now);
  drawScore(width, height, now);
  updateReadout();
};

const commitTurn = (cue = defaultCue()) => {
  const next = advanceTurn(state.frame, cue);
  if (next !== state.frame) {
    state.frame = next;
    render();
  }
};
const lift = () => { state.frame = liftLatestTurn(state.frame); render(); };
const release = () => { state.frame = releaseTurns(); render(); };

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  state.dragging = true;
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  state.pointer = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  if (state.dragging && !blindMode) render();
});
canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  state.dragging = false;
  canvas.releasePointerCapture?.(event.pointerId);
  render();
});
canvas.addEventListener('pointercancel', () => { state.dragging = false; render(); });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitTurn();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

document.querySelector('[data-gesture="advance"]').addEventListener('click', () => commitTurn());
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__MUTINE_STATE__ = {
  get frame() { return state.frame; },
  get signature() { return geometrySignature(state.frame); },
  advance: commitTurn,
  lift,
  release,
  pointer: () => ({ ...state.pointer })
};

resize();
window.__MUTINE_READY__ = true;

const animate = (now) => {
  render(now);
  window.requestAnimationFrame(animate);
};
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
