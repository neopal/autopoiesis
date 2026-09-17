import {
  STAGES,
  applyHinge,
  buildTimeline,
  deleteHinge
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const hingeControl = document.querySelector('[data-gesture="hinge"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 860;
const COLUMNS = 30;
const ROWS = 18;
const STAGE_MS = 2300;
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
let rendererLabel = 'CANVAS / HINGE FIELD CHECKING';

const palette = {
  void: '#05080d',
  deep: '#0b121b',
  graphite: '#17252d',
  grid: '#607781',
  ink: '#e6f0eb',
  cyan: '#82d8d0',
  ice: '#b8d9d7',
  amber: '#f1bd70',
  coral: '#dd8075',
  violet: '#aaa4ed',
  smoke: '#81949c'
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

  const wash = context.createRadialGradient(560, 410, 18, 600, 420, 930);
  wash.addColorStop(0, '#31494d');
  wash.addColorStop(0.18, '#20343c');
  wash.addColorStop(0.56, '#111d27');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.55;
  for (let x = 16; x < VIEW_WIDTH; x += 36) {
    context.beginPath();
    context.moveTo(x, 26);
    for (let y = 26; y < VIEW_HEIGHT - 25; y += 23) {
      const drift = Math.sin(stage * 0.105 + x * 0.014 + y * 0.006) * (1.2 + y / 490);
      context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  for (let y = 34; y < VIEW_HEIGHT - 28; y += 42) {
    context.beginPath();
    context.moveTo(18, y);
    for (let x = 18; x < VIEW_WIDTH - 18; x += 31) {
      const drift = Math.cos(stage * 0.08 + y * 0.015 + x * 0.005) * 2.3;
      context.lineTo(x, y + drift);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.2;
  context.fillStyle = palette.smoke;
  for (let index = 0; index < 340; index += 1) {
    const x = 12 + ((index * 181 + stage * 17) % 1176);
    const y = 28 + ((index * 89 + stage * 11) % 798);
    const size = 0.65 + (index % 5) * 0.82;
    context.fillRect(x, y, size, size * 0.62);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.15;
  context.strokeStyle = palette.cyan;
  context.lineWidth = 1;
  context.setLineDash([2, 28]);
  context.beginPath();
  context.ellipse(586, 420, 525, 306, -0.08, 0.12, Math.PI * 1.86);
  context.stroke();
  context.restore();
}

function drawHingeWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const point = record.point;
    const entry = record.route.entry;
    const hinge = record.route.hinge;
    const fold = record.route.fold;
    const fan = record.route.fan;
    const trace = record.route.trace;
    const color = record.turn > 0 ? palette.amber : palette.violet;
    const alpha = 0.14 + index * 0.025;

    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = 1.05 + index * 0.04;
    context.setLineDash([3, 17]);
    context.beginPath();
    context.moveTo(xPx(point.x), yPx(point.y));
    context.bezierCurveTo(xPx(point.x) + 24, yPx(point.y) - 18, xPx(entry.x) - 15, yPx(entry.y), xPx(entry.x), yPx(entry.y));
    context.bezierCurveTo(xPx(entry.x) + 28, yPx(entry.y) + record.turn * 21, xPx(hinge.x) - 25, yPx(hinge.y) - record.turn * 30, xPx(hinge.x), yPx(hinge.y));
    context.bezierCurveTo(xPx(hinge.x) + 30, yPx(hinge.y) - record.turn * 32, xPx(fold.x) - 28, yPx(fold.y) + record.turn * 28, xPx(fold.x), yPx(fold.y));
    context.bezierCurveTo(xPx(fold.x) + 34, yPx(fold.y) + record.turn * 30, xPx(fan.x) - 32, yPx(fan.y) - record.turn * 28, xPx(fan.x), yPx(fan.y));
    context.bezierCurveTo(xPx(fan.x) + 40, yPx(fan.y) - record.turn * 24, xPx(trace.x) - 48, yPx(trace.y), xPx(trace.x), yPx(trace.y));
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.82;
    context.fillStyle = color;
    [[point.x, point.y, 3.2 + index * 0.28], [hinge.x, hinge.y, 2.6 + index * 0.18], [fold.x, fold.y, 2.4 + index * 0.18], [fan.x, fan.y, 2.2 + index * 0.15]].forEach(([x, y, radius]) => {
      context.beginPath();
      context.arc(xPx(x), yPx(y), radius, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 0.68;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`HINGE ${String(index + 1).padStart(2, '0')}`, xPx(point.x) + 12, yPx(point.y) - 11);
    context.restore();
  });
}

function rowPath(frame, row, drift = 0) {
  context.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const agent = frame.agents[row * COLUMNS + column];
    const x = agent.x + agent.traceOffset * drift;
    const y = agent.y + agent.foldOffset * drift * 0.22 + agent.fanOffset * drift * 0.2;
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
    const converge = rowAgents.reduce((sum, agent) => sum + agent.convergenceOffset, 0) / COLUMNS;
    const fold = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.foldOffset), 0) / COLUMNS;
    const fan = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.fanOffset), 0) / COLUMNS;
    const trace = rowAgents.reduce((sum, agent) => sum + Math.abs(agent.traceOffset), 0) / COLUMNS;
    context.strokeStyle = fold > 0.035
      ? (row % 2 ? palette.violet : palette.amber)
      : fan > 0.035
        ? palette.cyan
        : trace > 0.018
          ? palette.coral
          : row % 3 === 0
            ? palette.ink
            : row % 3 === 1
              ? palette.ice
              : palette.smoke;
    context.globalAlpha = 0.14 + Math.min(0.24, converge * 0.7) + Math.min(0.17, trace * 1.7);
    context.lineWidth = 0.68 + (row % 3 === 0 ? 0.9 : 0) + Math.min(2.5, (fold + fan) * 12);
    context.stroke();
  }
  context.restore();
}

function drawHingeScars(frame) {
  const selectedRows = [0, 2, 5, 8, 11, 14, 17];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    rowPath(frame, row, 0.75);
    context.strokeStyle = index % 2 ? palette.coral : palette.amber;
    context.globalAlpha = 0.12 + Math.min(0.3, frame.aggregate.foldLoad / 850);
    context.lineWidth = 2.2 + Math.min(4.8, frame.aggregate.foldLoad / 105);
    context.shadowBlur = 14;
    context.shadowColor = context.strokeStyle;
    context.stroke();

    rowPath(frame, row, 0.32);
    context.globalAlpha = 0.6;
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
    const fold = Math.abs(agent.foldOffset);
    const fan = Math.abs(agent.fanOffset);
    const trace = Math.abs(agent.traceOffset);
    const color = fold > 0.035
      ? (agent.layer === 'signal' ? palette.amber : palette.violet)
      : fan > 0.04
        ? palette.cyan
        : trace > 0.025
          ? palette.coral
          : agent.layer === 'signal'
            ? palette.ink
            : agent.layer === 'body'
              ? palette.ice
              : palette.smoke;
    const alpha = agent.layer === 'signal' ? 0.9 : agent.layer === 'body' ? 0.55 : 0.22;
    const size = agent.size * (agent.layer === 'signal' ? 2.1 : agent.layer === 'body' ? 1.24 : 1);
    context.shadowBlur = agent.layer === 'signal' || fold > 0.035 || fan > 0.04 ? 8 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.24, trace * 2.4);
    if (trace > 0.025) {
      context.globalAlpha = 0.18;
      context.fillRect(x - size * 5.2, y - size * 0.24, size * 3.8, size * 0.48);
      context.globalAlpha = alpha + Math.min(0.24, trace * 2.4);
    }
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const label = state === 'visitor-hinge'
    ? 'VISITOR HINGE / ORDER FOLDED'
    : state === 'hinge-lifted'
      ? 'LATEST HINGE LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.74;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(label, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.amber;
  context.fillText(`${frame.aggregate.foldedAgents} FOLDED / ${frame.aggregate.fannedAgents} FANNED`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.45;
  context.fillStyle = palette.smoke;
  context.fillText('HINGE FIELD // 540 AGENTS // POINTER = ORDER MEMORY', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.coral;
  context.fillText(`${frame.memory.length} HINGE${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawHingeWitnesses(frame);
  drawStrata(frame);
  drawHingeScars(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-hinge'
    ? 'visitor hinge / paused'
    : state === 'hinge-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} hinge${frame.memory.length === 1 ? '' : 's'}`;
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

function markHinge(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyHinge(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteHinge(base);
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
  markHinge(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markHinge({ x: 0.59, y: 0.47 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

hingeControl.addEventListener('click', () => markHinge({ x: 0.59, y: 0.47 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCurrent);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / HINGE FIELD' : 'CANVAS / HINGE HELD';
  } catch {
    rendererLabel = 'CANVAS / HINGE HELD';
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
