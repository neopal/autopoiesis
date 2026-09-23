import {
  STAGES,
  buildTimeline,
  registerWitness,
  liftLatestWitness,
  geometrySignature
} from './engine.mjs';

// reciprocal-plate is the work's structural event, not a decorative label.
const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const witnessControl = document.querySelector('#witness-control');
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
const STAGE_MS = 3600;
const colors = {
  ground: '#0b1016',
  deep: '#05080c',
  grid: '#1e2c35',
  ink: '#f2e8d2',
  paper: '#dbb67d',
  coral: '#ef8b72',
  mint: '#78d3c0',
  violet: '#b6a1ff',
  blue: '#83bce2',
  yellow: '#f1cd72',
  muted: '#9ba8ae'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

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
  const wash = context.createRadialGradient(.77, .05, .02, .48, .55, .93);
  wash.addColorStop(0, '#304655');
  wash.addColorStop(.34, '#17242d');
  wash.addColorStop(1, colors.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const ember = context.createRadialGradient(.17, .78, 0, .17, .78, .74);
  ember.addColorStop(0, 'rgba(239,139,114,.14)');
  ember.addColorStop(.42, 'rgba(182,161,255,.045)');
  ember.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = ember;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .12;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 24; index += 1) {
    const y = .07 + index * .037;
    const drift = Math.sin(index * 1.42 + stage * .09) * .012;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.31, y - drift, .66, y + drift * .6, .965, y - drift * .2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .18;
  context.strokeStyle = colors.mint;
  context.lineWidth = .00055;
  for (let index = 0; index < 7; index += 1) {
    const x = .24 + index * .083 + Math.sin(stage * .11 + index) * .004;
    context.beginPath();
    context.moveTo(x, .1);
    context.bezierCurveTo(x - .02, .32, x + .022, .64, x - .012, .9);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 560; index += 1) {
    const x = ((index * 83.17 + stage * 4.1) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 3.1) % 997) / 997;
    context.fillStyle = index % 17 === 0 ? 'rgba(120,211,192,.12)' : 'rgba(219,182,125,.025)';
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(219,182,125,.52)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.082, .045); context.moveTo(.045, .045); context.lineTo(.045, .082);
  context.moveTo(.955, .955); context.lineTo(.918, .955); context.moveTo(.955, .955); context.lineTo(.955, .918);
  context.stroke();
  context.restore();
}

function tracePolygon(points) {
  if (!points?.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const middle = midpoint(previous, point);
    context.quadraticCurveTo(previous.x, previous.y, middle.x, middle.y);
  }
  const last = points.at(-1);
  const first = points[0];
  context.quadraticCurveTo(last.x, last.y, first.x, first.y);
  context.closePath();
}

function drawCore(stage) {
  context.save();
  context.translate(.5, .51);
  context.rotate(Math.sin(stage * .11) * .025);
  context.scale(.14, .32);
  context.beginPath();
  context.moveTo(-1, -.78);
  context.bezierCurveTo(-.54, -1.05, .54, -1.05, 1, -.78);
  context.bezierCurveTo(.73, -.24, .72, .48, 0, .9);
  context.bezierCurveTo(-.72, .48, -.73, -.24, -1, -.78);
  context.closePath();
  context.fillStyle = 'rgba(4,8,11,.8)';
  context.fill();
  context.strokeStyle = 'rgba(120,211,192,.38)';
  context.lineWidth = .0022;
  context.stroke();
  context.restore();

  context.save();
  context.translate(.5, .47);
  context.rotate(Math.sin(stage * .17) * .04);
  context.strokeStyle = 'rgba(239,139,114,.5)';
  context.lineWidth = .002;
  context.beginPath();
  context.moveTo(-.085, -.015);
  context.quadraticCurveTo(0, .035, .085, -.015);
  context.stroke();
  context.restore();
}

function colorForPlate(plate, index) {
  if (plate.state === 'looking') return index % 2 ? colors.mint : colors.coral;
  if (plate.state === 'answering') return index % 2 ? colors.violet : colors.blue;
  return index % 3 === 0 ? colors.paper : index % 3 === 1 ? '#d9e1db' : '#9cb1b8';
}

