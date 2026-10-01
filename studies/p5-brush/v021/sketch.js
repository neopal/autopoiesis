import {
  STAGES,
  buildFrame,
  buildTimeline,
  rakeField,
  liftLatestRake
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4000;

const field = document.querySelector('#grain-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const rakeControl = document.querySelector('#rake-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let activePath = [];
let isDragging = false;
let pointerId = null;

const palette = {
  ground: '#10141b',
  deep: '#090c12',
  paper: '#d6d1c5',
  copper: '#d1845d',
  saffron: '#e5b862',
  cyan: '#69b8b3',
  blue: '#7688d6',
  rose: '#bb779d',
  seam: '#202d3b'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
};

function colourFor(p, hue, saturation = 58, brightness = 82, alpha = 100) {
  return p.color((hue + 360) % 360, saturation, brightness, alpha);
}

function fieldPoint(p, cell) {
  return { x: cell.x * p.width, y: cell.y * p.height };
}

function drawAtmosphere(p, frame, now) {
  p.push();
  p.noStroke();
  p.colorMode(p.RGB, 255, 255, 255, 255);
  p.background(palette.deep);
  for (let index = 0; index < 18; index += 1) {
    const amount = index / 18;
    p.fill(rgba(index % 2 ? palette.ground : palette.seam, 0.34));
    p.rect(0, amount * p.height, p.width, p.height / 18 + 1);
  }
  p.fill(rgba(palette.cyan, 0.07));
  p.ellipse(p.width * 0.18, p.height * 0.16, p.width * 0.56, p.height * 0.48);
  p.fill(rgba(palette.copper, 0.055));
  p.ellipse(p.width * 0.84, p.height * 0.78, p.width * 0.64, p.height * 0.52);
  p.pop();

  p.push();
  p.colorMode(p.HSB, 360, 100, 100, 100);
  p.noFill();
  p.stroke(205, 28, 72, 16);
  p.strokeWeight(Math.max(0.5, p.width * 0.0007));
  for (let index = 0; index < 10; index += 1) {
    const y = p.height * (0.105 + index * 0.086);
    p.beginShape();
    for (let step = 0; step <= 24; step += 1) {
      const x = (step / 24) * p.width;
      const wobble = Math.sin(step * 0.82 + index * 1.7 + frame.stage * 0.17 + now * 0.00005) * p.height * 0.004;
      p.vertex(x, y + wobble);
    }
    p.endShape();
  }
  p.pop();
}

function grainVertices(p, cell, scale = 1) {
  const x = cell.x * p.width;
  const y = cell.y * p.height;
  const width = cell.sizeX * p.width * scale;
  const height = cell.sizeY * p.height * scale;
  const tilt = cell.tilt;
  const bevel = 0.26 + cell.grain * 0.16;
  const lift = cell.answerLoad * height * 0.25;
  return [
    { x: x - width * 0.86 + tilt * width, y: y - height * 0.12 - lift },
    { x: x - width * bevel, y: y - height * 0.88 - lift },
    { x: x + width * 0.72 + tilt * width, y: y - height * 0.63 - lift },
    { x: x + width * 0.92, y: y + height * 0.2 },
    { x: x + width * 0.18 - tilt * width, y: y + height * 0.9 },
    { x: x - width * 0.78, y: y + height * 0.54 }
  ];
}

function drawGrain(p, cell, now) {
  const vertices = grainVertices(p, cell, 1 + cell.bypass * 0.09);
  const saturation = clamp(46 + cell.grain * 34 + cell.answerLoad * 16, 40, 96);
  const brightness = clamp(45 + cell.mass * 38 + cell.answerLoad * 20, 34, 96);
  p.fill(colourFor(p, cell.hue, saturation, brightness, 91));
  p.stroke(colourFor(p, cell.hue + 9, Math.min(100, saturation + 8), Math.min(100, brightness + 12), 48));
  p.strokeWeight(Math.max(0.55, p.width * 0.00055));
  p.beginShape();
  vertices.forEach((vertex) => p.vertex(vertex.x, vertex.y));
  p.endShape(p.CLOSE);

  const microCount = 1 + Math.floor(cell.grain * 3);
  p.stroke(colourFor(p, cell.hue + 24, 22, 98, 34 + cell.answerLoad * 28));
  p.strokeWeight(Math.max(0.35, p.width * 0.00028));
  for (let index = 0; index < microCount; index += 1) {
    const amount = (index + 1) / (microCount + 1);
    const left = vertices[5].x * (1 - amount) + vertices[2].x * amount;
    const top = vertices[1].y * (1 - amount) + vertices[4].y * amount;
    const drift = Math.sin(now * 0.00012 + cell.id * 1.71 + index) * p.width * 0.0014;
    p.line(left, top + drift, left + p.width * 0.009, top - p.height * 0.006 + drift);
  }
}

function drawScars(p, frame) {
  p.push();
  p.noFill();
  p.stroke(p.color(0, 0, 100, 17));
  p.strokeWeight(Math.max(0.7, p.width * 0.0007));
  frame.scars.forEach((scar, scarIndex) => {
    p.beginShape();
    scar.path.forEach((point) => p.vertex(point.x * p.width, point.y * p.height));
    p.endShape();
    p.stroke(p.color(42 + scarIndex * 18, 62, 94, 28));
    p.beginShape(p.POINTS);
    for (let pointIndex = 0; pointIndex < scar.path.length; pointIndex += 1) {
      const point = scar.path[pointIndex];
      p.vertex(point.x * p.width, point.y * p.height);
    }
    p.endShape();
  });
  p.pop();
}

function drawAnswers(p, frame) {
  p.push();
  p.noFill();
  frame.answers.forEach((answer, index) => {
    const x = answer.x * p.width;
    const y = answer.y * p.height;
    const radius = answer.radius * Math.min(p.width, p.height);
    p.stroke(colourFor(p, 190 + index * 19, 58, 92, 27));
    p.strokeWeight(Math.max(0.65, p.width * 0.00065));
    p.arc(x, y, radius * 1.65, radius * 0.95, -0.8, 2.25);
    p.stroke(colourFor(p, 36 + index * 17, 63, 94, 25));
    p.arc(x, y, radius * 1.12, radius * 1.58, 2.4, 5.35);
  });
  p.pop();
}

function drawActivePath(p) {
  if (activePath.length < 2) return;
  p.push();
  p.noFill();
  p.stroke(colourFor(p, 44, 52, 98, 78));
  p.strokeWeight(Math.max(2, p.width * 0.005));
  p.beginShape();
  activePath.forEach((point) => p.vertex(point.x * p.width, point.y * p.height));
  p.endShape();
  p.stroke(colourFor(p, 188, 44, 98, 80));
  p.strokeWeight(Math.max(0.8, p.width * 0.001));
  p.beginShape();
  activePath.forEach((point) => p.vertex(point.x * p.width, point.y * p.height));
  p.endShape();
  p.pop();
}

function render(p, frame, state = 'sequence', now = performance.now()) {
  p.colorMode(p.HSB, 360, 100, 100, 100);
  drawAtmosphere(p, frame, now);
  p.push();
  frame.cells.forEach((cell) => {
    if (cell.alive) drawGrain(p, cell, now);
  });
  drawAnswers(p, frame);
  drawScars(p, frame);
  drawActivePath(p);
  p.pop();

  if (stageReadout) stageReadout.textContent = state === 'visitor-rake'
    ? 'rake registered / the far grain is answering'
    : state === 'rake-lifted'
      ? 'latest scar lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} scar${frame.memory.length === 1 ? '' : 's'} held · ${frame.removedCount} grains removed`;
  if (interactionState) interactionState.textContent = state === 'visitor-rake'
    ? 'The cut is open; a distant cluster is carrying the answer.'
    : state === 'rake-lifted'
      ? 'The latest scar is gone; the prior grain field is exact.'
      : state === 'rake-refused'
        ? 'A tap is not a rake. The field did not move.'
        : 'The grains are holding their first surface.';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.removed = String(frame.removedCount);
    field.dataset.interaction = state;
  }
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function renderCurrent(p, now = performance.now()) {
  currentFrame = interactionFrame || (frozen ? timeline.at(-1) : frameAt(now));
  render(p, currentFrame, interactionFrame?.interaction ?? 'sequence', now);
}

function commitRake(p, path) {
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = rakeField(baseline, { path });
  renderCurrent(p);
  if (frozen) p.redraw();
}

function commitDefaultRake(p) {
  commitRake(p, [
    { x: 0.18, y: 0.66 },
    { x: 0.42, y: 0.54 },
    { x: 0.7, y: 0.62 },
    { x: 0.82, y: 0.48 }
  ]);
}

function liftLatest(p) {
  if (!interactionFrame) return;
  interactionFrame = liftLatestRake(interactionFrame);
  renderCurrent(p);
  if (frozen) p.redraw();
}

function releaseField(p) {
  interactionFrame = null;
  startedAt = performance.now();
  renderCurrent(p);
  if (frozen) p.redraw();
}

function normalizedPointer(event, canvasElement) {
  const bounds = canvasElement.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width)),
    y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height))
  };
}

