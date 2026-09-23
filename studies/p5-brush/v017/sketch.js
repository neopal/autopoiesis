import {
  STAGES,
  buildTimeline,
  applyEncounter,
  removeLatestEncounter,
  geometrySignature
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const encounterControl = document.querySelector('#encounter-control');
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
const STAGE_MS = 4700;
const colors = {
  ground: '#0b100e',
  deep: '#050807',
  moss: '#9ad2b5',
  gold: '#e7bb70',
  coral: '#df876f',
  blue: '#8ebac6',
  chalk: '#eee8d8',
  shadow: '#020504',
  hole: '#07100d'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let drawing = false;
let draftPoint = null;
let lastProximityPoint = null;

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
  const gradient = context.createRadialGradient(.72, .08, .02, .48, .55, 1.02);
  gradient.addColorStop(0, '#314a3d');
  gradient.addColorStop(.38, '#16251d');
  gradient.addColorStop(1, colors.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .13;
  context.strokeStyle = colors.gold;
  context.lineWidth = .0005;
  for (let index = 0; index < 22; index += 1) {
    const angle = index * .73 + frame.stage * .035;
    const cx = .5 + Math.cos(angle) * .06;
    const cy = .55 + Math.sin(angle * 1.37) * .05;
    context.beginPath();
    context.arc(cx, cy, .18 + index * .025, angle, angle + 1.4 + index * .012);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 680; index += 1) {
    const x = ((index * 83.17 + frame.stage * 3.2) % 997) / 997;
    const y = ((index * 157.31 + 23 + frame.stage * 1.4) % 991) / 991;
    context.fillStyle = index % 19 === 0 ? rgba(colors.moss, .14) : rgba(colors.chalk, .025);
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();
}

function islandPath(island, scale = 1, phase = 0) {
  const points = 15;
  const radius = island.radius * scale;
  context.beginPath();
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const wobble = 1 + Math.sin(index * 2.73 + island.index * 1.41 + phase) * .075 + Math.cos(index * 1.19 + island.index) * .038;
    const x = Math.cos(angle) * radius * island.aspect * wobble;
    const y = Math.sin(angle) * radius * wobble;
    const rotatedX = x * Math.cos(island.angle) - y * Math.sin(island.angle);
    const rotatedY = x * Math.sin(island.angle) + y * Math.cos(island.angle);
    const px = island.x + rotatedX;
    const py = island.y + rotatedY;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function islandColor(island) {
  const palette = [colors.moss, colors.gold, colors.coral, colors.blue];
  return palette[island.index % palette.length];
}

function drawIsland(island, frame) {
  const color = islandColor(island);
  const lifted = clamp(Math.abs(island.tilt) + island.receiveLoad * .12, 0, 1);
  context.save();
  context.shadowColor = rgba(colors.shadow, .72);
  context.shadowBlur = .018 + island.porosity * .022;
  context.shadowOffsetX = island.tilt * .01;
  context.shadowOffsetY = -.008 - lifted * .008;
  islandPath(island, 1 + island.receiveLoad * .13, frame.stage * .12);
  const fill = context.createRadialGradient(island.x - island.radius * .35, island.y - island.radius * .4, .005, island.x, island.y, island.radius * 1.7);
  fill.addColorStop(0, rgba(colors.chalk, .15 + island.sediment * .16));
  fill.addColorStop(.4, rgba(color, .36 + island.mass * .2));
  fill.addColorStop(1, rgba(color, .16 + island.porosity * .12));
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = rgba(colors.chalk, .11 + island.edge * .27);
  context.lineWidth = .0008 + island.edge * .0012;
  context.stroke();
  context.restore();

  context.save();
  context.translate(island.x, island.y);
  context.rotate(island.angle + island.tilt * .2);
  context.globalAlpha = .12 + island.grain * .3;
  context.strokeStyle = island.index % 2 ? colors.chalk : colors.blue;
  context.lineWidth = .00065 + island.receiveLoad * .0006;
  const grainCount = 3 + Math.floor(island.grain * 7);
  for (let index = 0; index < grainCount; index += 1) {
    const offset = (index - (grainCount - 1) / 2) * island.radius * .12;
    context.beginPath();
    context.moveTo(-island.radius * .54, offset - island.radius * .11);
    context.bezierCurveTo(-island.radius * .12, offset - island.radius * .03, island.radius * .22, offset + island.radius * .09, island.radius * .58, offset + island.radius * .04);
    context.stroke();
  }
  context.restore();

  if (island.notch > .04 || island.porosity > .26) {
    context.save();
    context.translate(island.x - island.tilt * .015, island.y + island.notch * .01);
    context.rotate(island.angle - island.tilt * .16);
    context.scale(island.aspect * (1 + island.notch * .16), 1);
    context.fillStyle = rgba(colors.hole, .56 + island.porosity * .25);
    context.beginPath();
    context.ellipse(0, 0, island.radius * (.2 + island.notch * .24), island.radius * (.11 + island.porosity * .16), 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = rgba(colors.coral, .18 + island.notch * .25);
    context.lineWidth = .001;
    context.stroke();
    context.restore();
  }

  if (island.receiveLoad > .04) {
    context.save();
    context.globalAlpha = .28 + island.receiveLoad * .18;
    context.fillStyle = colors.gold;
    for (let index = 0; index < 7; index += 1) {
      const angle = index * 1.87 + island.index;
      const distance = island.radius * (.62 + (index % 3) * .07);
      context.beginPath();
      context.arc(island.x + Math.cos(angle) * distance, island.y + Math.sin(angle) * distance, .002 + island.receiveLoad * .0015, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function drawEncounterRelation(frame) {
  if (visualNoFurniture || !frame.activeEncounter) return;
  const event = frame.activeEncounter;
  const source = frame.islands[event.sourceIndex];
  const receiver = frame.islands[event.receiverIndex];
  const vacancy = frame.islands[event.vacancyIndex];
  context.save();
  context.setLineDash([.006, .011]);
  context.lineWidth = .001;
  context.strokeStyle = rgba(colors.gold, .38);
  context.beginPath();
  context.moveTo(source.x, source.y);
  context.quadraticCurveTo(event.point.x, event.point.y - .08, receiver.x, receiver.y);
  context.stroke();
  context.strokeStyle = rgba(colors.coral, .26);
  context.beginPath();
  context.moveTo(event.point.x, event.point.y);
  context.lineTo(vacancy.x, vacancy.y);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = colors.chalk;
  context.globalAlpha = .66;
  context.beginPath();
  context.arc(event.point.x, event.point.y, .0042, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.font = '0.012px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = rgba(colors.chalk, .76);
  context.fillText('MATERIAL / PROXIMITY ARCHIPELAGO', .06, .065);
  context.fillStyle = colors.gold;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .06, .952);
  context.textAlign = 'right';
  context.fillStyle = colors.moss;
  context.fillText(`${frame.memory.length} ENCOUNTER${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .94, .952);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame);
  frame.islands.forEach((island) => drawIsland(island, frame));
  drawEncounterRelation(frame);
  if (draftPoint && !visualNoFurniture) {
    context.save();
    context.strokeStyle = rgba(colors.chalk, .6);
    context.lineWidth = .0014;
    context.beginPath();
    context.arc(draftPoint.x, draftPoint.y, .02, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
  drawMarks(frame);

  if (stageReadout) stageReadout.textContent = state === 'visitor-proximity-transfer'
    ? 'proximity registered / material transferred'
    : state === 'encounter-lifted'
      ? 'latest encounter lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} encounter${frame.memory.length === 1 ? '' : 's'} carried · ${frame.vacancies} porous place${frame.vacancies === 1 ? '' : 's'}`;
  if (interactionState) interactionState.textContent = state === 'visitor-proximity-transfer'
    ? 'One island yielded; another received; a third opened.'
    : state === 'encounter-lifted'
      ? 'The latest relation is gone; the prior archipelago is exact.'
      : 'The islands are keeping their separate weight.';
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.vacancies = String(frame.vacancies);
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-proximity-transfer');
    return;
  }
  if (frozen) {
    render(timeline.at(-1), 'sequence');
    return;
  }
  render(frameAt(now), 'sequence');
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .08, .92),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .1, .9)
  };
}

function keyboardPoint() {
  return { x: .28, y: .42 };
}

function registerVisitorEncounter(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = applyEncounter(base, point ?? keyboardPoint());
  paused = true;
  draftPoint = null;
  lastProximityPoint = point ?? keyboardPoint();
  render(interactionFrame, 'visitor-proximity-transfer');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = removeLatestEncounter(base);
  paused = true;
  draftPoint = null;
  render(interactionFrame, 'encounter-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  currentStage = 0;
  startedAt = performance.now();
  paused = false;
  draftPoint = null;
  lastProximityPoint = null;
  renderCurrent();
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-brush-v017.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  drawing = true;
  draftPoint = pointFromEvent(event);
  canvas.setPointerCapture?.(event.pointerId);
  render(interactionFrame ?? timeline[currentStage] ?? timeline.at(-1), 'approaching');
});
canvas.addEventListener('pointermove', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  const point = pointFromEvent(event);
  draftPoint = point;
  if (!drawing && lastProximityPoint && Math.hypot(point.x - lastProximityPoint.x, point.y - lastProximityPoint.y) > .045) registerVisitorEncounter(point);
  else render(interactionFrame ?? timeline[currentStage] ?? timeline.at(-1), 'approaching');
  lastProximityPoint = point;
});
canvas.addEventListener('pointerup', (event) => {
  if (!drawing || staticPreview) return;
  event.preventDefault();
  drawing = false;
  canvas.releasePointerCapture?.(event.pointerId);
  registerVisitorEncounter(draftPoint ?? pointFromEvent(event));
});
canvas.addEventListener('pointercancel', () => {
  drawing = false;
  draftPoint = null;
  renderCurrent();
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    registerVisitorEncounter(keyboardPoint());
  }
  if (event.key === 'Delete' || event.key === 'Backspace') liftLatest();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
encounterControl?.addEventListener('click', () => registerVisitorEncounter(keyboardPoint()));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutineBrushV017 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    const active = frame.activeEncounter;
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      vacancies: frame.vacancies,
      islands: frame.islands.length,
      sourceIndex: active?.sourceIndex ?? null,
      receiverIndex: active?.receiverIndex ?? null,
      vacancyIndex: active?.vacancyIndex ?? null,
      transferMass: frame.transferMass,
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  },
  getFrameSignature: () => geometrySignature(interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1)))
};
