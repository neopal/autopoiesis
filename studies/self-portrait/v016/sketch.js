import {
  STAGES,
  buildTimeline,
  registerAttention,
  liftLatestAttention,
  geometrySignature,
  ATTENTION_THRESHOLD
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attendControl = document.querySelector('#attend-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3300;

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let armedPoint = { x: .72, y: .34 };
let holdStartedAt = 0;
let holdPointerId = null;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = {
  ground: '#03070a',
  deep: '#07141a',
  ink: '#e7f1ed',
  copper: '#d89b72',
  mint: '#72e2c1',
  blue: '#7cc9ea',
  lilac: '#c1b3ff'
};

function syncCanvas() {
  const bounds = canvas.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);
}

function drawBackground(stage) {
  const wash = context.createRadialGradient(.16, .04, .02, .44, .52, .95);
  wash.addColorStop(0, '#24414a');
  wash.addColorStop(.32, '#10252c');
  wash.addColorStop(.74, '#071016');
  wash.addColorStop(1, palette.ground);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const pool = context.createRadialGradient(.78, .8, 0, .78, .8, .66);
  pool.addColorStop(0, 'rgba(216,155,114,.12)');
  pool.addColorStop(.4, 'rgba(193,179,255,.035)');
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = pool;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .11;
  context.strokeStyle = palette.blue;
  context.lineWidth = .00055;
  for (let index = 0; index < 34; index += 1) {
    const y = .07 + index * .027;
    const drift = Math.sin(index * 1.37 + stage * .08) * .008;
    context.beginPath();
    context.moveTo(.04, y + drift);
    context.bezierCurveTo(.27, y - drift, .7, y + drift * .4, .96, y - drift * .32);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 920; index += 1) {
    const x = ((index * 83.17 + stage * 3.8) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 2.6) % 997) / 997;
    context.fillStyle = index % 19 === 0 ? 'rgba(114,226,193,.15)' : 'rgba(231,241,237,.027)';
    context.fillRect(x, y, .0008, .0008);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(231,241,237,.38)';
  context.lineWidth = .00075;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.085, .045); context.moveTo(.045, .045); context.lineTo(.045, .085);
  context.moveTo(.955, .955); context.lineTo(.915, .955); context.moveTo(.955, .955); context.lineTo(.955, .915);
  context.stroke();
  context.restore();
}

