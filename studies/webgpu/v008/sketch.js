import {
  STAGES,
  applyEcho,
  buildTimeline,
  deleteEcho
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const echoControl = document.querySelector('[data-gesture="echo"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2600;
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
let rendererLabel = 'CANVAS / RELAY FIELD CHECKING';

const palette = {
  void: '#0a0b0f',
  graphite: '#181820',
  grid: '#565b67',
  ink: '#f2eadb',
  lilac: '#c3b5da',
  ice: '#a8d7d2',
  copper: '#e3a16d',
  ember: '#ca7167',
  smoke: '#96919c'
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

  const wash = context.createRadialGradient(650, 390, 18, 610, 400, 850);
  wash.addColorStop(0, '#3b313d');
  wash.addColorStop(0.2, '#27232d');
  wash.addColorStop(0.62, '#14151c');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.26;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.58;
  for (let x = 24; x < VIEW_WIDTH; x += 38) {
    context.beginPath();
    context.moveTo(x, 30);
    for (let y = 32; y < VIEW_HEIGHT - 32; y += 28) {
      const drift = Math.sin(stage * 0.15 + x * 0.011 + y * 0.004) * (1.8 + y / 380);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 46; y < VIEW_HEIGHT - 38; y += 43) {
    context.beginPath();
    context.moveTo(24, y);
    for (let x = 26; x < VIEW_WIDTH - 24; x += 32) {
      const drift = Math.cos(stage * 0.1 + y * 0.015 + x * 0.006) * 2.1;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.28;
  context.fillStyle = palette.smoke;
  for (let index = 0; index < 190; index += 1) {
    const x = 16 + ((index * 173 + stage * 23) % 1168);
    const y = 42 + ((index * 83 + stage * 17) % 706);
    context.fillRect(x, y, 1.3 + (index % 5) * 1.3, 0.8);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.14;
  context.strokeStyle = palette.copper;
  context.lineWidth = 1;
  context.setLineDash([2, 20]);
  context.beginPath();
  context.ellipse(610, 402, 484, 282, -0.05, 0.08, Math.PI * 1.9);
  context.stroke();
  context.restore();
}

function drawEchoWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const pointX = xPx(record.point.x);
    const pointY = yPx(record.point.y);
    const splitX = xPx(record.route.split.x);
    const splitY = yPx(record.route.split.y);
    const relayX = xPx(record.route.relay.x);
    const relayY = yPx(record.route.relay.y);
    const echoX = xPx(record.route.echo.x);
    const echoY = yPx(record.route.echo.y);
    const color = record.turn > 0 ? palette.copper : palette.ember;

    context.save();
    context.globalAlpha = 0.18 + index * 0.035;
    context.strokeStyle = color;
    context.lineWidth = 1.02;
    context.setLineDash([6, 15]);
    context.beginPath();
    context.moveTo(pointX, pointY);
    context.bezierCurveTo(pointX + 20, pointY - 22, splitX - 24, splitY, splitX, splitY);
    context.bezierCurveTo(splitX + 54, splitY + record.turn * 22, relayX - 28, relayY - record.turn * 18, relayX, relayY);
    context.bezierCurveTo(relayX + 44, relayY + record.turn * 18, echoX - 34, echoY, echoX, echoY);
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
    context.fillText(`ECHO ${String(index + 1).padStart(2, '0')} / ${record.turn > 0 ? '↗' : '↘'}`, pointX + 12, pointY - 12);
    context.globalAlpha = 0.55;
    context.beginPath();
    context.arc(echoX, echoY, 3.2 + index * 0.7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function rowPath(frame, row, offset = 0) {
  context.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const agent = frame.agents[row * COLUMNS + column];
    const y = yPx(agent.y + (agent.echoOffset * offset));
    if (column === 0) context.moveTo(xPx(agent.x), y);
    else context.lineTo(xPx(agent.x), y);
  }
}

function drawStrata(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let row = 0; row < ROWS; row += 1) {
    rowPath(frame, row);
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const echo = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.echoOffset), 0) / COLUMNS;
    const relay = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.relayOffset), 0) / COLUMNS;
    context.strokeStyle = echo > 0.025
      ? (row % 2 ? palette.copper : palette.ice)
      : relay > 0.018
        ? palette.lilac
        : palette.ink;
    context.globalAlpha = 0.13 + (row % 3 === 0 ? 0.055 : 0) + Math.min(0.16, echo * 0.7);
    context.lineWidth = 0.72 + (row % 3 === 0 ? 1.18 : 0) + Math.min(1.8, echo * 12);
    context.stroke();
  }
  context.restore();
}

function drawEchoBands(frame) {
  const selectedRows = [0, 2, 4, 7, 9, 11, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    const rowAgents = frame.agents.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const echo = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.echoOffset), 0) / COLUMNS;
    rowPath(frame, row, 0.82);
    context.strokeStyle = index % 2 ? palette.copper : palette.ice;
    context.globalAlpha = 0.12 + Math.min(0.2, echo * 1.5);
    context.lineWidth = 2.2 + Math.min(5.6, echo * 30);
    context.shadowBlur = 10;
    context.shadowColor = context.strokeStyle;
    context.stroke();
    rowPath(frame, row, 0.82);
    context.globalAlpha = 0.55 + Math.min(0.25, echo * 1.3);
    context.lineWidth = 0.8;
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
    const echo = Math.abs(agent.echoOffset);
    const color = echo > 0.035
      ? palette.copper
      : Math.abs(agent.relayOffset) > 0.04
        ? palette.ice
        : agent.layer === 'signal'
          ? palette.ink
          : agent.layer === 'body'
            ? palette.lilac
            : palette.smoke;
    const alpha = agent.layer === 'signal' ? 0.9 : agent.layer === 'body' ? 0.56 : 0.24;
    const size = agent.size * (agent.layer === 'signal' ? 2.1 : agent.layer === 'body' ? 1.24 : 1);
    context.shadowBlur = agent.layer === 'signal' || echo > 0.035 ? 7 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, echo * 1.5);
    if (agent.layer === 'signal' && echo > 0.02) {
      context.globalAlpha = 0.22;
      context.fillRect(x - size * 1.7, y - size * 0.5, size * 1.4, size);
      context.globalAlpha = alpha + Math.min(0.22, echo * 1.5);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-echo'
    ? 'VISITOR ABSENCE / DELAYED ECHO HELD'
    : state === 'echo-lifted'
      ? 'LATEST ECHO LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.72;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.copper;
  context.fillText(`${frame.aggregate.echoAgents} ECHO / ${frame.aggregate.echoStrength.toFixed(2)} LAG`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.42;
  context.fillStyle = palette.smoke;
  context.fillText('RELAY FIELD // 480 AGENTS // POINTER = LEAVE AN ECHO', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.ember;
  context.fillText(`${frame.memory.length} ECHO${frame.memory.length === 1 ? '' : 'ES'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawEchoWitnesses(frame);
  drawStrata(frame);
  drawEchoBands(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-echo'
    ? 'visitor echo / paused'
    : state === 'echo-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} echo${frame.memory.length === 1 ? '' : 'es'}`;
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

function leaveEcho(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyEcho(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteEcho(base);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function releaseEcho() {
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
  leaveEcho(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    leaveEcho({ x: 0.58, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

echoControl.addEventListener('click', () => leaveEcho({ x: 0.58, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseEcho);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / RELAY FIELD' : 'CANVAS / RELAY HELD';
  } catch {
    rendererLabel = 'CANVAS / RELAY HELD';
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
