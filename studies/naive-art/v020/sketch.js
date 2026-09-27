import {
  STAGES,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestPress,
  pressPlate
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4300;

const pressSheet = document.querySelector('#press-sheet');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressControl = document.querySelector('#press-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');

const palette = {
  ground: '#e8ddc5',
  groundLight: '#f2ead8',
  ink: '#242033',
  red: '#d95c4f',
  saffron: '#e5aa47',
  green: '#4f8c82',
  blue: '#54799a',
  violet: '#8d78a9',
  shadow: 'rgba(20,18,35,.22)',
  chalk: 'rgba(244,234,216,.62)'
};

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];

function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : currentFrame);
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.memory.length,
    engineMemory: frame.memory.length,
    cavities: frame.scene.materialTrace.cavityCount,
    reliefs: frame.scene.materialTrace.reliefCount,
    registerGap: frame.scene.register.gap,
    registerOffset: frame.scene.register.offset,
    pointerOnlyChanges: frame.scene.materialTrace.pointerOnlyChanges,
    geometryChanges: frame.scene.materialTrace.geometryChanges,
    interaction: interactionFrame?.interaction ?? 'sequence',
    geometrySignature: geometrySignature(frame)
  };
}

window.__mutineNaiveV020 = { getState: stateSnapshot };
pressSheet.dataset.witness = 'wrong-pressure';

if (staticPreview) {
  pressSheet.tabIndex = -1;
  pressSheet.removeAttribute('aria-keyshortcuts');
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function drawTexture(p, width, height) {
  p.push();
  p.noStroke();
  for (let index = 0; index < 360; index += 1) {
    const x = (index * 149 + 17) % width;
    const y = (index * 241 + 29) % height;
    const alpha = index % 9 === 0 ? 0.20 : 0.06;
    p.fill(rgba(index % 4 === 0 ? palette.red : palette.ink, alpha));
    p.rect(x, y, index % 13 === 0 ? 2 : 1, index % 17 === 0 ? 2 : 1);
  }
  p.stroke(rgba(palette.ink, 0.10));
  p.strokeWeight(1);
  for (let line = 0; line < 10; line += 1) {
    const x = width * (0.08 + line * 0.09);
    p.line(x, height * 0.05, x + width * 0.006, height * 0.95);
  }
  p.pop();
}

function drawSheet(p, width, height, frame) {
  const x = width * 0.065;
  const y = height * 0.065;
  const w = width * 0.87;
  const h = height * 0.87;
  p.push();
  p.translate(width * 0.5, height * 0.5);
  p.rotate(-0.012);
  p.translate(-width * 0.5, -height * 0.5);
  p.noStroke();
  p.fill(palette.shadow);
  p.rect(x + width * 0.018, y + height * 0.024, w, h, 2);
  p.fill(palette.groundLight);
  p.rect(x, y, w, h, 2);
  p.noFill();
  p.stroke(rgba(palette.ink, 0.66));
  p.strokeWeight(Math.max(1, width * 0.0014));
  p.rect(x, y, w, h, 2);
  p.stroke(rgba(palette.ink, 0.12));
  p.line(x + w * 0.05, y + h * 0.10, x + w * 0.95, y + h * 0.10);
  p.line(x + w * 0.05, y + h * 0.90, x + w * 0.95, y + h * 0.90);
  p.pop();
  drawRegister(p, x, y, w, h, frame.scene.register, width, height);
  return { x, y, w, h };
}

function drawRegister(p, x, y, w, h, register, width, height) {
  const axisX = x + w * register.axis;
  const top = y + h * 0.13;
  const bottom = y + h * 0.87;
  const gapSize = clamp(register.gap * h * 1.5, 0, h * 0.20);
  const gapCenter = y + h * (0.50 + register.offset * 0.10);
  const firstEnd = gapCenter - gapSize * 0.5;
  const secondStart = gapCenter + gapSize * 0.5;
  p.push();
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.0022));
  p.line(axisX, top, axisX, firstEnd);
  p.line(axisX, secondStart, axisX, bottom);
  p.stroke(rgba(palette.red, 0.54));
  p.strokeWeight(Math.max(1, width * 0.0012));
  p.line(axisX + register.offset * width * 0.08, top, axisX + register.offset * width * 0.08, firstEnd - height * 0.012);
  p.line(axisX + register.offset * width * 0.08, secondStart + height * 0.012, axisX + register.offset * width * 0.08, bottom);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(1, width * 0.001));
  for (let index = 0; index < 9; index += 1) {
    const tickY = top + (bottom - top) * index / 8;
    if (tickY > firstEnd && tickY < secondStart) continue;
    p.line(axisX - width * 0.012, tickY, axisX + width * 0.012, tickY);
  }
  if (register.seam > 0.01) {
    p.stroke(palette.red);
    p.strokeWeight(Math.max(3, width * 0.0032));
    p.line(axisX - width * 0.018, gapCenter, axisX + width * (0.05 + register.seam * 0.12), gapCenter + register.seam * height * 0.12);
  }
  p.pop();
}

