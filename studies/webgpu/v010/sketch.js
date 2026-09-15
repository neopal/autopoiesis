import {
  STAGES,
  applySwitch,
  buildTimeline,
  deleteSwitch
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const switchControl = document.querySelector('[data-gesture="switch"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2400;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || location.search.includes('interaction=1') || document.documentElement.classList.contains('interactive-preview');
const staticMode = params.get('static') === '1' || location.search.includes('static=1') || location.hash === '#static';
const blindMode = params.has('blind') || location.hash === '#blind' || document.documentElement.classList.contains('blind-mode');
const frozen = reducedMotion || staticMode;

let started = performance.now();
let currentStage = frozen ? timeline.length - 1 : 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;
let rendererLabel = 'CANVAS / ORDER FIELD CHECKING';

const palette = {
  void: '#080d14',
  deep: '#10151d',
  graphite: '#182330',
  grid: '#526d7d',
  ink: '#e8f1ed',
  cyan: '#8bd8d0',
  ice: '#b4d7df',
  amber: '#e9b56d',
  coral: '#d87c78',
  violet: '#ac9be8',
  smoke: '#8295a4'
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
  context.fillStyle = palette.void;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const wash = context.createRadialGradient(570, 370, 18, 610, 410, 930);
  wash.addColorStop(0, '#29384b');
  wash.addColorStop(0.2, '#1e2c3a');
  wash.addColorStop(0.58, '#121c28');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.56;
  for (let x = 18; x < VIEW_WIDTH; x += 37) {
    context.beginPath();
    context.moveTo(x, 26);
    for (let y = 25; y < VIEW_HEIGHT - 25; y += 24) {
      const drift = Math.sin(stage * 0.13 + x * 0.014 + y * 0.006) * (1.3 + y / 440);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 38; y < VIEW_HEIGHT - 30; y += 41) {
    context.beginPath();
    context.moveTo(18, y);
    for (let x = 20; x < VIEW_WIDTH - 18; x += 32) {
      const drift = Math.cos(stage * 0.09 + y * 0.015 + x * 0.005) * 2.1;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.22;
  context.fillStyle = palette.smoke;
  for (let index = 0; index < 250; index += 1) {
    const x = 14 + ((index * 181 + stage * 17) % 1172);
    const y = 32 + ((index * 89 + stage * 11) % 732);
    const size = 0.65 + (index % 5) * 0.92;
    context.fillRect(x, y, size, size * 0.62);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.14;
  context.strokeStyle = palette.cyan;
  context.lineWidth = 1;
  context.setLineDash([2, 26]);
  context.beginPath();
  context.ellipse(590, 408, 506, 286, -0.08, 0.12, Math.PI * 1.86);
  context.stroke();
  context.restore();
}

function drawSwitchWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const pointX = xPx(record.point.x);
    const pointY = yPx(record.point.y);
    const entryX = xPx(record.route.entry.x);
    const entryY = yPx(record.route.entry.y);
    const crossX = xPx(record.route.cross.x);
    const crossY = yPx(record.route.cross.y);
    const settleX = xPx(record.route.settle.x);
    const settleY = yPx(record.route.settle.y);
    const color = record.turn > 0 ? palette.amber : palette.violet;

    context.save();
    context.globalAlpha = 0.16 + index * 0.027;
    context.strokeStyle = color;
    context.lineWidth = 1.1;
    context.setLineDash([4, 15]);
    context.beginPath();
    context.moveTo(pointX, pointY);
    context.bezierCurveTo(pointX + 28, pointY - 18, entryX - 22, entryY, entryX, entryY);
    context.bezierCurveTo(entryX + 32, entryY + record.turn * 32, crossX - 30, crossY - record.turn * 20, crossX, crossY);
    context.bezierCurveTo(crossX + 38, crossY - record.turn * 30, settleX - 44, settleY, settleX, settleY);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.9;
    context.fillStyle = color;
    context.beginPath();
    context.arc(pointX, pointY, 3.4 + index * 0.45, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(crossX, crossY, 2.4 + index * 0.24, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.72;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`SWITCH ${String(index + 1).padStart(2, '0')}`, pointX + 11, pointY - 11);
    context.restore();
  });
}

function rowPath(frame, row, crossBias = 0, settleBias = 0) {
  context.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const agent = frame.agents[row * COLUMNS + column];
    const x = agent.x + agent.entryOffset * crossBias * 0.2;
    const y = agent.y + agent.crossOffset * crossBias + agent.settleOffset * settleBias;
    if (column === 0) context.moveTo(xPx(x), yPx(y));
    else context.lineTo(xPx(x), yPx(y));
  }
}

function drawStrata(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let row = 0; row < ROWS; row += 1) {
    rowPath(frame, row);
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const cross = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.crossOffset), 0) / COLUMNS;
    const settle = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.settleOffset), 0) / COLUMNS;
    context.strokeStyle = cross > 0.026
      ? (row % 2 ? palette.coral : palette.amber)
      : settle > 0.021
        ? palette.cyan
        : row % 3 === 0
          ? palette.ink
          : row % 3 === 1
            ? palette.ice
            : palette.smoke;
    context.globalAlpha = 0.15 + (row % 3 === 0 ? 0.07 : 0) + Math.min(0.18, cross * 1.1);
    context.lineWidth = 0.7 + (row % 3 === 0 ? 1.05 : 0) + Math.min(1.9, cross * 10);
    context.stroke();
  }
  context.restore();
}

