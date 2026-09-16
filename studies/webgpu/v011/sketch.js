import {
  STAGES,
  applyDelay,
  buildTimeline,
  deleteDelay
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const delayControl = document.querySelector('[data-gesture="delay"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2350;
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
let rendererLabel = 'CANVAS / ARRIVAL FIELD CHECKING';

const palette = {
  void: '#05080d',
  deep: '#0b1119',
  graphite: '#14212b',
  grid: '#526c78',
  ink: '#e6efe9',
  cyan: '#8bd7cf',
  ice: '#b6d7d5',
  amber: '#efbf76',
  coral: '#d97e71',
  violet: '#9e9ce4',
  smoke: '#7f9199'
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

  const wash = context.createRadialGradient(565, 390, 20, 610, 410, 920);
  wash.addColorStop(0, '#29404a');
  wash.addColorStop(0.2, '#1e303a');
  wash.addColorStop(0.58, '#101b24');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.56;
  for (let x = 18; x < VIEW_WIDTH; x += 37) {
    context.beginPath();
    context.moveTo(x, 25);
    for (let y = 25; y < VIEW_HEIGHT - 25; y += 24) {
      const drift = Math.sin(stage * 0.12 + x * 0.014 + y * 0.006) * (1.3 + y / 460);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 36; y < VIEW_HEIGHT - 30; y += 41) {
    context.beginPath();
    context.moveTo(18, y);
    for (let x = 20; x < VIEW_WIDTH - 18; x += 32) {
      const drift = Math.cos(stage * 0.08 + y * 0.015 + x * 0.005) * 2.1;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.2;
  context.fillStyle = palette.smoke;
  for (let index = 0; index < 270; index += 1) {
    const x = 14 + ((index * 181 + stage * 17) % 1172);
    const y = 32 + ((index * 89 + stage * 11) % 732);
    const size = 0.65 + (index % 5) * 0.92;
    context.fillRect(x, y, size, size * 0.62);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.13;
  context.strokeStyle = palette.cyan;
  context.lineWidth = 1;
  context.setLineDash([2, 26]);
  context.beginPath();
  context.ellipse(585, 410, 515, 290, -0.08, 0.1, Math.PI * 1.87);
  context.stroke();
  context.restore();
}

function drawDelayWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const pointX = xPx(record.point.x);
    const pointY = yPx(record.point.y);
    const entryX = xPx(record.route.entry.x);
    const entryY = yPx(record.route.entry.y);
    const holdX = xPx(record.route.hold.x);
    const holdY = yPx(record.route.hold.y);
    const releaseX = xPx(record.route.release.x);
    const releaseY = yPx(record.route.release.y);
    const echoX = xPx(record.route.echo.x);
    const echoY = yPx(record.route.echo.y);
    const color = record.turn > 0 ? palette.amber : palette.violet;

    context.save();
    context.globalAlpha = 0.14 + index * 0.026;
    context.strokeStyle = color;
    context.lineWidth = 1.1;
    context.setLineDash([4, 15]);
    context.beginPath();
    context.moveTo(pointX, pointY);
    context.bezierCurveTo(pointX + 22, pointY - 18, entryX - 18, entryY, entryX, entryY);
    context.bezierCurveTo(entryX + 38, entryY + record.turn * 20, holdX - 28, holdY - record.turn * 28, holdX, holdY);
    context.bezierCurveTo(holdX + 38, holdY - record.turn * 34, releaseX - 34, releaseY + record.turn * 28, releaseX, releaseY);
    context.bezierCurveTo(releaseX + 38, releaseY + record.turn * 24, echoX - 52, echoY, echoX, echoY);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.88;
    context.fillStyle = color;
    [
      [pointX, pointY, 3.4 + index * 0.34],
      [holdX, holdY, 2.5 + index * 0.2],
      [releaseX, releaseY, 2.3 + index * 0.18]
    ].forEach(([x, y, radius]) => {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 0.7;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`DELAY ${String(index + 1).padStart(2, '0')}`, pointX + 11, pointY - 11);
    context.restore();
  });
}

function rowPath(frame, row, holdBias = 0, releaseBias = 0, echoBias = 0) {
  context.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const agent = frame.agents[row * COLUMNS + column];
    const x = agent.x + agent.arrivalLag * holdBias + agent.echoOffset * echoBias;
    const y = agent.y + agent.holdOffset * holdBias + agent.releaseOffset * releaseBias;
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
    const hold = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.holdOffset), 0) / COLUMNS;
    const release = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.releaseOffset), 0) / COLUMNS;
    const delay = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.arrivalLag), 0) / COLUMNS;
    context.strokeStyle = hold > 0.025
      ? (row % 2 ? palette.violet : palette.amber)
      : release > 0.025
        ? palette.cyan
        : row % 3 === 0
          ? palette.ink
          : row % 3 === 1
            ? palette.ice
            : palette.smoke;
    context.globalAlpha = 0.15 + (row % 3 === 0 ? 0.07 : 0) + Math.min(0.18, delay * 1.5);
    context.lineWidth = 0.7 + (row % 3 === 0 ? 1.05 : 0) + Math.min(1.8, (hold + release) * 9);
    context.stroke();
  }
  context.restore();
}

