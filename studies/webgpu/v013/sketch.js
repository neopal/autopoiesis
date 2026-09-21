import {
  STAGES,
  applyLook,
  buildTimeline,
  deleteLook,
  releaseLooks
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const lookControl = document.querySelector('[data-gesture="look"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 860;
const STAGE_MS = 2150;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || location.search.includes('interaction=1') || document.documentElement.classList.contains('interactive-preview');
const staticMode = params.get('static') === '1' || location.search.includes('static=1') || location.hash === '#static';
const blindMode = params.has('blind') || location.hash === '#blind' || document.documentElement.classList.contains('blind-mode');
const frozen = reducedMotion || staticMode;

let started = performance.now();
let currentStage = frozen ? timeline.length - 1 : 0;
let paused = frozen || interactivePreview;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastFrame = null;
let rendererLabel = navigator.gpu ? 'WEBGPU / RECIPROCAL READY' : 'CANVAS / RECIPROCAL FALLBACK';

const palette = {
  void: '#100d15',
  deep: '#17121f',
  plum: '#2a1f31',
  grid: '#6f6177',
  ink: '#f2e8d8',
  cyan: '#86ddd0',
  amber: '#efbd72',
  rose: '#df8c99',
  violet: '#bba8f2',
  smoke: '#978c9e'
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

  const wash = context.createRadialGradient(650, 340, 20, 600, 430, 900);
  wash.addColorStop(0, '#4a3151');
  wash.addColorStop(0.18, '#30233a');
  wash.addColorStop(0.54, '#1e1727');
  wash.addColorStop(1, palette.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = palette.grid;
  context.lineWidth = 0.5;
  for (let x = 28; x < VIEW_WIDTH - 20; x += 54) {
    context.beginPath();
    context.moveTo(x, 34);
    context.lineTo(x + Math.sin(stage * 0.09 + x * 0.02) * 12, VIEW_HEIGHT - 30);
    context.stroke();
  }
  for (let y = 48; y < VIEW_HEIGHT - 26; y += 58) {
    context.beginPath();
    context.moveTo(26, y + Math.cos(stage * 0.08 + y * 0.013) * 8);
    context.lineTo(VIEW_WIDTH - 24, y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.17;
  for (let index = 0; index < 420; index += 1) {
    const x = 14 + ((index * 181 + stage * 23) % 1172);
    const y = 24 + ((index * 97 + stage * 13) % 812);
    const size = 0.4 + (index % 5) * 0.68;
    context.fillStyle = index % 3 === 0 ? palette.amber : palette.smoke;
    context.fillRect(x, y, size, size);
  }
  context.restore();
}

function drawLookWitnesses(frame) {
  if (blindMode) return;
  frame.archive.forEach((record, index) => {
    const point = record.point;
    const radius = 42 + index * 8;
    const color = index % 3 === 0 ? palette.amber : index % 3 === 1 ? palette.cyan : palette.rose;
    context.save();
    context.globalAlpha = 0.15 + index * 0.025;
    context.strokeStyle = color;
    context.lineWidth = 1 + index * 0.08;
    context.setLineDash([2, 13 + index * 2]);
    context.beginPath();
    context.arc(xPx(point.x), yPx(point.y), radius, -0.8 + index * 0.2, Math.PI * 1.52 + index * 0.15);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.72;
    context.fillStyle = color;
    context.beginPath();
    context.arc(xPx(point.x), yPx(point.y), 2.4 + index * 0.35, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.58;
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(`LOOK ${String(index + 1).padStart(2, '0')}`, xPx(point.x) + 10, yPx(point.y) - 10);
    context.restore();
  });
}

function glyphPath(size) {
  context.beginPath();
  context.moveTo(size * 1.15, 0);
  context.lineTo(size * 0.14, -size * 0.68);
  context.lineTo(-size * 0.88, -size * 0.32);
  context.lineTo(-size * 0.56, size * 0.38);
  context.lineTo(size * 0.18, size * 0.67);
  context.closePath();
}

function drawAgent(agent) {
  const direct = agent.attention;
  const reciprocal = agent.reply;
  const answer = agent.answer;
  const role = direct > 0.32 ? 'direct' : reciprocal > 0.34 ? 'reciprocal' : answer > 0.4 ? 'answer' : 'quiet';
  const color = role === 'direct'
    ? palette.cyan
    : role === 'reciprocal'
      ? palette.rose
      : role === 'answer'
        ? palette.amber
        : agent.layer === 'signal'
          ? palette.ink
          : agent.layer === 'body'
            ? '#c9becf'
            : palette.smoke;
  const alpha = role === 'quiet'
    ? agent.layer === 'signal' ? 0.7 : agent.layer === 'body' ? 0.42 : 0.2
    : Math.min(0.94, 0.45 + direct * 0.2 + reciprocal * 0.14 + answer * 0.16);
  const size = (agent.layer === 'signal' ? 3.8 : agent.layer === 'body' ? 2.65 : 1.7) * agent.scale;
  const x = xPx(agent.x);
  const y = yPx(agent.y);

  context.save();
  context.translate(x, y);
  context.rotate(agent.angle);
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.shadowBlur = role === 'quiet' ? 0 : 8 + Math.min(14, agent.orientationShift * 2.2);
  context.shadowColor = color;
  glyphPath(size);
  context.fill();
  if (role !== 'quiet') {
    context.globalAlpha = 0.45;
    context.strokeStyle = color;
    context.lineWidth = 0.65;
    context.beginPath();
    context.moveTo(-size * 1.05, 0);
    context.lineTo(-size * (2.4 + Math.min(2.6, agent.orientationShift * 0.34)), 0);
    context.stroke();
  }
  context.restore();
}

function drawAgents(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const agent of frame.agents) drawAgent(agent);
  context.restore();
}

function drawCollectiveHalos(frame) {
  if (blindMode) return;
  const strongest = frame.memory.slice(-3);
  strongest.forEach((record, index) => {
    const point = record.point;
    const halo = context.createRadialGradient(xPx(point.x), yPx(point.y), 4, xPx(point.x), yPx(point.y), 104 + index * 20);
    halo.addColorStop(0, index % 2 ? 'rgba(134,221,208,.12)' : 'rgba(239,189,114,.1)');
    halo.addColorStop(1, 'rgba(16,13,21,0)');
    context.fillStyle = halo;
    context.fillRect(xPx(point.x) - 130, yPx(point.y) - 130, 260, 260);
  });
}

function updateReadout(frame) {
  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} ${frame.memory.length === 1 ? 'look' : 'looks'}`;
  rendererReadout.textContent = rendererLabel;
  lastFrame = frame;
}

function renderCurrent() {
  const frame = interactionFrame || timeline[currentStage];
  if (!frame) return;
  drawAtmosphere(frame.stage);
  drawCollectiveHalos(frame);
  drawLookWitnesses(frame);
  drawAgents(frame);
  updateReadout(frame);
  lastRenderedStage = frame.stage;
}

function baseFrame() {
  return interactionFrame || timeline[currentStage];
}

function pointFromPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0.08, 0.92),
    y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0.08, 0.92)
  };
}

function visitorLook(point = { x: 0.92, y: 0.08 }) {
  interactionFrame = applyLook(baseFrame(), point);
  paused = true;
  renderCurrent();
}

function liftLatest() {
  const frame = baseFrame();
  if (!frame.memory.length) return;
  interactionFrame = deleteLook(frame);
  paused = true;
  renderCurrent();
}

function releaseCurrent() {
  interactionFrame = releaseLooks(baseFrame());
  currentStage = 0;
  paused = true;
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.focus();
  visitorLook(pointFromPointer(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    visitorLook();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});
lookControl.addEventListener('click', () => visitorLook());
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCurrent);
window.addEventListener('resize', resizeCanvas);

window.__mutineState = () => ({
  stage: lastFrame?.stage ?? 0,
  memory: lastFrame?.memory.length ?? 0,
  paused,
  blindMode,
  renderer: rendererLabel
});

function tick(now) {
  if (!paused && !interactionFrame) {
    const nextStage = Math.min(STAGES - 1, Math.floor((now - started) / STAGE_MS));
    if (nextStage !== currentStage || lastRenderedStage < 0) {
      currentStage = nextStage;
      renderCurrent();
    }
    if (currentStage >= STAGES - 1) paused = true;
  } else if (lastRenderedStage < 0) {
    renderCurrent();
  }
  window.requestAnimationFrame(tick);
}

resizeCanvas();
renderCurrent();
window.requestAnimationFrame(tick);
