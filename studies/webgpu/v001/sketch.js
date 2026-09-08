import {
  STAGES,
  applyCapture,
  buildTimeline,
  deleteCapture
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const captureControl = document.querySelector('[data-gesture="capture"]');
const deleteControl = document.querySelector('[data-gesture="delete"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 760;
const STAGE_MS = 3600;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1';
const encodedStaticPreview = location.search.includes('static=1');
const staticMode = staticPreview || encodedStaticPreview || location.hash === '#static';
const frozen = reducedMotion || staticMode;

let started = performance.now();
let currentStage = frozen ? timeline.length - 1 : 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;
let rendererLabel = 'CANVAS ARCHIVE';

const palette = {
  ground: '#071014',
  deep: '#03090d',
  grid: '#3b8c86',
  ink: '#d7f2e2',
  mint: '#65e1b0',
  cyan: '#6fd7d2',
  coral: '#f08c69',
  fog: '#75b7a8',
  darkMint: '#2a8d81'
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

function drawBackground(stage) {
  context.fillStyle = palette.deep;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const halo = context.createRadialGradient(490, 280, 24, 510, 360, 680);
  halo.addColorStop(0, '#2c6b68');
  halo.addColorStop(0.46, '#143c41');
  halo.addColorStop(1, palette.deep);
  context.fillStyle = halo;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.44;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.7;
  for (let x = 40; x < VIEW_WIDTH; x += 40) {
    context.beginPath();
    context.moveTo(x, 36);
    context.lineTo(x + Math.sin(stage * 0.17 + x) * 5, VIEW_HEIGHT - 52);
    context.stroke();
  }
  for (let y = 40; y < VIEW_HEIGHT - 34; y += 40) {
    context.beginPath();
    context.moveTo(28, y);
    context.lineTo(VIEW_WIDTH - 28, y + Math.cos(stage * 0.21 + y) * 3);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.5;
  context.fillStyle = palette.fog;
  for (let index = 0; index < 86; index += 1) {
    const x = 32 + ((index * 173 + stage * 11) % 934);
    const y = 58 + ((index * 97 + stage * 17) % 622);
    const length = 2 + (index % 4) * 1.8;
    context.fillRect(x, y, length, 0.65);
  }
  context.restore();

  context.save();
  context.strokeStyle = palette.darkMint;
  context.globalAlpha = 0.74;
  context.lineWidth = 1.2;
  context.setLineDash([2, 11]);
  context.beginPath();
  context.arc(500, 390, 290, Math.PI * 0.12, Math.PI * 0.92);
  context.stroke();
  context.restore();
}

function drawArchive(frame) {
  frame.archive.forEach((capture, index) => {
    const x = xPx(capture.point.x);
    const y = yPx(capture.point.y);
    const radius = capture.radius * VIEW_HEIGHT;
    const intensity = 0.17 + index * 0.045;

    context.save();
    context.strokeStyle = palette.coral;
    context.globalAlpha = intensity;
    context.lineWidth = 1.1;
    context.setLineDash([7, 9]);
    context.beginPath();
    context.arc(x, y, radius, Math.PI * 0.18, Math.PI * 1.78);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(x - 7, y);
    context.lineTo(x + 7, y);
    context.moveTo(x, y - 7);
    context.lineTo(x, y + 7);
    context.stroke();
    context.restore();

    context.save();
    context.strokeStyle = palette.coral;
    context.globalAlpha = 0.11 + index * 0.02;
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + capture.bend.x * 500, y + capture.bend.y * 120, 820, y + capture.bend.y * 320, 964, y + capture.bend.y * 280);
    context.stroke();
    context.restore();

    context.save();
    context.fillStyle = palette.coral;
    context.globalAlpha = 0.72;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.letterSpacing = '1px';
    context.fillText(`A${String(index + 1).padStart(2, '0')} / ${capture.affectedAgents}`, x + 12, y - 12);
    context.restore();
  });
}

function drawMesh(frame) {
  const agents = frame.agents;
  const columns = 24;
  const rows = agents.length / columns;

  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineWidth = 2.2;
  context.globalAlpha = 0.95;
  context.lineCap = 'round';
  for (let row = 0; row < rows; row += 1) {
    context.beginPath();
    for (let column = 0; column < columns; column += 1) {
      const agent = agents[row * columns + column];
      if (column === 0) context.moveTo(xPx(agent.x), yPx(agent.y));
      else context.lineTo(xPx(agent.x), yPx(agent.y));
    }
    context.strokeStyle = row % 3 === 0 ? palette.cyan : row % 3 === 1 ? palette.mint : palette.fog;
    context.stroke();
  }
  context.globalAlpha = 0.42;
  context.strokeStyle = palette.cyan;
  for (let column = 1; column < columns; column += 3) {
    context.beginPath();
    for (let row = 0; row < rows; row += 1) {
      const agent = agents[row * columns + column];
      if (row === 0) context.moveTo(xPx(agent.x), yPx(agent.y));
      else context.lineTo(xPx(agent.x), yPx(agent.y));
    }
    context.stroke();
  }
  context.restore();
}

function drawSignalRibbons(frame) {
  const columns = 24;
  const selectedRows = [1, 4, 7, 10, 13, 15];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    context.beginPath();
    for (let column = 0; column < columns; column += 1) {
      const agent = frame.agents[row * columns + column];
      if (column === 0) context.moveTo(xPx(agent.x), yPx(agent.y));
      else context.lineTo(xPx(agent.x), yPx(agent.y));
    }
    context.strokeStyle = index % 2 === 0 ? palette.cyan : palette.mint;
    context.globalAlpha = index % 2 === 0 ? 0.36 : 0.28;
    context.lineWidth = index % 2 === 0 ? 8.5 : 5.5;
    context.shadowBlur = 14;
    context.shadowColor = context.strokeStyle;
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
    const alpha = agent.layer === 'signal' ? 0.95 : agent.layer === 'body' ? 0.72 : 0.36;
    const color = agent.archiveWeight > 0.12 ? palette.coral : agent.layer === 'signal' ? palette.ink : agent.layer === 'body' ? palette.mint : palette.cyan;

    context.shadowBlur = agent.layer === 'signal' ? 5 : agent.layer === 'body' ? 2 : 0;
    context.shadowColor = color;

    if (agent.displacement > 0.025) {
      context.strokeStyle = palette.coral;
      context.globalAlpha = Math.min(0.3, agent.displacement * 3.2);
      context.lineWidth = 0.65;
      context.beginPath();
      context.moveTo(xPx(agent.originX), yPx(agent.originY));
      context.lineTo(x, y);
      context.stroke();
    }

    context.fillStyle = color;
    context.globalAlpha = alpha + agent.archiveWeight * 0.2;
    const size = agent.size * (agent.layer === 'signal' ? 2.1 : agent.layer === 'body' ? 1.35 : 1.1);
    if (agent.layer === 'signal') {
      context.beginPath();
      context.globalAlpha = 0.38;
      context.arc(x, y, size * 2.4, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha + agent.archiveWeight * 0.2;
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  const interactionLabel = state === 'visitor-capture'
    ? 'VISITOR CAPTURE / CROWD BENT'
    : state === 'capture-deleted'
      ? 'LATEST CAPTURE LIFTED / CROWD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.68;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(interactionLabel, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.mint;
  context.fillText(`${frame.aggregate.archivedAgents} MOVING / ${frame.totalDisplacement.toFixed(1)} DELTA`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.42;
  context.fillStyle = palette.fog;
  context.fillText('ARCHIVE FIELD // 384 AGENTS // POINTER = COMMIT', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.coral;
  context.fillText(`${frame.memory.length} MEMORY CHANNEL${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawBackground(frame.stage);
  drawArchive(frame);
  drawMesh(frame);
  drawSignalRibbons(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-capture'
    ? 'visitor capture / paused'
    : state === 'capture-deleted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} archived capture${frame.memory.length === 1 ? '' : 's'}`;
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

function capture(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyCapture(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function deleteLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteCapture(base);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function releaseCrowd() {
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
  capture(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    capture({ x: 0.64, y: 0.5 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteLatest();
  }
});

captureControl.addEventListener('click', () => capture({ x: 0.64, y: 0.5 }));
deleteControl.addEventListener('click', deleteLatest);
releaseControl.addEventListener('click', releaseCrowd);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / ARCHIVE' : 'CANVAS ARCHIVE / GPU HELD';
  } catch {
    rendererLabel = 'CANVAS ARCHIVE / GPU HELD';
  }
  renderCurrent();
}

function functionFrame(now) {
  if (!paused && !frozen) renderCurrent(now);
  if (!frozen) requestAnimationFrame(functionFrame);
}

resizeCanvas();
detectWebGPU();
if (!frozen) requestAnimationFrame(functionFrame);