function cellColor(cell, alpha) {
  const hue = cell.tone < .34 ? 28 : cell.tone < .66 ? 166 : 194;
  const saturation = cell.tone < .34 ? 61 : 45;
  const lightness = 48 + cell.tone * 29;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

function drawCells(frame) {
  context.save();
  context.globalCompositeOperation = 'screen';
  frame.cells.forEach((cell) => {
    if (!cell.active || cell.opacity <= .018) return;
    const radius = cell.radius;
    context.save();
    context.translate(cell.x, cell.y);
    context.rotate(cell.angle);
    context.fillStyle = cellColor(cell, clamp(cell.opacity * .78));
    context.fillRect(-radius, -radius * .82, radius * 2, radius * 1.64);
    context.fillStyle = cellColor(cell, clamp(cell.opacity * .28));
    context.fillRect(-radius * .44, -radius * 1.24, radius * .88, radius * 2.48);
    context.restore();
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = 'lighter';
  frame.cells.forEach((cell) => {
    if (!cell.active || cell.opacity < .14) return;
    const radius = cell.radius * .26;
    context.fillStyle = cellColor(cell, clamp(cell.opacity * .58));
    context.beginPath();
    context.arc(cell.x - radius * .28, cell.y - radius * .28, radius, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawTransfers(frame) {
  if (visualNoFurniture) return;
  frame.transfers.forEach((transfer, index) => {
    const [start, bend, end] = transfer.path;
    context.save();
    context.globalAlpha = .24 - index * .025;
    context.strokeStyle = index % 2 ? palette.mint : palette.copper;
    context.lineWidth = .0016;
    context.setLineDash([.008, .012]);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(bend.x, bend.y, end.x, end.y);
    context.stroke();
    context.restore();
  });
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.fillStyle = 'rgba(231,241,237,.84)';
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('SELF / WITNESS DISTRIBUTION', .045, .065);
  context.fillStyle = palette.copper;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = palette.mint;
  context.fillText(`${frame.attentions.length} WITNESS${frame.attentions.length === 1 ? '' : 'ES'} HELD`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawCells(frame);
  drawTransfers(frame);
  drawMarks(frame);
  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-attention'
      ? 'witness transferred / paused'
      : state === 'attention-lifted'
        ? 'latest witness lifted'
        : state === 'armed'
          ? 'witness armed / hold to commit'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.attentions.length} witness${frame.attentions.length === 1 ? '' : 'es'} held · ${frame.voids.length} withdrawn patches`;
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.attentions = String(frame.attentions.length);
  canvas.dataset.voids = String(frame.voids.length);
  canvas.dataset.transfers = String(frame.transfers.length);
  canvas.dataset.signature = geometrySignature(frame);
  canvas.dataset.interaction = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-attention');
    return;
  }
  const frame = timeline.at(-1);
  if (frozen) {
    render(frame, 'sequence');
    return;
  }
  const liveFrame = frameAt(now);
  render(liveFrame, 'sequence');
  if (!paused) requestAnimationFrame(renderCurrent);
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, .12, .88),
    y: clamp((event.clientY - bounds.top) / bounds.height, .12, .88),
    dwell: .86
  };
}

function commitAttention(point = armedPoint, dwell = .86) {
  // witness-transfer is structural: source cells withdraw while a distant receiver grows.
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = registerAttention(baseline, { ...point, dwell: clamp(dwell, ATTENTION_THRESHOLD, 1) });
  paused = true;
  render(interactionFrame, interactionFrame.interaction);
}

function lift() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  if (!baseline.memory.length) return;
  interactionFrame = liftLatestAttention(baseline);
  render(interactionFrame, interactionFrame.interaction);
}

function release() {
  interactionFrame = null;
  paused = false;
  currentStage = 0;
  startedAt = performance.now();
  renderCurrent();
}

canvas.addEventListener('pointermove', (event) => {
  armedPoint = pointFromEvent(event);
  canvas.dataset.armed = 'true';
  if (!interactionFrame) render(timeline[currentStage] ?? timeline.at(-1), 'armed');
});

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  armedPoint = pointFromEvent(event);
  holdPointerId = event.pointerId;
  holdStartedAt = performance.now();
  canvas.dataset.holding = 'true';
});

canvas.addEventListener('pointerup', (event) => {
  if (holdPointerId !== event.pointerId) return;
  const elapsed = performance.now() - holdStartedAt;
  const dwell = clamp(Math.max(ATTENTION_THRESHOLD, elapsed / 900), ATTENTION_THRESHOLD, 1);
  holdPointerId = null;
  canvas.dataset.holding = 'false';
  commitAttention(armedPoint, dwell);
});

canvas.addEventListener('pointercancel', () => {
  holdPointerId = null;
  canvas.dataset.holding = 'false';
});

canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitAttention(armedPoint, .9);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attendControl?.addEventListener('click', () => commitAttention({ x: .72, y: .34 }, .9));
undoControl?.addEventListener('click', lift);
releaseControl?.addEventListener('click', release);
window.addEventListener('resize', () => renderCurrent());

window.__mutinePortraitV016 = {
  getState() {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      attentions: frame.attentions.length,
      voids: frame.voids.length,
      transfers: frame.transfers.length,
      signature: geometrySignature(frame),
      interaction: interactionFrame?.interaction ?? 'sequence',
      armed: canvas.dataset.armed === 'true'
    };
  },
  getFrame() {
    return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  }
};

renderCurrent();