function plateOrigin(plate, sheet) {
  return {
    x: sheet.x + plate.x * sheet.w + plate.shift.x * sheet.w,
    y: sheet.y + plate.y * sheet.h + plate.shift.y * sheet.h,
    w: plate.w * sheet.w * (1 + plate.relief * 0.32),
    h: plate.h * sheet.h * (1 + plate.relief * 0.26)
  };
}

function outerVertices(p, motif, width, height, relief) {
  const bulge = relief * 0.18;
  if (motif === 'star') {
    const points = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 === 0 ? 0.50 + bulge : 0.22 + bulge * 0.3;
      points.push({ x: Math.cos(angle) * width * radius, y: Math.sin(angle) * height * radius });
    }
    return points;
  }
  if (motif === 'arch') return [
    { x: -width * 0.48, y: height * 0.46 }, { x: -width * 0.44, y: -height * 0.10 },
    { x: -width * 0.28, y: -height * (0.43 + bulge) }, { x: width * 0.08, y: -height * (0.50 + bulge) },
    { x: width * 0.40, y: -height * 0.22 }, { x: width * 0.47, y: height * 0.46 }
  ];
  if (motif === 'kite') return [
    { x: 0, y: -height * (0.52 + bulge) }, { x: width * 0.48, y: -height * 0.03 },
    { x: width * 0.10, y: height * 0.52 }, { x: -width * 0.47, y: height * 0.08 }
  ];
  if (motif === 'cup') return [
    { x: -width * 0.45, y: -height * 0.36 }, { x: width * 0.45, y: -height * 0.36 },
    { x: width * 0.34, y: height * (0.28 + bulge) }, { x: width * 0.12, y: height * 0.47 },
    { x: -width * 0.20, y: height * 0.45 }, { x: -width * 0.37, y: height * 0.18 }
  ];
  return [
    { x: -width * 0.52, y: height * 0.38 }, { x: -width * 0.36, y: -height * 0.28 },
    { x: -width * 0.10, y: -height * (0.45 + bulge) }, { x: width * 0.18, y: -height * 0.30 },
    { x: width * 0.53, y: height * 0.38 }
  ];
}

function drawMotifPath(p, motif, width, height, relief = 0, cavity = 0) {
  const points = outerVertices(p, motif, width, height, relief);
  p.beginShape();
  points.forEach((point) => p.vertex(point.x, point.y));
  if (cavity > 0.01) {
    const cx = width * (motif === 'kite' ? 0.08 : 0.16);
    const cy = height * (motif === 'star' ? 0.10 : 0.18);
    const rx = width * (0.10 + cavity * 0.12);
    const ry = height * (0.09 + cavity * 0.14);
    p.beginContour();
    for (let index = 10; index >= 0; index -= 1) {
      const angle = Math.PI * 2 * index / 10;
      p.vertex(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    p.endContour();
  }
  p.endShape(p.CLOSE);
}

function drawCavity(p, motif, width, height, cavity) {
  if (cavity <= 0.01) return;
  const cx = width * (motif === 'kite' ? 0.08 : 0.16);
  const cy = height * (motif === 'star' ? 0.10 : 0.18);
  const rx = width * (0.10 + cavity * 0.12);
  const ry = height * (0.09 + cavity * 0.14);
  p.push();
  p.fill(palette.groundLight);
  p.stroke(rgba(palette.ink, 0.52));
  p.strokeWeight(Math.max(1, width * 0.012));
  p.ellipse(cx, cy, rx * 2, ry * 2);
  p.noStroke();
  p.fill(rgba(palette.red, 0.16));
  p.ellipse(cx - rx * 0.16, cy - ry * 0.18, rx * 0.55, ry * 0.44);
  p.pop();
}

function drawRelief(p, plate, width, height) {
  if (plate.relief <= 0.01) return;
  const amount = plate.relief * Math.min(width, height) * 0.18;
  p.push();
  p.translate(amount * 0.42, amount * 0.25);
  p.noFill();
  p.stroke(rgba(plate.color, 0.46));
  p.strokeWeight(Math.max(3, Math.min(width, height) * 0.035));
  drawMotifPath(p, plate.motif, width * 0.98, height * 0.98, plate.relief * 0.7, 0);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(1, Math.min(width, height) * 0.008));
  p.line(width * 0.08, height * 0.49, width * (0.34 + plate.relief * 0.18), height * (0.49 - plate.relief * 0.20));
  p.pop();
}

function drawPlate(p, plate, sheet) {
  const origin = plateOrigin(plate, sheet);
  p.push();
  p.translate(origin.x, origin.y);
  p.rotate(plate.skew);
  const shadowOffset = Math.min(origin.w, origin.h) * 0.10;
  p.push();
  p.translate(shadowOffset, shadowOffset);
  p.noStroke();
  p.fill(palette.shadow);
  drawMotifPath(p, plate.motif, origin.w, origin.h, plate.relief, 0);
  p.pop();
  drawRelief(p, plate, origin.w, origin.h);
  p.noStroke();
  p.fill(plate.color);
  drawMotifPath(p, plate.motif, origin.w, origin.h, plate.relief, plate.cavity);
  drawCavity(p, plate.motif, origin.w, origin.h, plate.cavity);
  p.noFill();
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, Math.min(origin.w, origin.h) * 0.028));
  drawMotifPath(p, plate.motif, origin.w, origin.h, plate.relief, 0);
  p.stroke(rgba(palette.groundLight, 0.54));
  p.strokeWeight(Math.max(1, Math.min(origin.w, origin.h) * 0.010));
  p.line(-origin.w * 0.32, origin.h * 0.35, origin.w * 0.25, origin.h * 0.25);
  p.pop();
}

