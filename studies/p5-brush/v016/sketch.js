import {
  STAGES,
  buildTimeline,
  registerCut,
  liftLatestCut
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const cutControl = document.querySelector('#cut-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4200;
const colors = {
  ground: '#08100c',
  deep: '#050806',
  plate: '#1a2a21',
  plateEdge: '#537664',
  ink: '#eee8d8',
  gold: '#e7b968',
  coral: '#df876f',
  mint: '#94d3b0',
  blue: '#8fb9c9',
  chalk: '#d8d0ba',
  shadow: '#07100c'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let draftPath = [];
let drawing = false;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
};
const pathLength = (path) => path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0);
const mix = (a, b, amount) => ({ x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount });

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

function drawBackground(frame) {
  const wash = context.createRadialGradient(.76, .02, .02, .45, .56, 1.04);
  wash.addColorStop(0, '#355643');
  wash.addColorStop(.36, colors.plate);
  wash.addColorStop(1, colors.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = colors.gold;
  context.lineWidth = .00055;
  for (let index = 0; index < 28; index += 1) {
    const y = .045 + index * .034;
    const drift = Math.sin(index * 1.21 + frame.stage * .13) * .014;
    context.beginPath();
    context.moveTo(.025, y + drift);
    context.bezierCurveTo(.26, y - drift, .72, y + drift * .72, .975, y - drift * .22);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 760; index += 1) {
    const x = ((index * 83.17 + frame.stage * 5.1) % 997) / 997;
    const y = ((index * 157.31 + 23 + frame.stage * 2.2) % 991) / 991;
    context.fillStyle = index % 17 === 0 ? rgba(colors.mint, .13) : rgba(colors.chalk, .025);
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();
}

function roundedRect(x, y, rectWidth, rectHeight, radius) {
  const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + rectWidth, y, x + rectWidth, y + rectHeight, r);
  context.arcTo(x + rectWidth, y + rectHeight, x, y + rectHeight, r);
  context.arcTo(x, y + rectHeight, x, y, r);
  context.arcTo(x, y, x + rectWidth, y, r);
  context.closePath();
}

function drawPlate(frame) {
  const plate = frame.plate;
  context.save();
  context.shadowColor = rgba(colors.shadow, .72);
  context.shadowBlur = .045;
  context.shadowOffsetY = .018;
  roundedRect(plate.x, plate.y, plate.width, plate.height, plate.corner);
  context.fillStyle = rgba(colors.plate, .98);
  context.fill();
  context.restore();

  context.save();
  roundedRect(plate.x, plate.y, plate.width, plate.height, plate.corner);
  context.strokeStyle = rgba(colors.plateEdge, .72);
  context.lineWidth = .0022;
  context.stroke();
  context.globalAlpha = .3;
  context.strokeStyle = colors.gold;
  context.lineWidth = .00065;
  roundedRect(plate.x + .016, plate.y + .016, plate.width - .032, plate.height - .032, plate.corner * .72);
  context.stroke();
  context.restore();
}

function cellPath(cell, scale = 1) {
  const halfWidth = cell.width * scale / 2;
  const halfHeight = cell.height * scale / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight * .86 },
    { x: halfWidth * .9, y: halfHeight },
    { x: -halfWidth * .92, y: halfHeight * .88 }
  ];
  context.beginPath();
  corners.forEach((corner, index) => {
    const x = cell.x + corner.x * Math.cos(cell.angle) - corner.y * Math.sin(cell.angle);
    const y = cell.y + corner.x * Math.sin(cell.angle) + corner.y * Math.cos(cell.angle);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function drawCell(cell) {
  const lifted = clamp(cell.lift, 0, 1);
  const fill = cell.side > 0 ? colors.mint : colors.gold;
  const baseAlpha = .22 + cell.opacity * .28 + lifted * .18;
  context.save();
  context.shadowColor = rgba(colors.shadow, .42 + lifted * .28);
  context.shadowBlur = .006 + lifted * .022;
  context.shadowOffsetX = (cell.side || 0) * lifted * .006;
  context.shadowOffsetY = -lifted * .008;
  cellPath(cell, 1 + lifted * .08);
  context.fillStyle = rgba(fill, baseAlpha);
  context.fill();
  context.strokeStyle = rgba(colors.chalk, .1 + cell.edge * .27);
  context.lineWidth = .0006 + cell.edge * .0007;
  context.stroke();
  context.restore();

  context.save();
  context.translate(cell.x, cell.y);
  context.rotate(cell.angle);
  context.globalAlpha = .1 + cell.grain * .26;
  context.strokeStyle = cell.side > 0 ? colors.blue : colors.coral;
  context.lineWidth = .00065 + lifted * .0007;
  const grainCount = 2 + Math.floor(cell.grain * 4);
  for (let index = 0; index < grainCount; index += 1) {
    const offset = (index - (grainCount - 1) / 2) * .008;
    context.beginPath();
    context.moveTo(-cell.width * .32, offset - cell.height * .14);
    context.lineTo(cell.width * (.28 + cell.grain * .12), offset + cell.height * .16);
    context.stroke();
  }
  context.restore();
}

function drawCells(frame) {
  frame.cells.forEach(drawCell);
}

function traceOpen(points) {
  if (!points?.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
}

function drawScar(frame) {
  if (!frame.scar.points.length) return;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  traceOpen(frame.scar.points);
  context.strokeStyle = rgba(colors.deep, .86);
  context.lineWidth = frame.cut.width * .42;
  context.stroke();
  traceOpen(frame.scar.points);
  context.strokeStyle = rgba(colors.coral, .66);
  context.lineWidth = .0016 + frame.cut.width * .055;
  context.stroke();
  context.restore();
}

function drawRidge(frame) {
  if (!frame.displacedRidge.points.length) return;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  traceOpen(frame.displacedRidge.points);
  context.strokeStyle = rgba(colors.gold, .16);
  context.lineWidth = frame.cut.width * .9;
  context.stroke();
  traceOpen(frame.displacedRidge.points);
  context.strokeStyle = rgba(colors.ink, .62);
  context.lineWidth = .0024 + frame.cut.width * .09;
  context.stroke();
  context.restore();
}

function drawCutWitness(frame) {
  if (visualNoFurniture || !frame.cut) return;
  context.save();
  traceOpen(frame.cut.path);
  context.setLineDash([.006, .009]);
  context.strokeStyle = rgba(colors.ink, .52);
  context.lineWidth = .001;
  context.stroke();
  context.setLineDash([]);
  frame.cut.path.forEach((point, index) => {
    context.fillStyle = index === 0 || index === frame.cut.path.length - 1 ? colors.coral : colors.gold;
    context.beginPath();
    context.arc(point.x, point.y, .0046, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.font = '0.012px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = rgba(colors.ink, .78);
  context.fillText('MATERIAL / PRESSURE PLATE', .06, .065);
  context.fillStyle = colors.gold;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .06, .952);
  context.textAlign = 'right';
  context.fillStyle = colors.mint;
  context.fillText(`${frame.memory.length} CUT${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .94, .952);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame);
  drawPlate(frame);
  drawCells(frame);
  drawRidge(frame);
  drawScar(frame);
  drawCutWitness(frame);
  if (draftPath.length >= 2) {
    context.save();
    traceOpen(draftPath);
    context.strokeStyle = rgba(colors.ink, .75);
    context.lineWidth = .003;
    context.setLineDash([.008, .01]);
    context.stroke();
    context.restore();
  }
  drawMarks(frame);

  if (stageReadout) stageReadout.textContent = state === 'visitor-pressure-cut'
    ? 'pressure cut registered / plate held'
    : state === 'cut-lifted'
      ? 'latest cut lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure cut${frame.memory.length === 1 ? '' : 's'} carried · ${frame.cells.length} cells`;
  if (interactionState) interactionState.textContent = state === 'visitor-pressure-cut'
    ? 'The incision has lifted two banks and displaced a ridge.'
    : state === 'cut-lifted'
      ? 'The latest pressure is gone; the prior plate is exact.'
      : 'The plate is holding its layered pressure.';
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.cells = String(frame.cells.length);
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-pressure-cut');
    return;
  }
  const frame = frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1);
  if (frozen) {
    render(frame, 'sequence');
    return;
  }
  render(frameAt(now) ?? frame, 'sequence');
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .08, .92),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .1, .9)
  };
}

function makeKeyboardPath() {
  return [
    { x: .23, y: .32 },
    { x: .47, y: .5 },
    { x: .76, y: .62 }
  ];
}

function registerVisitorCut(path) {
  if (staticPreview) return;
  const cleanPath = path.length >= 2 ? path : makeKeyboardPath();
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  const pressure = clamp(.34 + pathLength(cleanPath) * .72, .22, .98);
  interactionFrame = registerCut(base, { path: cleanPath, pressure });
  paused = true;
  draftPath = [];
  render(interactionFrame, 'visitor-pressure-cut');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = liftLatestCut(base);
  paused = true;
  draftPath = [];
  render(interactionFrame, 'cut-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  currentStage = 0;
  startedAt = performance.now();
  paused = false;
  draftPath = [];
  renderCurrent();
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-brush-v016.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  drawing = true;
  draftPath = [pointerPoint(event)];
  canvas.setPointerCapture?.(event.pointerId);
  render(interactionFrame ?? timeline[currentStage] ?? timeline.at(-1), 'drawing');
});
canvas.addEventListener('pointermove', (event) => {
  if (!drawing || staticPreview) return;
  event.preventDefault();
  const point = pointerPoint(event);
  const previous = draftPath.at(-1);
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > .006) draftPath.push(point);
  render(interactionFrame ?? timeline[currentStage] ?? timeline.at(-1), 'drawing');
});
canvas.addEventListener('pointerup', (event) => {
  if (!drawing || staticPreview) return;
  event.preventDefault();
  drawing = false;
  canvas.releasePointerCapture?.(event.pointerId);
  if (draftPath.length < 2) {
    const point = draftPath[0] ?? { x: .5, y: .5 };
    draftPath = [
      { x: clamp(point.x - .12, .08, .92), y: clamp(point.y - .06, .1, .9) },
      { x: clamp(point.x + .12, .08, .92), y: clamp(point.y + .06, .1, .9) }
    ];
  }
  registerVisitorCut(draftPath);
});
canvas.addEventListener('pointercancel', () => {
  drawing = false;
  draftPath = [];
  renderCurrent();
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    registerVisitorCut(makeKeyboardPath());
  }
  if (event.key === 'Delete' || event.key === 'Backspace') liftLatest();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
cutControl?.addEventListener('click', () => registerVisitorCut(makeKeyboardPath()));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutineBrushV016 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      cells: frame.cells.length,
      materialLoad: frame.materialLoad,
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