function drawArrivalBands(frame) {
  const selectedRows = [0, 2, 4, 7, 9, 11, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const hold = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.holdOffset), 0) / COLUMNS;
    const release = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.releaseOffset), 0) / COLUMNS;
    rowPath(frame, row, 0.78, 0.34, 0.18);
    context.strokeStyle = index % 2 ? palette.coral : palette.amber;
    context.globalAlpha = 0.1 + Math.min(0.26, (hold + release) * 2.4);
    context.lineWidth = 2.4 + Math.min(5.4, (hold + release) * 25);
    context.shadowBlur = 13;
    context.shadowColor = context.strokeStyle;
    context.stroke();

    rowPath(frame, row, 0.4, 0.94, 0.42);
    context.globalAlpha = 0.58 + Math.min(0.22, release * 1.6);
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
    const held = Math.abs(agent.holdOffset);
    const released = Math.abs(agent.releaseOffset);
    const deferred = Math.abs(agent.arrivalLag);
    const color = held > 0.03
      ? (agent.layer === 'signal' ? palette.amber : palette.violet)
      : released > 0.035
        ? palette.cyan
        : deferred > 0.028
          ? palette.coral
          : agent.layer === 'signal'
            ? palette.ink
            : agent.layer === 'body'
              ? palette.ice
              : palette.smoke;
    const alpha = agent.layer === 'signal' ? 0.9 : agent.layer === 'body' ? 0.57 : 0.24;
    const size = agent.size * (agent.layer === 'signal' ? 2.12 : agent.layer === 'body' ? 1.25 : 1);
    context.shadowBlur = agent.layer === 'signal' || held > 0.03 || deferred > 0.028 ? 8 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, deferred * 2.2);
    if (deferred > 0.028) {
      context.globalAlpha = 0.19;
      context.fillRect(x - size * 4.8, y - size * 0.25, size * 3.4, size * 0.5);
      context.globalAlpha = alpha + Math.min(0.22, deferred * 2.2);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-delay'
    ? 'VISITOR DELAY / COHORT HELD'
    : state === 'delay-lifted'
      ? 'LATEST DELAY LIFTED / ARRIVAL RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.74;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.amber;
  context.fillText(`${frame.aggregate.heldAgents} HOLD / ${frame.aggregate.deferredAgents} LATE`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.45;
  context.fillStyle = palette.smoke;
  context.fillText('DEFERRED ARRIVAL FIELD // 480 AGENTS // POINTER = HOLD MASS', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.coral;
  context.fillText(`${frame.memory.length} DELAY${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawDelayWitnesses(frame);
  drawStrata(frame);
  drawArrivalBands(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-delay'
    ? 'visitor delay / paused'
    : state === 'delay-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} delay${frame.memory.length === 1 ? '' : 's'}`;
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

function markDelay(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyDelay(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteDelay(base);
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
  markDelay(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markDelay({ x: 0.59, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

delayControl.addEventListener('click', () => markDelay({ x: 0.59, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCurrent);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / ARRIVAL FIELD' : 'CANVAS / ARRIVAL HELD';
  } catch {
    rendererLabel = 'CANVAS / ARRIVAL HELD';
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