function drawPlateMarks(p, sheet, frame) {
  p.push();
  p.stroke(rgba(palette.ink, 0.42));
  p.strokeWeight(Math.max(1, p.width * 0.001));
  const marks = [
    [sheet.x + sheet.w * 0.08, sheet.y + sheet.h * 0.08],
    [sheet.x + sheet.w * 0.92, sheet.y + sheet.h * 0.08],
    [sheet.x + sheet.w * 0.08, sheet.y + sheet.h * 0.92],
    [sheet.x + sheet.w * 0.92, sheet.y + sheet.h * 0.92]
  ];
  marks.forEach(([x, y], index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    p.line(x, y, x + direction * p.width * 0.025, y);
    p.line(x, y, x, y + (index < 2 ? 1 : -1) * p.height * 0.025);
  });
  if (frame.scene.register.pressure > 0.01) {
    p.noFill();
    p.stroke(palette.red);
    p.strokeWeight(Math.max(2, p.width * 0.002));
    p.arc(sheet.x + sheet.w * 0.80, sheet.y + sheet.h * 0.16, sheet.w * 0.11, sheet.h * 0.08, -0.8, 1.7);
  }
  p.pop();
}

function render(p, frame, state = 'sequence') {
  const width = p.width;
  const height = p.height;
  p.background(palette.ground);
  drawTexture(p, width, height);
  const sheet = drawSheet(p, width, height, frame);
  frame.scene.plates.forEach((plate) => drawPlate(p, plate, sheet));
  drawPlateMarks(p, sheet, frame);

  if (stageReadout) stageReadout.textContent = state === 'visitor-pressure'
    ? 'wrong pressure remembered'
    : state === 'pressure-lifted'
      ? 'latest pressure undone'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure${frame.memory.length === 1 ? '' : 's'} held`;
  pressSheet.dataset.stage = String(frame.stage);
  pressSheet.dataset.memory = String(frame.memory.length);
  pressSheet.dataset.cavities = String(frame.scene.materialTrace.cavityCount);
  pressSheet.dataset.reliefs = String(frame.scene.materialTrace.reliefCount);
  pressSheet.dataset.registerGap = String(frame.scene.register.gap);
  pressSheet.dataset.interaction = state;
  if (undoControl) undoControl.disabled = frame.memory.length === 0;
}

function renderCurrent(p, now = performance.now()) {
  if (interactionFrame) {
    currentFrame = interactionFrame;
    render(p, interactionFrame, interactionFrame.interaction ?? 'visitor-pressure');
    return;
  }
  currentFrame = frozen ? timeline.at(-1) : frameAt(now);
  render(p, currentFrame, 'sequence');
}

function commitPress(p, direction = 1) {
  if (staticPreview) return;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = pressPlate(baseline, { direction });
  renderCurrent(p);
}

function liftLatest(p) {
  if (staticPreview) return;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = liftLatestPress(baseline);
  renderCurrent(p);
}

function releaseSheet(p) {
  if (staticPreview) return;
  interactionFrame = null;
  startedAt = performance.now();
  currentFrame = timeline[0];
  renderCurrent(p);
}

const sketch = (p) => {
  p.setup = () => {
    const bounds = pressSheet.getBoundingClientRect();
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height), p.P2D);
    canvas.parent('press-sheet');
    canvas.id('press-sheet-canvas');
    canvas.elt.tabIndex = staticPreview ? -1 : 0;
    canvas.elt.setAttribute('aria-label', 'Interactive wrong-pressure print sheet canvas');
    renderCurrent(p);
    if (frozen) p.noLoop();
  };

  p.draw = () => renderCurrent(p, performance.now());

  p.mousePressed = () => false;
  p.mouseWheel = () => false;

  p.keyPressed = () => {
    if (staticPreview) return false;
    if (p.key === 'Enter' || p.keyCode === 13 || p.key === ' ') commitPress(p, 1);
    else if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) liftLatest(p);
    else if (p.key && p.key.toLowerCase() === 'r') releaseSheet(p);
    else if (p.key && p.key.toLowerCase() === 's') p.saveCanvas('mutine-naive-v020', 'png');
    return false;
  };

  p.windowResized = () => {
    const bounds = pressSheet.getBoundingClientRect();
    p.resizeCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height));
    renderCurrent(p);
  };
};

const instance = new window.p5(sketch);
pressControl?.addEventListener('click', () => commitPress(instance, 1));
undoControl?.addEventListener('click', () => liftLatest(instance));
releaseControl?.addEventListener('click', () => releaseSheet(instance));
