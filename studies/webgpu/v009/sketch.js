import {
  STAGES,
  applyCountercurrent,
  buildTimeline,
  deleteCountercurrent
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const countercurrentControl = document.querySelector('[data-gesture="countercurrent"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2500;
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
let rendererLabel = 'CANVAS / COUNTERCURRENT FIELD CHECKING';

const palette = {
  void: '#080d0d',
  deep: '#0d1515',
  graphite: '#172424',
  grid: '#55706d',
  ink: '#e6f1e7',
  mint: '#9fe2cb',
  ice: '#b2d5d1',
  amber: '#e4a16e',
  rose: '#cf7774',
  smoke: '#829692'
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

  const wash = context.createRadialGradient(570, 350, 24, 600, 420, 900);
  wash.addColorStop(0, '#294043');
  wash.addColorStop(0.22, '#1c3030');
  wash.addColorStop(0.62, '#101b1b');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.25;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.56;
  for (let x = 20; x < VIEW_WIDTH; x += 38) {
    context.beginPath();
    context.moveTo(x, 28);
    for (let y = 28; y < VIEW_HEIGHT - 26; y += 25) {
      const drift = Math.sin(stage * 0.12 + x * 0.013 + y * 0.005) * (1.5 + y / 420);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 44; y < VIEW_HEIGHT - 35; y += 42) {
    context.beginPath();
    context.moveTo(20, y);
    for (let x = 22; x < VIEW_WIDTH - 20; x += 34) {
      const drift = Math.cos(stage * 0.08 + y * 0.014 + x * 0.005) * 2.4;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.26;
  context.fillStyle = palette.smoke;
  for (let index = 0; index < 230; index += 1) {
    const x = 14 + ((index * 181 + stage * 19) % 1172);
    const y = 38 + ((index * 89 + stage * 13) % 724);
    const size = 0.7 + (index % 4) * 1.05;
    context.fillRect(x, y, size, size * 0.65);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.13;
  context.strokeStyle = palette.mint;
  context.lineWidth = 1;
  context.setLineDash([2, 23]);
  context.beginPath();
  context.ellipse(590, 405, 500, 286, -0.07, 0.1, Math.PI * 1.87);
  context.stroke();
  context.restore();
}

function drawCountercurrentWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const pointX = xPx(record.point.x);
    const pointY = yPx(record.point.y);
    const entryX = xPx(record.route.entry.x);
    const entryY = yPx(record.route.entry.y);
    const turnX = xPx(record.route.turn.x);
    const turnY = yPx(record.route.turn.y);
    const exitX = xPx(record.route.exit.x);
    const exitY = yPx(record.route.exit.y);
    const color = record.turnSign > 0 ? palette.amber : palette.rose;

    context.save();
    context.globalAlpha = 0.18 + index * 0.032;
    context.strokeStyle = color;
    context.lineWidth = 1.06;
    context.setLineDash([5, 14]);
    context.beginPath();
    context.moveTo(pointX, pointY);
    context.bezierCurveTo(pointX + 24, pointY - 20, entryX - 24, entryY, entryX, entryY);
    context.bezierCurveTo(entryX - 20, entryY + record.turnSign * 24, turnX + 23, turnY - record.turnSign * 18, turnX, turnY);
    context.bezierCurveTo(turnX + 32, turnY + record.turnSign * 24, exitX - 35, exitY, exitX, exitY);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.9;
    context.fillStyle = color;
    context.beginPath();
    context.arc(pointX, pointY, 3.5 + index * 0.55, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(turnX - 5, turnY - 4);
    context.lineTo(turnX + 5, turnY + 4);
    context.moveTo(turnX + 5, turnY - 4);
    context.lineTo(turnX - 5, turnY + 4);
    context.stroke();
    context.globalAlpha = 0.74;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`CURRENT ${String(index + 1).padStart(2, '0')}`, pointX + 11, pointY - 11);
    context.restore();
  });
}

function rowPath(frame, row, reverseBias = 0, rejoinBias = 0) {
  context.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const agent = frame.agents[row * COLUMNS + column];
    const x = agent.x - agent.reverseOffset * reverseBias + agent.rejoinOffset * rejoinBias;
    const y = agent.y + agent.currentOffset * 0.12;
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
    const reverse = rowAgents.reduce((sum, agent) => sum + agent.reverseOffset, 0) / COLUMNS;
    const rejoin = rowAgents.reduce((sum, agent) => sum + agent.rejoinOffset, 0) / COLUMNS;
    context.strokeStyle = reverse > 0.028
      ? (row % 2 ? palette.rose : palette.amber)
      : rejoin > 0.02
        ? palette.mint
        : row % 3 === 0
          ? palette.ink
          : row % 3 === 1
            ? palette.ice
            : palette.smoke;
    context.globalAlpha = 0.15 + (row % 3 === 0 ? 0.06 : 0) + Math.min(0.18, reverse * 0.9);
    context.lineWidth = 0.7 + (row % 3 === 0 ? 1.14 : 0) + Math.min(1.9, reverse * 10);
    context.stroke();
  }
  context.restore();
}

function drawReturnBands(frame) {
  const selectedRows = [0, 2, 4, 7, 9, 11, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const reverse = rowAgents.reduce((sum, agent) => sum + agent.reverseOffset, 0) / COLUMNS;
    rowPath(frame, row, 0.8, 0);
    context.strokeStyle = index % 2 ? palette.rose : palette.amber;
    context.globalAlpha = 0.12 + Math.min(0.24, reverse * 1.8);
    context.lineWidth = 2.4 + Math.min(5.4, reverse * 28);
    context.shadowBlur = 12;
    context.shadowColor = context.strokeStyle;
    context.stroke();
    rowPath(frame, row, 0.8, 0.68);
    context.globalAlpha = 0.62 + Math.min(0.2, reverse * 1.2);
    context.lineWidth = 0.78;
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
    const reverse = agent.reverseOffset;
    const rejoin = agent.rejoinOffset;
    const color = reverse > 0.035
      ? (agent.layer === 'signal' ? palette.amber : palette.rose)
      : rejoin > 0.04
        ? palette.mint
        : agent.layer === 'signal'
          ? palette.ink
          : agent.layer === 'body'
            ? palette.ice
            : palette.smoke;
    const alpha = agent.layer === 'signal' ? 0.92 : agent.layer === 'body' ? 0.58 : 0.25;
    const size = agent.size * (agent.layer === 'signal' ? 2.1 : agent.layer === 'body' ? 1.24 : 1);
    context.shadowBlur = agent.layer === 'signal' || reverse > 0.035 ? 8 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, reverse * 1.7);
    if (reverse > 0.025) {
      context.globalAlpha = 0.24;
      context.fillRect(x + size * 1.5, y - size * 0.28, size * 1.9, size * 0.56);
      context.globalAlpha = alpha + Math.min(0.22, reverse * 1.7);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-countercurrent'
    ? 'VISITOR CURRENT / REVERSE PACKET HELD'
    : state === 'countercurrent-lifted'
      ? 'LATEST CURRENT LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.74;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.amber;
  context.fillText(`${frame.aggregate.reverseAgents} REVERSE / ${frame.aggregate.rejoinedAgents} REJOIN`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.45;
  context.fillStyle = palette.smoke;
  context.fillText('COUNTERCURRENT FIELD // 480 AGENTS // POINTER = TURN THE FLOW', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.rose;
  context.fillText(`${frame.memory.length} CURRENT${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawCountercurrentWitnesses(frame);
  drawStrata(frame);
  drawReturnBands(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-countercurrent'
    ? 'visitor current / paused'
    : state === 'countercurrent-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} countercurrent${frame.memory.length === 1 ? '' : 's'}`;
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

function markCountercurrent(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyCountercurrent(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteCountercurrent(base);
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
  markCountercurrent(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markCountercurrent({ x: 0.58, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

countercurrentControl.addEventListener('click', () => markCountercurrent({ x: 0.58, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCurrent);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / COUNTERCURRENT FIELD' : 'CANVAS / CURRENT HELD';
  } catch {
    rendererLabel = 'CANVAS / CURRENT HELD';
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
