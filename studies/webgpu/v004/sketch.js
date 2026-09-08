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
const rehearseControl = document.querySelector('[data-gesture="rehearse"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 820;
const STAGE_MS = 3200;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || document.documentElement.classList.contains('interactive-preview');
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
  deep: '#070c13',
  night: '#101b27',
  grid: '#53767e',
  ink: '#e4eee8',
  mint: '#7be0bd',
  cyan: '#80d8ed',
  coral: '#ee9278',
  gold: '#e9c77c',
  mist: '#9fb3b0'
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

  const wash = context.createRadialGradient(640, 350, 18, 620, 410, 790);
  wash.addColorStop(0, '#34474b');
  wash.addColorStop(0.34, '#1d2d38');
  wash.addColorStop(0.72, '#101b27');
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.42;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.65;
  for (let x = 26; x < VIEW_WIDTH; x += 42) {
    context.beginPath();
    context.moveTo(x, 32);
    for (let y = 32; y < VIEW_HEIGHT - 42; y += 34) {
      const bend = Math.sin(stage * 0.16 + x * 0.014 + y * 0.008) * (3 + y / 275);
      context.lineTo(x + bend, y);
    }
    context.stroke();
  }
  for (let y = 40; y < VIEW_HEIGHT - 34; y += 42) {
    context.beginPath();
    context.moveTo(24, y);
    for (let x = 24; x < VIEW_WIDTH - 24; x += 36) {
      const bend = Math.cos(stage * 0.11 + y * 0.012 + x * 0.005) * 3.5;
      context.lineTo(x, y + bend);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.38;
  context.fillStyle = palette.mist;
  for (let index = 0; index < 120; index += 1) {
    const x = 22 + ((index * 197 + stage * 13) % 1154);
    const y = 45 + ((index * 83 + stage * 19) % 714);
    const length = 2 + (index % 5) * 1.5;
    context.fillRect(x, y, length, 0.7);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.17;
  context.strokeStyle = palette.gold;
  context.lineWidth = 1.1;
  context.setLineDash([1, 13]);
  context.beginPath();
  context.ellipse(610, 410, 474, 292, -0.08, Math.PI * 0.04, Math.PI * 1.82);
  context.stroke();
  context.restore();
}

function drawEchoCohorts(frame) {
  if (blindMode) return;
  frame.archive.forEach((rehearsal, index) => {
    const x = xPx(rehearsal.point.x);
    const y = yPx(rehearsal.point.y);
    const echoX = x + 24 + index * 12;
    const echoY = y + rehearsal.gesture * 78;
    const radius = (0.06 + index * 0.009) * VIEW_HEIGHT;

    context.save();
    context.strokeStyle = index % 2 ? palette.coral : palette.gold;
    context.globalAlpha = 0.1 + index * 0.025;
    context.lineWidth = 1.1;
    context.setLineDash([7, 14]);
    context.beginPath();
    context.ellipse(echoX, echoY, radius * 1.55, radius * 0.7, rehearsal.gesture * 0.22, Math.PI * 0.1, Math.PI * 1.78);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(x - 6, y);
    context.lineTo(x + 6, y);
    context.moveTo(x, y - 6);
    context.lineTo(x, y + 6);
    context.stroke();
    context.restore();

    context.save();
    context.globalAlpha = 0.12;
    context.strokeStyle = palette.coral;
    context.lineWidth = 2.3;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + 100, y + rehearsal.gesture * 52, echoX - 30, echoY - 52, echoX, echoY);
    context.bezierCurveTo(echoX + 110, echoY + 42, 1060, echoY + rehearsal.gesture * 90, 1170, echoY + rehearsal.gesture * 118);
    context.stroke();
    context.restore();

    context.save();
    context.fillStyle = palette.coral;
    context.globalAlpha = 0.78;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`R${String(index + 1).padStart(2, '0')} / ${rehearsal.echoAgents}`, echoX + 12, echoY - 10);
    context.restore();
  });
}

function rowPath(frame, row) {
  const columns = 24;
  context.beginPath();
  for (let column = 0; column < columns; column += 1) {
    const agent = frame.agents[row * columns + column];
    if (column === 0) context.moveTo(xPx(agent.x), yPx(agent.y));
    else context.lineTo(xPx(agent.x), yPx(agent.y));
  }
}

function drawCohortRibbons(frame) {
  const selectedRows = [1, 4, 7, 10, 13, 16];
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  selectedRows.forEach((row, index) => {
    rowPath(frame, row);
    context.strokeStyle = index % 2 === 0 ? palette.cyan : palette.mint;
    context.globalAlpha = index % 2 === 0 ? 0.39 : 0.28;
    context.lineWidth = index % 2 === 0 ? 10 : 6.5;
    context.shadowBlur = 20;
    context.shadowColor = context.strokeStyle;
    context.stroke();

    rowPath(frame, row);
    context.globalAlpha = 0.68;
    context.lineWidth = 1.05;
    context.shadowBlur = 0;
    context.strokeStyle = palette.ink;
    context.stroke();
  });
  context.restore();
}

function drawReplayThreads(frame) {
  const columns = 24;
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineWidth = 0.8;
  for (let row = 0; row < frame.agents.length / columns; row += 2) {
    for (let column = 2; column < columns; column += 4) {
      const agent = frame.agents[row * columns + column];
      if (agent.rehearsalWeight < 0.06) continue;
      const x = xPx(agent.x);
      const y = yPx(agent.y);
      const beforeX = x - agent.echoPhase * 92;
      const beforeY = y - agent.echoPhase * 138;
      context.globalAlpha = Math.min(0.38, agent.rehearsalWeight * 0.56);
      context.strokeStyle = agent.echoPhase >= 0 ? palette.gold : palette.coral;
      context.beginPath();
      context.moveTo(beforeX, beforeY);
      context.lineTo(x, y);
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
    const alpha = agent.layer === 'signal' ? 0.94 : agent.layer === 'body' ? 0.67 : 0.33;
    const color = agent.rehearsalWeight > 0.06
      ? palette.gold
      : agent.layer === 'signal'
        ? palette.ink
        : agent.layer === 'body'
          ? palette.mint
          : palette.cyan;

    context.shadowBlur = agent.layer === 'signal' ? 7 : agent.layer === 'body' ? 2 : 0;
    context.shadowColor = color;
    context.fillStyle = color;
    context.globalAlpha = alpha + Math.min(0.24, agent.rehearsalWeight * 0.25);
    const size = agent.size * (agent.layer === 'signal' ? 2.2 : agent.layer === 'body' ? 1.35 : 1.05);
    if (agent.layer === 'signal') {
      context.globalAlpha = 0.24;
      context.beginPath();
      context.arc(x, y, size * 2.5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha + Math.min(0.24, agent.rehearsalWeight * 0.25);
    }
    context.fillRect(x - size * 0.52, y - size * 0.52, size, size);
  }
  context.restore();
}

function drawFrameMarks(frame, state) {
  if (blindMode) return;
  const interactionLabel = state === 'visitor-rehearsal'
    ? 'VISITOR REHEARSAL / COHORT REPEATED'
    : state === 'rehearsal-lifted'
      ? 'LATEST REHEARSAL LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  context.save();
  context.fillStyle = palette.ink;
  context.globalAlpha = 0.7;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(interactionLabel, 34, 38);
  context.textAlign = 'right';
  context.fillStyle = palette.gold;
  context.fillText(`${frame.aggregate.echoAgents} ECHO AGENTS / ${frame.aggregate.rehearsalCohesion.toFixed(2)} COHESION`, VIEW_WIDTH - 34, 38);
  context.textAlign = 'left';
  context.globalAlpha = 0.44;
  context.fillStyle = palette.mist;
  context.fillText('REHEARSAL FIELD // 432 AGENTS // POINTER = REPLAY', 34, VIEW_HEIGHT - 25);
  context.textAlign = 'right';
  context.fillStyle = palette.coral;
  context.fillText(`${frame.memory.length} REHEARSAL${frame.memory.length === 1 ? '' : 'S'}`, VIEW_WIDTH - 34, VIEW_HEIGHT - 25);
  context.restore();
}

function render(frame, state = 'sequence') {
  drawAtmosphere(frame.stage);
  drawEchoCohorts(frame);
  drawCohortRibbons(frame);
  drawReplayThreads(frame);
  drawAgents(frame);
  drawFrameMarks(frame, state);

  stageReadout.textContent = state === 'visitor-rehearsal'
    ? 'visitor rehearsal / paused'
    : state === 'rehearsal-lifted'
      ? 'latest lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} rehearsal${frame.memory.length === 1 ? '' : 's'}`;
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

function rehearse(point) {
  if (staticMode) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyCapture(base, point);
  paused = true;
  renderCurrent();
  canvas.focus({ preventScroll: true });
}

function liftLatest() {
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
  rehearse(pointerPoint(event));
});

canvas.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    rehearse({ x: 0.64, y: 0.48 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

rehearseControl.addEventListener('click', () => rehearse({ x: 0.64, y: 0.48 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCrowd);
window.addEventListener('resize', resizeCanvas, { passive: true });

async function detectWebGPU() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    rendererLabel = adapter ? 'WEBGPU READY / REHEARSAL' : 'CANVAS / REHEARSAL HELD';
  } catch {
    rendererLabel = 'CANVAS / REHEARSAL HELD';
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
