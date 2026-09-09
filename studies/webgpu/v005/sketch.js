import {
  STAGES,
  applyIndex,
  buildTimeline,
  deleteIndex
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const indexControl = document.querySelector('[data-gesture="index"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2800;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || location.search.includes('interaction=1') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1';
const encodedStaticPreview = location.search.includes('static=1');
const staticMode = staticPreview || encodedStaticPreview || location.hash === '#static';
const blindMode = params.has('blind') || location.hash === '#blind' || document.documentElement.classList.contains('blind-mode');
const frozen = reducedMotion || staticMode;

let started = performance.now();
let currentStage = frozen ? timeline.length - 1 : 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;
let rendererLabel = 'CANVAS / GPU CHECKING';

const palette = {
  deep: '#060c0d',
  night: '#101b1b',
  grid: '#496c68',
  ink: '#e8eee5',
  teal: '#72d2bd',
  aqua: '#8bd8d1',
  amber: '#e6b978',
  rust: '#d97f69',
  fog: '#9bb8b0'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const xPx = (value) => value * VIEW_WIDTH;
const yPx = (value) => value * VIEW_HEIGHT;

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = Math.max(1, bounds.width);
  const cssHeight = Math.max(1, bounds.height);
  canvas.width = Math.floor(cssWidth * density);
  canvas.height = Math.floor(cssHeight * density);
  context.setTransform(density * cssWidth / VIEW_WIDTH, 0, 0, density * cssHeight / VIEW_HEIGHT, 0, 0);
  renderCurrent();
}

function drawAtmosphere(stage) {
  context.fillStyle = palette.deep;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const wash = context.createRadialGradient(584, 360, 22, 610, 410, 810);
  wash.addColorStop(0, '#314845');
  wash.addColorStop(0.28, '#1e3231');
  wash.addColorStop(0.7, '#101b1b');
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.42;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.62;
  for (let x = 30; x < VIEW_WIDTH; x += 40) {
    context.beginPath();
    context.moveTo(x, 35);
    for (let y = 35; y < VIEW_HEIGHT - 38; y += 31) {
      const drift = Math.sin(stage * 0.13 + x * 0.011 + y * 0.006) * (2.4 + y / 300);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 38; y < VIEW_HEIGHT - 35; y += 41) {
    context.beginPath();
    context.moveTo(24, y);
    for (let x = 24; x < VIEW_WIDTH - 22; x += 34) {
      const drift = Math.cos(stage * 0.09 + y * 0.014 + x * 0.005) * 3;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.34;
  context.fillStyle = palette.fog;
  for (let index = 0; index < 150; index += 1) {
    const x = 20 + ((index * 181 + stage * 17) % 1160);
    const y = 46 + ((index * 79 + stage * 23) % 704);
    const length = 2 + (index % 4) * 1.7;
    context.fillRect(x, y, length, 0.65);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = palette.amber;
  context.lineWidth = 1;
  context.setLineDash([2, 16]);
  context.beginPath();
  context.ellipse(592, 414, 478, 286, -0.04, Math.PI * 0.06, Math.PI * 1.88);
  context.stroke();
  context.restore();
}

function drawArchiveCuts(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const x = xPx(record.point.x);
    const y = yPx(record.point.y);
    const extent = (0.07 + record.affectedAgents / 2600) * VIEW_HEIGHT;
    const color = record.turn > 0 ? palette.amber : palette.rust;

    context.save();
    context.globalAlpha = 0.2 + index * 0.025;
    context.strokeStyle = color;
    context.lineWidth = 1.15;
    context.setLineDash([8, 13]);
    context.beginPath();
    context.moveTo(x, Math.max(48, y - extent));
    context.bezierCurveTo(x + record.turn * 20, y - 28, x - record.turn * 18, y + 34, x + record.turn * 7, Math.min(VIEW_HEIGHT - 45, y + extent));
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.68;
    context.beginPath();
    context.moveTo(x - 7, y);
    context.lineTo(x + 7, y);
    context.moveTo(x, y - 7);
    context.lineTo(x, y + 7);
    context.stroke();
    context.fillStyle = color;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`IDX ${String(index + 1).padStart(2, '0')} / ${record.turn > 0 ? '+' : '−'}`, x + 12, y - 12);
    context.restore();
  });
}

function rowPath(frame, row) {
  context.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const agent = frame.agents[row * COLUMNS + column];
    if (column === 0) context.moveTo(xPx(agent.x), yPx(agent.y));
    else context.lineTo(xPx(agent.x), yPx(agent.y));
  }
}

function drawReindexRibbons(frame) {
  const selectedRows = [0, 2, 5, 8, 11, 14];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    rowPath(frame, row);
    const color = index % 3 === 0 ? palette.aqua : index % 3 === 1 ? palette.teal : palette.amber;
    context.strokeStyle = color;
    context.globalAlpha = 0.2 + (index % 2) * 0.08;
    context.lineWidth = index % 2 ? 7 : 11;
    context.shadowBlur = 18;
    context.shadowColor = color;
    context.stroke();

    rowPath(frame, row);
    context.globalAlpha = 0.74;
    context.lineWidth = 0.92;
    context.shadowBlur = 0;
    context.strokeStyle = palette.ink;
    context.stroke();
  });
  context.restore();
}

