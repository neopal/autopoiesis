import {
  STAGES,
  applyCensus,
  buildTimeline,
  deleteCensus
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const censusControl = document.querySelector('[data-gesture="census"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2650;
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
let rendererLabel = 'CANVAS / FIELD CHECKING';

const palette = {
  void: '#0b0b10',
  graphite: '#171720',
  grid: '#534c59',
  ink: '#f1e8da',
  lilac: '#c4b6da',
  ice: '#abd4d4',
  copper: '#e0a070',
  ember: '#c97566',
  smoke: '#968e9f'
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

  const wash = context.createRadialGradient(620, 390, 14, 610, 400, 850);
  wash.addColorStop(0, '#3a313f');
  wash.addColorStop(0.22, '#28232e');
  wash.addColorStop(0.62, '#15151d');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.27;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.58;
  for (let x = 24; x < VIEW_WIDTH; x += 38) {
    context.beginPath();
    context.moveTo(x, 30);
    for (let y = 32; y < VIEW_HEIGHT - 32; y += 28) {
      const drift = Math.sin(stage * 0.13 + x * 0.011 + y * 0.004) * (1.8 + y / 380);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 46; y < VIEW_HEIGHT - 38; y += 43) {
    context.beginPath();
    context.moveTo(24, y);
    for (let x = 26; x < VIEW_WIDTH - 24; x += 32) {
      const drift = Math.cos(stage * 0.09 + y * 0.015 + x * 0.006) * 2.1;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.28;
  context.fillStyle = palette.smoke;
  for (let index = 0; index < 180; index += 1) {
    const x = 16 + ((index * 173 + stage * 23) % 1168);
    const y = 42 + ((index * 83 + stage * 17) % 706);
    context.fillRect(x, y, 1.3 + (index % 5) * 1.3, 0.8);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = palette.copper;
  context.lineWidth = 1;
  context.setLineDash([2, 20]);
  context.beginPath();
  context.ellipse(604, 402, 480, 282, -0.05, 0.08, Math.PI * 1.9);
  context.stroke();
  context.restore();
}

function drawCensusWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const pointX = xPx(record.point.x);
    const pointY = yPx(record.point.y);
    const splitX = xPx(record.route.split.x);
    const splitY = yPx(record.route.split.y);
    const rejoinX = xPx(record.route.rejoin.x);
    const rejoinY = yPx(record.route.rejoin.y);
    const wakeX = xPx(record.route.wake.x);
    const wakeY = yPx(record.route.wake.y);
    const color = record.turn > 0 ? palette.copper : palette.ember;

    context.save();
    context.globalAlpha = 0.18 + index * 0.035;
    context.strokeStyle = color;
    context.lineWidth = 1.02;
    context.setLineDash([6, 15]);
    context.beginPath();
    context.moveTo(pointX, pointY);
    context.bezierCurveTo(pointX + 20, pointY - 22, splitX - 26, splitY, splitX, splitY);
    context.bezierCurveTo(splitX + 68, splitY + record.turn * 20, rejoinX - 38, rejoinY - record.turn * 18, rejoinX, rejoinY);
    context.bezierCurveTo(rejoinX + 34, rejoinY + record.turn * 14, wakeX - 28, wakeY, wakeX, wakeY);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.8;
    context.beginPath();
    context.moveTo(pointX - 7, pointY);
    context.lineTo(pointX + 7, pointY);
    context.moveTo(pointX, pointY - 7);
    context.lineTo(pointX, pointY + 7);
    context.stroke();
    context.fillStyle = color;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`GAP ${String(index + 1).padStart(2, '0')} / ${record.turn > 0 ? '↗' : '↘'}`, pointX + 12, pointY - 12);
    context.globalAlpha = 0.52;
    context.beginPath();
    context.arc(wakeX, wakeY, 3.4 + index * 0.7, 0, Math.PI * 2);
    context.fill();
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

function drawStrata(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let row = 0; row < ROWS; row += 1) {
    rowPath(frame, row);
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const wake = rowAgents.reduce((sum, agent) => sum + agent.wakeCompression, 0) / COLUMNS;
    const paired = rowAgents[14]?.splitOffset ?? 0;
    context.strokeStyle = wake > 0.06
      ? (row % 2 ? palette.copper : palette.lilac)
      : paired >= 0 ? palette.ice : palette.lilac;
    context.globalAlpha = 0.13 + (row % 3 === 0 ? 0.055 : 0) + Math.min(0.15, wake * 0.5);
    context.lineWidth = 0.72 + (row % 3 === 0 ? 1.22 : 0) + Math.min(2.4, wake * 9);
    context.stroke();
  }
  context.restore();
}

function drawWakeBands(frame) {
  const selectedRows = [0, 2, 4, 7, 9, 11, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const wake = rowAgents.reduce((sum, agent) => sum + agent.wakeCompression, 0) / COLUMNS;
    rowPath(frame, row);
    context.strokeStyle = index % 2 ? palette.copper : palette.ice;
    context.globalAlpha = 0.1 + Math.min(0.2, wake * 0.8);
    context.lineWidth = 2.4 + Math.min(6.2, wake * 26);
    context.shadowBlur = 12;
    context.shadowColor = context.strokeStyle;
    context.stroke();
    rowPath(frame, row);
    context.globalAlpha = 0.64 + Math.min(0.2, wake * 0.5);
    context.lineWidth = 0.88;
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
    const color = agent.wakeCompression > 0.055
      ? palette.copper
      : Math.abs(agent.splitOffset) > 0.05
        ? (agent.splitOffset > 0 ? palette.copper : palette.ember)
        : agent.layer === 'signal'
          ? palette.ink
          : agent.layer === 'body'
            ? palette.ice
            : palette.lilac;
    const alpha = agent.layer === 'signal' ? 0.9 : agent.layer === 'body' ? 0.56 : 0.24;
    const size = agent.size * (agent.layer === 'signal' ? 2.1 : agent.layer === 'body' ? 1.24 : 1);
    context.shadowBlur = agent.layer === 'signal' || agent.wakeCompression > 0.055 ? 7 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, agent.wakeCompression * 0.45);
    if (agent.layer === 'signal') {
      context.globalAlpha = 0.16;
      context.beginPath();
      context.arc(x, y, size * 2.7, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha + Math.min(0.22, agent.wakeCompression * 0.45);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-census'
    ? 'VISITOR ABSENCE / SHARED WAKE HELD'
    : state === 'census-lifted'
      ? 'LATEST ABSENCE LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.72;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.copper;
  context.fillText(`${frame.aggregate.wakeAgents} WAKE / ${frame.aggregate.wakeCompression.toFixed(2)} COMPRESSION`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.42;
  context.fillStyle = palette.smoke;
  context.fillText('CENSUS FIELD // 480 AGENTS // POINTER = MARK THE GAP', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.ember;
  context.fillText(`${frame.memory.length} ABSENCE${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawCensusWitnesses(frame);
  drawStrata(frame);
  drawWakeBands(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-census'
    ? 'visitor absence / paused'
    : state === 'census-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} absence${frame.memory.length === 1 ? '' : 's'}`;
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

function markAbsence(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyCensus(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteCensus(base);
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
  markAbsence(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markAbsence({ x: 0.58, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

censusControl.addEventListener('click', () => markAbsence({ x: 0.58, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCensus);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / CENSUS FIELD' : 'CANVAS / CENSUS HELD';
  } catch {
    rendererLabel = 'CANVAS / CENSUS HELD';
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
