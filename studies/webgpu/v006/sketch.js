import {
  STAGES,
  applyDetour,
  buildTimeline,
  deleteDetour
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const detourControl = document.querySelector('[data-gesture="detour"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const COLUMNS = 30;
const ROWS = 16;
const STAGE_MS = 2850;
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
  deep: '#050b0c',
  night: '#0d1a1a',
  grid: '#42655f',
  ink: '#e7eee7',
  teal: '#76d4c0',
  aqua: '#a0ded2',
  amber: '#efbd79',
  rust: '#d97868',
  fog: '#9dbab1'
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

  const wash = context.createRadialGradient(580, 385, 20, 610, 400, 820);
  wash.addColorStop(0, '#34504a');
  wash.addColorStop(0.25, '#1e3431');
  wash.addColorStop(0.68, '#101e1e');
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.35;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.62;
  for (let x = 28; x < VIEW_WIDTH; x += 42) {
    context.beginPath();
    context.moveTo(x, 36);
    for (let y = 36; y < VIEW_HEIGHT - 40; y += 30) {
      const drift = Math.sin(stage * 0.12 + x * 0.012 + y * 0.006) * (2.2 + y / 330);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 40; y < VIEW_HEIGHT - 36; y += 42) {
    context.beginPath();
    context.moveTo(25, y);
    for (let x = 25; x < VIEW_WIDTH - 22; x += 35) {
      const drift = Math.cos(stage * 0.08 + y * 0.013 + x * 0.005) * 2.5;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.32;
  context.fillStyle = palette.fog;
  for (let index = 0; index < 160; index += 1) {
    const x = 18 + ((index * 181 + stage * 19) % 1165);
    const y = 45 + ((index * 79 + stage * 21) % 705);
    context.fillRect(x, y, 2 + (index % 5) * 1.6, 0.7);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.13;
  context.strokeStyle = palette.amber;
  context.lineWidth = 1;
  context.setLineDash([2, 17]);
  context.beginPath();
  context.ellipse(594, 410, 480, 284, -0.04, 0.08, Math.PI * 1.88);
  context.stroke();
  context.restore();
}

function drawArchiveCuts(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const pointX = xPx(record.point.x);
    const pointY = yPx(record.point.y);
    const splitX = xPx(record.route.split.x);
    const splitY = yPx(record.route.split.y);
    const rejoinX = xPx(record.route.rejoin.x);
    const rejoinY = yPx(record.route.rejoin.y);
    const color = record.turn > 0 ? palette.amber : palette.rust;

    context.save();
    context.globalAlpha = 0.2 + index * 0.035;
    context.strokeStyle = color;
    context.lineWidth = 1.05;
    context.setLineDash([7, 15]);
    context.beginPath();
    context.moveTo(pointX, pointY);
    context.bezierCurveTo(pointX + 24, pointY - 22, splitX - 25, splitY, splitX, splitY);
    context.bezierCurveTo(splitX + 72, splitY + record.turn * 22, rejoinX - 42, rejoinY - record.turn * 20, rejoinX, rejoinY);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.7;
    context.beginPath();
    context.moveTo(pointX - 7, pointY);
    context.lineTo(pointX + 7, pointY);
    context.moveTo(pointX, pointY - 7);
    context.lineTo(pointX, pointY + 7);
    context.stroke();
    context.fillStyle = color;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`DTR ${String(index + 1).padStart(2, '0')} / ${record.turn > 0 ? '↗' : '↘'}`, pointX + 12, pointY - 12);
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
    const paired = frame.agents[row * COLUMNS + 14]?.splitOffset ?? 0;
    context.strokeStyle = paired >= 0 ? palette.teal : palette.aqua;
    context.globalAlpha = 0.12 + (row % 3 === 0 ? 0.06 : 0);
    context.lineWidth = row % 3 === 0 ? 2.1 : 0.72;
    context.stroke();
  }
  context.restore();
}

function drawBraidRibbons(frame) {
  const selectedRows = [0, 2, 4, 7, 9, 11, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    rowPath(frame, row);
    const paired = frame.agents[row * COLUMNS + 14]?.splitOffset ?? 0;
    const color = paired >= 0 ? (index % 2 ? palette.amber : palette.teal) : (index % 2 ? palette.rust : palette.aqua);
    context.strokeStyle = color;
    context.globalAlpha = 0.16 + Math.min(0.2, Math.abs(paired) * 0.7);
    context.lineWidth = 5.5 + Math.min(6, Math.abs(paired) * 25);
    context.shadowBlur = 15;
    context.shadowColor = color;
    context.stroke();

    rowPath(frame, row);
    context.globalAlpha = 0.75;
    context.lineWidth = 0.92;
    context.shadowBlur = 0;
    context.strokeStyle = palette.ink;
    context.stroke();
  });
  context.restore();
}

function drawRouteThreads(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineWidth = 0.72;
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 3; column < COLUMNS; column += 4) {
      const agent = frame.agents[row * COLUMNS + column];
      if (Math.abs(agent.splitOffset) < 0.018) continue;
      const color = agent.splitOffset >= 0 ? palette.amber : palette.rust;
      context.globalAlpha = Math.min(0.28, 0.04 + Math.abs(agent.splitOffset) * 0.52);
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(xPx(agent.originX), yPx(agent.originY));
      context.bezierCurveTo(xPx(agent.originX) + 30, yPx(agent.originY), xPx(agent.x) - 36, yPx(agent.y), xPx(agent.x), yPx(agent.y));
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
    const color = Math.abs(agent.splitOffset) > 0.05
      ? (agent.splitOffset > 0 ? palette.amber : palette.rust)
      : agent.layer === 'signal'
        ? palette.ink
        : agent.layer === 'body'
          ? palette.teal
          : palette.aqua;
    const alpha = agent.layer === 'signal' ? 0.92 : agent.layer === 'body' ? 0.58 : 0.25;
    const size = agent.size * (agent.layer === 'signal' ? 2.2 : agent.layer === 'body' ? 1.28 : 1);

    context.shadowBlur = agent.layer === 'signal' || Math.abs(agent.splitOffset) > 0.05 ? 7 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.22, Math.abs(agent.splitOffset) * 0.45);
    if (agent.layer === 'signal') {
      context.globalAlpha = 0.18;
      context.beginPath();
      context.arc(x, y, size * 2.8, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha + Math.min(0.22, Math.abs(agent.splitOffset) * 0.45);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-detour'
    ? 'VISITOR DETOUR / PAIRED ROUTES HELD'
    : state === 'detour-lifted'
      ? 'LATEST DETOUR LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.72;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.amber;
  context.fillText(`${frame.aggregate.braidedAgents} BRAIDED / ${frame.aggregate.routeSeparation.toFixed(2)} SPREAD`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.44;
  context.fillStyle = palette.fog;
  context.fillText('DETOUR FIELD // 480 AGENTS // POINTER = SECOND ROUTE', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${frame.memory.length} DETOUR${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawArchiveCuts(frame);
  drawStrata(frame);
  drawBraidRibbons(frame);
  drawRouteThreads(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-detour'
    ? 'visitor detour / paused'
    : state === 'detour-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} detour${frame.memory.length === 1 ? '' : 's'}`;
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

function insertDetour(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyDetour(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteDetour(base);
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
  insertDetour(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    insertDetour({ x: 0.61, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

detourControl.addEventListener('click', () => insertDetour({ x: 0.61, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCensus);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / DETOUR FIELD' : 'CANVAS / DETOUR HELD';
  } catch {
    rendererLabel = 'CANVAS / DETOUR HELD';
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