function drawPlate(plate, index, stage) {
  if (plate.occupancy === 0) {
    context.save();
    context.setLineDash([.006, .008]);
    context.strokeStyle = 'rgba(239,139,114,.58)';
    context.lineWidth = .0014;
    tracePolygon(plate.basePoints);
    context.stroke();
    context.setLineDash([]);
    context.restore();
    return;
  }

  context.save();
  context.globalAlpha = .22;
  context.translate(.008, .012);
  context.fillStyle = '#020509';
  tracePolygon(plate.points);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = plate.state === 'quiet' ? .85 : .98;
  context.fillStyle = colorForPlate(plate, index);
  tracePolygon(plate.points);
  context.fill();
  context.strokeStyle = plate.state === 'looking' ? colors.ink : plate.state === 'answering' ? colors.yellow : 'rgba(5,8,12,.7)';
  context.lineWidth = plate.state === 'quiet' ? .0012 : .0021;
  context.stroke();
  context.restore();

  const inner = plate.inner;
  context.save();
  context.translate(inner.x, inner.y);
  context.rotate(inner.angle);
  context.globalAlpha = plate.state === 'quiet' ? .56 : .94;
  context.strokeStyle = plate.state === 'looking' ? colors.ink : plate.state === 'answering' ? colors.yellow : '#071018';
  context.lineWidth = plate.state === 'quiet' ? .0021 : .0033;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-inner.width, 0);
  context.quadraticCurveTo(0, inner.height, inner.width, 0);
  context.stroke();
  context.restore();

  if (plate.state !== 'quiet') {
    context.save();
    context.globalAlpha = .32;
    context.strokeStyle = plate.state === 'looking' ? colors.coral : colors.mint;
    context.lineWidth = .007;
    tracePolygon(plate.points);
    context.stroke();
    context.restore();
  }

  if (!visualNoFurniture && plate.state !== 'quiet') {
    context.save();
    context.globalAlpha = .7;
    context.fillStyle = plate.state === 'looking' ? colors.coral : colors.mint;
    context.font = '0.009px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(plate.state === 'looking' ? 'LOOK' : 'ANSWER', plate.center.x - .032, plate.center.y + .052);
    context.restore();
  }

  if (stage < 0) context.fillStyle = colors.grid;
}

function drawShards(frame) {
  frame.vacancies.forEach((plate, index) => {
    if (!plate.shard.length) return;
    context.save();
    context.globalAlpha = .56 - index * .045;
    context.fillStyle = index % 2 ? colors.coral : colors.paper;
    tracePolygon(plate.shard);
    context.fill();
    context.strokeStyle = colors.ink;
    context.lineWidth = .0011;
    context.stroke();
    context.restore();
  });
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(242,232,210,.78)';
  context.fillText('SELF / PLATE REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.mint;
  context.fillText(`${frame.memory.length} WITNESS${frame.memory.length === 1 ? '' : 'ES'} HELD`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawCore(frame.stage);
  frame.plates.forEach((plate, index) => drawPlate(plate, index, frame.stage));
  drawShards(frame);
  drawMarks(frame);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-witness'
      ? 'witness registered / paused'
      : state === 'witness-lifted'
        ? 'latest witness lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} witness${frame.memory.length === 1 ? '' : 'es'} held · ${frame.vacancies.length} open slot${frame.vacancies.length === 1 ? '' : 's'}`;
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.looking = String(frame.plates.filter((plate) => plate.state === 'looking').length);
  canvas.dataset.answering = String(frame.plates.filter((plate) => plate.state === 'answering').length);
  canvas.dataset.vacancies = String(frame.vacancies.length);
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-witness');
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

function markWitness(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = registerWitness(base, point);
  paused = true;
  render(interactionFrame, 'visitor-witness');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = liftLatestWitness(base);
  paused = true;
  render(interactionFrame, 'witness-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  currentStage = 0;
  startedAt = performance.now();
  if (frozen) {
    interactionFrame = timeline[0];
    paused = true;
    render(interactionFrame, 'sequence');
    return;
  }
  interactionFrame = null;
  paused = false;
  renderCurrent();
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-self-portrait-v014.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markWitness(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markWitness({ x: .78, y: .4 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') liftLatest();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
witnessControl?.addEventListener('click', () => markWitness({ x: .78, y: .4 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV014 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      looking: frame.plates.filter((plate) => plate.state === 'looking').length,
      answering: frame.plates.filter((plate) => plate.state === 'answering').length,
      vacancies: frame.vacancies.length,
      signature: geometrySignature(frame),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};