function drawExchangeBands(frame) {
  const selectedRows = [0, 2, 4, 7, 9, 11, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const crossing = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.crossOffset), 0) / COLUMNS;
    rowPath(frame, row, 0.9, 0);
    context.strokeStyle = index % 2 ? palette.coral : palette.amber;
    context.globalAlpha = 0.11 + Math.min(0.25, crossing * 2.2);
    context.lineWidth = 2.4 + Math.min(5.8, crossing * 28);
    context.shadowBlur = 13;
    context.shadowColor = context.strokeStyle;
    context.stroke();

    rowPath(frame, row, 0.62, 0.82);
    context.globalAlpha = 0.58 + Math.min(0.22, crossing * 1.5);
    context.lineWidth = 0.82;
    context.shadowBlur = 0;
    context.strokeStyle = palette.ink;
    context.stroke();
  });
  context.restore();
}

function drawAgents(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const agent of frame.agents) {
    const x = xPx(agent.x);
    const y = yPx(agent.y);
    const crossing = Math.abs(agent.crossOffset);
    const settled = Math.abs(agent.settleOffset);
    const color = crossing > 0.035
      ? (agent.layer === 'signal' ? palette.amber : palette.coral)
      : settled > 0.04
        ? palette.cyan
        : agent.layer === 'signal'
          ? palette.ink
          : agent.layer === 'body'
            ? palette.ice
            : palette.smoke;
    const alpha = agent.layer === 'signal' ? 0.9 : agent.layer === 'body' ? 0.57 : 0.24;
    const size = agent.size * (agent.layer === 'signal' ? 2.12 : agent.layer === 'body' ? 1.25 : 1);
    context.shadowBlur = agent.layer === 'signal' || crossing > 0.035 ? 8 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, crossing * 1.8);
    if (crossing > 0.026) {
      context.globalAlpha = 0.22;
      context.fillRect(x - size * 2.9, y - size * 0.26, size * 2.1, size * 0.52);
      context.globalAlpha = alpha + Math.min(0.22, crossing * 1.8);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-switch'
    ? 'VISITOR SWITCH / TWO LANES EXCHANGED'
    : state === 'switch-lifted'
      ? 'LATEST SWITCH LIFTED / ORDER RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.74;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.amber;
  context.fillText(`${frame.aggregate.crossingAgents} CROSS / ${frame.aggregate.settledAgents} SETTLE`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.45;
  context.fillStyle = palette.smoke;
  context.fillText('SWITCHED ORDER FIELD // 480 AGENTS // POINTER = EXCHANGE LANES', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.coral;
  context.fillText(`${frame.memory.length} SWITCH${frame.memory.length === 1 ? '' : 'ES'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawSwitchWitnesses(frame);
  drawStrata(frame);
  drawExchangeBands(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-switch'
    ? 'visitor switch / paused'
    : state === 'switch-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} switch${frame.memory.length === 1 ? '' : 'es'}`;
  rendererReadout.textContent = rendererLabel;
  globalThis.__MUTINE_STATE = {
    stage: frame.stage,
    memory: frame.memory.length,
    interaction: state,
    renderer: rendererLabel
  };
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

function markSwitch(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applySwitch(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteSwitch(base);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function releaseCurrent() {
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
  markSwitch(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markSwitch({ x: 0.59, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

switchControl.addEventListener('click', () => markSwitch({ x: 0.59, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCurrent);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / ORDER FIELD' : 'CANVAS / ORDER HELD';
  } catch {
    rendererLabel = 'CANVAS / ORDER HELD';
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