function pathDistance(path) {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  }
  return length;
}

const sketch = (p) => {
  p.setup = () => {
    const bounds = field.getBoundingClientRect();
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height), p.P2D);
    canvas.parent('grain-field');
    canvas.id('grain-canvas');
    canvas.elt.tabIndex = 0;
    canvas.elt.setAttribute('aria-label', 'Interactive grain lattice canvas');

    canvas.elt.addEventListener('pointerdown', (event) => {
      if (staticPreview) return;
      isDragging = true;
      pointerId = event.pointerId;
      activePath = [normalizedPointer(event, canvas.elt)];
      canvas.elt.setPointerCapture?.(pointerId);
      renderCurrent(p);
      if (frozen) p.redraw();
    });
    canvas.elt.addEventListener('pointermove', (event) => {
      if (!isDragging || event.pointerId !== pointerId) return;
      const point = normalizedPointer(event, canvas.elt);
      const last = activePath.at(-1);
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.008) activePath.push(point);
      renderCurrent(p);
      if (frozen) p.redraw();
    });
    canvas.elt.addEventListener('pointerup', (event) => {
      if (!isDragging || event.pointerId !== pointerId) return;
      const completedPath = activePath.slice();
      isDragging = false;
      pointerId = null;
      activePath = [];
      if (pathDistance(completedPath) >= 0.08) commitRake(p, completedPath);
      else {
        interactionFrame = { ...(interactionFrame || currentFrame), interaction: 'rake-refused' };
        renderCurrent(p);
        if (frozen) p.redraw();
      }
      canvas.elt.releasePointerCapture?.(event.pointerId);
    });
    canvas.elt.addEventListener('pointercancel', () => {
      isDragging = false;
      pointerId = null;
      activePath = [];
      renderCurrent(p);
      if (frozen) p.redraw();
    });

    renderCurrent(p);
    if (frozen) p.noLoop();
  };

  p.draw = () => renderCurrent(p, performance.now());

  p.keyPressed = () => {
    if (staticPreview) return false;
    if (p.key === 'Enter' || p.key === ' ') commitDefaultRake(p);
    if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) liftLatest(p);
    if (p.key && p.key.toLowerCase() === 'r') releaseField(p);
    if (p.key && p.key.toLowerCase() === 's') p.saveCanvas('mutine-brush-v021', 'png');
    return false;
  };

  p.windowResized = () => {
    const bounds = field.getBoundingClientRect();
    p.resizeCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height));
    renderCurrent(p);
    if (frozen) p.redraw();
  };
};

const instance = new window.p5(sketch);
rakeControl?.addEventListener('click', () => commitDefaultRake(instance));
liftControl?.addEventListener('click', () => liftLatest(instance));
releaseControl?.addEventListener('click', () => releaseField(instance));