function drawRankThreads(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineWidth = 0.8;
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 2; column < COLUMNS; column += 3) {
      const agent = frame.agents[row * COLUMNS + column];
      if (agent.indexDebt < 0.035) continue;
      const x = xPx(agent.x);
      const y = yPx(agent.y);
      const originX = xPx(agent.originX);
      const originY = yPx(agent.originY);
      const color = agent.phaseSlip >= 0 ? palette.amber : palette.rust;
      context.globalAlpha = Math.min(0.32, 0.06 + agent.indexDebt * 0.16);
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(originX, originY);
      context.bezierCurveTo(originX + 26, originY, x - 24, y, x, y);
      context.stroke();
    }
  }
  context.restore();
}

function drawAgents(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const agent of frame.agents) {
    const x = xPx(agent.x);
    const y = yPx(agent.y);
    const color = agent.indexDebt > 0.055
      ? palette.amber
      : agent.layer === 'signal'
        ? palette.ink
        : agent.layer === 'body'
          ? palette.teal
          : palette.aqua;
    const alpha = agent.layer === 'signal' ? 0.94 : agent.layer === 'body' ? 0.64 : 0.3;
    const size = agent.size * (agent.layer === 'signal' ? 2.1 : agent.layer === 'body' ? 1.35 : 1);

    context.shadowBlur = agent.layer === 'signal' ? 7 : agent.indexDebt > 0.055 ? 5 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, agent.indexDebt * 0.18);
    if (agent.layer === 'signal') {
      context.globalAlpha = 0.2;
      context.beginPath();
      context.arc(x, y, size * 2.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha + Math.min(0.22, agent.indexDebt * 0.18);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-index'
    ? 'VISITOR INDEX / RANK SLIP INSERTED'
    : state === 'index-lifted'
      ? 'LATEST INDEX LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.72;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.amber;
  context.fillText(`${frame.aggregate.reindexedAgents} RE-INDEXED / ${frame.aggregate.indexShear.toFixed(2)} SHEAR`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.44;
  context.fillStyle = palette.fog;
  context.fillText('INDEX FIELD // 480 AGENTS // POINTER = RANK SLIP', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${frame.memory.length} INDEX${frame.memory.length === 1 ? '' : 'ES'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawArchiveCuts(frame);
  drawReindexRibbons(frame);
  drawRankThreads(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-index'
    ? 'visitor index / paused'
    : state === 'index-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} index${frame.memory.length === 1 ? '' : 'es'}`;
  rendererReadout.textContent = rendererLabel;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction);
    return;
  }
  const frame = frozen ? timeline.at(-1) : frameAt(now);
  if (frame.stage !== lastRenderedStage || frozen) {
    lastRenderedStage = frame.stage;
    render(frame);
  }
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, 0.08, 0.92),
    y: clamp((event.clientY - bounds.top) / bounds.height, 0.08, 0.92)
  };
}

function insertIndex(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyIndex(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteIndex(base);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function releaseCensus() {
  if (staticMode) return;
  interactionFrame = null;
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  paused = frozen;
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  insertIndex(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    insertIndex({ x: 0.63, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

indexControl.addEventListener('click', () => insertIndex({ x: 0.63, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCensus);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / INDEX FIELD' : 'CANVAS / INDEX HELD';
  } catch {
    rendererLabel = 'CANVAS / INDEX HELD';
  }
  renderCurrent();
}

function animationFrame(now) {
  if (!paused && !frozen) renderCurrent(now);
  if (!frozen) requestAnimationFrame(animationFrame);
}

resizeCanvas();
detectWebGPU();
if (!frozen) requestAnimationFrame(animationFrame);
