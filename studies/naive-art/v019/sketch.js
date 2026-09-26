import {
  STAGES,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestStep,
  stepWeather
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4100;

const panorama = document.querySelector('#panorama');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const stepControl = document.querySelector('#step-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');

const palette = {
  paper: '#efe6d1',
  paperLight: '#f7f0df',
  ink: '#1e2940',
  red: '#c74e49',
  saffron: '#f0bd4d',
  green: '#4c8c80',
  blue: '#557ca2',
  violet: '#7c84b3',
  shadow: 'rgba(30,41,64,.16)',
  chalk: 'rgba(247,240,223,.56)'
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
    openedForms: frame.scene.materialTrace.openedForms,
    borrowedForms: frame.scene.materialTrace.borrowedForms,
    wrongHorizon: frame.scene.horizon.wrongSlope,
    pointerOnlyChanges: frame.scene.materialTrace.pointerOnlyChanges,
    stepChanges: frame.scene.materialTrace.stepChanges,
    interaction: interactionFrame?.interaction ?? 'sequence',
    geometrySignature: geometrySignature(frame)
  };
}

window.__mutineNaiveV019 = { getState: stateSnapshot };
panorama.dataset.witness = 'second-horizon';

if (staticPreview) {
  panorama.tabIndex = -1;
  panorama.removeAttribute('aria-keyshortcuts');
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function drawTexture(p, width, height) {
  p.push();
  p.noStroke();
  for (let index = 0; index < 420; index += 1) {
    const x = (index * 137 + 31) % width;
    const y = (index * 223 + 17) % height;
    const alpha = index % 7 === 0 ? 0.18 : 0.07;
    p.fill(rgba(index % 5 === 0 ? palette.red : palette.ink, alpha));
    p.rect(x, y, index % 11 === 0 ? 2 : 1, index % 13 === 0 ? 2 : 1);
  }
  p.stroke(rgba(palette.ink, 0.08));
  p.strokeWeight(1);
  for (let line = 0; line < 12; line += 1) {
    const y = height * (0.08 + line * 0.08);
    p.line(0, y, width, y + Math.sin(line * 1.7) * height * 0.008);
  }
  p.pop();
}

function drawSky(p, width, height, frame) {
  for (let row = 0; row < height; row += 2) {
    const ratio = row / Math.max(height, 1);
    const r = 247 - Math.round(ratio * 22);
    const g = 240 - Math.round(ratio * 29);
    const b = 223 - Math.round(ratio * 18);
    p.stroke(r, g, b);
    p.line(0, row, width, row);
  }
  p.noStroke();
  p.fill(rgba(palette.saffron, 0.08));
  p.ellipse(width * 0.12, height * 0.13, width * 0.60, height * 0.36);
  p.fill(rgba(palette.blue, 0.08));
  p.ellipse(width * 0.88, height * 0.22, width * 0.46, height * 0.30);
  p.stroke(rgba(palette.ink, 0.11));
  p.strokeWeight(Math.max(1, width * 0.0012));
  for (let line = 0; line < 5; line += 1) {
    const y = height * (0.44 + line * 0.04) + frame.scene.horizon.wrongSlope * height * (line - 2) * 0.28;
    p.line(width * 0.06, y, width * 0.94, y + frame.scene.horizon.wrongSlope * width * 0.18);
  }
}

function horizonY(horizon, x, width, height) {
  const center = x - width * 0.5;
  return height * 0.70 + horizon.slope * center + horizon.wrongSlope * center * 0.22;
}

function drawHorizon(p, frame, width, height) {
  const horizon = frame.scene.horizon;
  const top = [];
  const steps = 14;
  for (let index = 0; index <= steps; index += 1) {
    const x = (index / steps) * width;
    const baseY = horizonY(horizon, x, width, height);
    const centerBend = Math.exp(-Math.pow((x / width - 0.53) * 5.5, 2)) * horizon.notch * height * 1.9;
    const lifted = Math.exp(-Math.pow((x / width - 0.80) * 8, 2)) * horizon.lift * height * 1.2;
    top.push({ x, y: baseY - centerBend + lifted });
  }
  p.push();
  p.noStroke();
  p.fill(palette.green);
  p.beginShape();
  top.forEach((point) => p.vertex(point.x, point.y));
  p.vertex(width, height);
  p.vertex(0, height);
  p.endShape(p.CLOSE);
  p.fill(rgba(palette.blue, 0.34));
  p.beginShape();
  top.forEach((point, index) => p.vertex(point.x, point.y + height * (0.035 + (index % 3) * 0.005)));
  p.vertex(width, height);
  p.vertex(0, height);
  p.endShape(p.CLOSE);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.003));
  p.noFill();
  p.beginShape();
  top.forEach((point) => p.vertex(point.x, point.y));
  p.endShape();
  if (horizon.borrowedSegment > 0.01) {
    p.stroke(palette.red);
    p.strokeWeight(Math.max(3, width * 0.005));
    p.beginShape();
    p.vertex(width * 0.38, horizonY(horizon, width * 0.38, width, height) - height * 0.012);
    p.vertex(width * 0.55, horizonY(horizon, width * 0.55, width, height) - horizon.borrowedSegment * height * 0.26);
    p.vertex(width * 0.72, horizonY(horizon, width * 0.72, width, height) + height * 0.012);
    p.endShape();
  }
  p.pop();
}

function drawSun(p, form, width, height) {
  const radius = Math.min(width, height) * 0.095 * form.scale;
  const opening = clamp(form.opening * 2.3, 0, Math.PI * 0.78);
  p.push();
  p.translate(form.x * width + form.shift.x * width, form.y * height + form.shift.y * height);
  p.rotate(form.angle);
  p.noFill();
  p.stroke(form.color);
  p.strokeWeight(Math.max(4, width * 0.007));
  p.arc(0, 0, radius * 2, radius * 2, opening * 0.55, Math.PI * 2 - opening * 0.45);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.003));
  const rays = 10;
  for (let index = 0; index < rays; index += 1) {
    const angle = index * Math.PI * 2 / rays;
    if (opening > 0.01 && angle > 4.55 && angle < 5.85) continue;
    p.line(Math.cos(angle) * radius * 1.23, Math.sin(angle) * radius * 1.23, Math.cos(angle) * radius * 1.52, Math.sin(angle) * radius * 1.52);
  }
  if (form.borrowedContour > 0.01) {
    p.stroke(palette.red);
    p.strokeWeight(Math.max(3, width * 0.004));
    p.line(radius * 0.24, -radius * 1.38, radius * (0.24 + form.borrowedContour * 0.60), -radius * (1.38 + form.borrowedContour * 0.28));
  }
  p.pop();
}

function drawCloud(p, form, width, height) {
  const w = width * form.w * form.scale;
  const h = height * form.h * form.scale;
  const notch = clamp(form.opening * 2.6, 0, h * 0.44);
  p.push();
  p.translate(form.x * width + form.shift.x * width, form.y * height + form.shift.y * height);
  p.rotate(form.angle);
  p.noStroke();
  p.fill(form.color);
  p.beginShape();
  p.vertex(-w * 0.50, h * 0.28);
  p.bezierVertex(-w * 0.57, -h * 0.02, -w * 0.40, -h * 0.36, -w * 0.16, -h * 0.21);
  p.bezierVertex(-w * 0.02, -h * 0.62, w * 0.34, -h * 0.53, w * 0.38, -h * 0.12);
  p.bezierVertex(w * 0.61, -h * 0.10, w * 0.62, h * 0.18, w * 0.48, h * 0.28);
  p.vertex(w * 0.20, h * 0.28 + notch);
  p.vertex(w * 0.02, h * 0.10 + notch * 0.35);
  p.vertex(-w * 0.18, h * 0.28 + notch * 0.72);
  p.endShape(p.CLOSE);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.0025));
  p.noFill();
  p.arc(0, h * 0.12 + notch * 0.25, w * 0.66, h * 0.30, 0.10, Math.PI - 0.10);
  if (form.borrowedContour > 0.01) {
    p.stroke(palette.saffron);
    p.strokeWeight(Math.max(3, width * 0.004));
    p.arc(w * 0.10, -h * 0.10, w * 0.76, h * (0.44 + form.borrowedContour), Math.PI * 1.05, Math.PI * 1.88);
  }
  p.pop();
}

function drawHill(p, form, width, height) {
  const w = width * form.w * form.scale;
  const h = height * form.h * form.scale;
  const notch = clamp(form.opening * 2.0, 0, h * 0.54);
  p.push();
  p.translate(form.x * width + form.shift.x * width, form.y * height + form.shift.y * height);
  p.rotate(form.angle);
  p.noStroke();
  p.fill(form.color);
  p.beginShape();
  p.vertex(-w * 0.55, h * 0.45);
  p.vertex(-w * 0.25, -h * 0.16);
  p.vertex(-w * 0.05, -h * 0.43 + notch * 0.26);
  p.vertex(w * 0.14, -h * 0.12 + notch);
  p.vertex(w * 0.31, -h * 0.30 + notch * 0.42);
  p.vertex(w * 0.56, h * 0.45);
  p.endShape(p.CLOSE);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.003));
  p.noFill();
  p.beginShape();
  p.vertex(-w * 0.24, -h * 0.14);
  p.vertex(-w * 0.04, -h * 0.40 + notch * 0.26);
  p.vertex(w * 0.15, -h * 0.08 + notch);
  p.vertex(w * 0.32, -h * 0.28 + notch * 0.42);
  p.endShape();
  if (form.borrowedContour > 0.01) {
    p.stroke(palette.red);
    p.strokeWeight(Math.max(3, width * 0.004));
    p.line(-w * 0.02, -h * 0.40, w * 0.20, -h * (0.30 + form.borrowedContour * 0.30));
  }
  p.pop();
}

function drawFlag(p, form, width, height) {
  const w = width * form.w * form.scale;
  const h = height * form.h * form.scale;
  const notch = clamp(form.opening * 2.1, 0, w * 0.38);
  p.push();
  p.translate(form.x * width + form.shift.x * width, form.y * height + form.shift.y * height);
  p.rotate(form.angle);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.003));
  p.line(-w * 0.30, h * 0.54, -w * 0.30, -h * 0.56);
  p.noStroke();
  p.fill(form.color);
  p.beginShape();
  p.vertex(-w * 0.27, -h * 0.48);
  p.vertex(w * 0.48, -h * 0.26);
  p.vertex(w * 0.18, 0 + notch);
  p.vertex(w * 0.48, h * 0.24);
  p.vertex(-w * 0.27, h * 0.42);
  p.endShape(p.CLOSE);
  if (form.borrowedContour > 0.01) {
    p.fill(palette.saffron);
    p.beginShape();
    p.vertex(w * 0.08, -h * 0.18);
    p.vertex(w * (0.45 + form.borrowedContour * 0.24), -h * 0.06);
    p.vertex(w * 0.16, h * 0.12);
    p.endShape(p.CLOSE);
  }
  p.pop();
}

function drawPuddle(p, form, width, height) {
  const w = width * form.w * form.scale;
  const h = height * form.h * form.scale;
  const notch = clamp(form.opening * 1.9, 0, h * 0.58);
  p.push();
  p.translate(form.x * width + form.shift.x * width, form.y * height + form.shift.y * height);
  p.rotate(form.angle);
  p.noStroke();
  p.fill(form.color);
  p.beginShape();
  p.vertex(-w * 0.53, h * 0.05);
  p.bezierVertex(-w * 0.45, -h * 0.44, w * 0.08, -h * 0.42, w * 0.52, -h * 0.02);
  p.vertex(w * 0.24, h * 0.18 + notch);
  p.vertex(-w * 0.02, h * 0.10 + notch * 0.70);
  p.vertex(-w * 0.26, h * 0.20 + notch * 0.35);
  p.endShape(p.CLOSE);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.0028));
  p.noFill();
  p.arc(0, 0, w * 0.76, h * 0.42, 0.12, Math.PI - 0.12);
  if (form.borrowedContour > 0.01) {
    p.stroke(palette.red);
    p.strokeWeight(Math.max(3, width * 0.004));
    p.arc(w * 0.08, -h * 0.06, w * 0.68, h * (0.54 + form.borrowedContour), Math.PI * 1.03, Math.PI * 1.82);
  }
  p.pop();
}

function drawMoon(p, form, width, height) {
  const radius = Math.min(width, height) * 0.075 * form.scale;
  const opening = clamp(form.opening * 2.2, 0, Math.PI * 0.66);
  p.push();
  p.translate(form.x * width + form.shift.x * width, form.y * height + form.shift.y * height);
  p.rotate(form.angle);
  p.noFill();
  p.stroke(form.color);
  p.strokeWeight(Math.max(4, width * 0.006));
  p.arc(0, 0, radius * 2, radius * 2, 0.24 + opening, Math.PI * 2 - 0.38);
  p.stroke(palette.ink);
  p.strokeWeight(Math.max(2, width * 0.0025));
  p.arc(radius * 0.16, 0, radius * 1.54, radius * 1.54, Math.PI * 1.14, Math.PI * 1.82);
  if (form.borrowedContour > 0.01) {
    p.stroke(palette.red);
    p.strokeWeight(Math.max(3, width * 0.004));
    p.line(-radius * 0.68, radius * 0.46, -radius * (0.68 + form.borrowedContour * 0.42), radius * (0.46 + form.borrowedContour * 0.30));
  }
  p.pop();
}

function drawForm(p, form, width, height) {
  if (form.kind === 'sun') drawSun(p, form, width, height);
  else if (form.kind === 'cloud') drawCloud(p, form, width, height);
  else if (form.kind === 'hill') drawHill(p, form, width, height);
  else if (form.kind === 'flag') drawFlag(p, form, width, height);
  else if (form.kind === 'puddle') drawPuddle(p, form, width, height);
  else drawMoon(p, form, width, height);
}

function render(p, frame, state = 'sequence') {
  const width = p.width;
  const height = p.height;
  p.background(palette.paper);
  drawSky(p, width, height, frame);
  drawTexture(p, width, height);
  drawHorizon(p, frame, width, height);
  frame.scene.forms.forEach((form) => drawForm(p, form, width, height));

  if (stageReadout) stageReadout.textContent = state === 'visitor-wheel-step'
    ? 'wrong weather remembered'
    : state === 'step-lifted'
      ? 'latest weather undone'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} misread${frame.memory.length === 1 ? '' : 's'} held`;
  if (interactionState) interactionState.textContent = state === 'visitor-wheel-step'
    ? 'The horizon has made room for the wrong weather.'
    : state === 'step-lifted'
      ? 'The latest misreading is gone; the preceding mural is exact.'
      : 'The weather is still in its first place.';
  panorama.dataset.stage = String(frame.stage);
  panorama.dataset.memory = String(frame.memory.length);
  panorama.dataset.opened = String(frame.scene.materialTrace.openedForms);
  panorama.dataset.borrowed = String(frame.scene.materialTrace.borrowedForms);
  panorama.dataset.wrongHorizon = String(frame.scene.horizon.wrongSlope);
  panorama.dataset.interaction = state;
  if (undoControl) undoControl.disabled = frame.memory.length === 0;
}

function renderCurrent(p, now = performance.now()) {
  if (interactionFrame) {
    currentFrame = interactionFrame;
    render(p, interactionFrame, interactionFrame.interaction ?? 'visitor-wheel-step');
    return;
  }
  currentFrame = frozen ? timeline.at(-1) : frameAt(now);
  render(p, currentFrame, 'sequence');
}

function commitStep(p, direction = 1) {
  if (staticPreview) return;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = stepWeather(baseline, { direction });
  renderCurrent(p);
}

function liftLatest(p) {
  if (staticPreview) return;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = liftLatestStep(baseline);
  renderCurrent(p);
}

function releasePanorama(p) {
  if (staticPreview) return;
  interactionFrame = null;
  startedAt = performance.now();
  currentFrame = timeline[0];
  renderCurrent(p);
}

const sketch = (p) => {
  p.setup = () => {
    const bounds = panorama.getBoundingClientRect();
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height), p.P2D);
    canvas.parent('panorama');
    canvas.id('panorama-canvas');
    canvas.elt.tabIndex = staticPreview ? -1 : 0;
    canvas.elt.setAttribute('aria-label', 'Interactive second-horizon panorama canvas');
    renderCurrent(p);
    if (frozen) p.noLoop();
  };

  p.draw = () => renderCurrent(p, performance.now());

  p.mouseWheel = (event) => {
    if (staticPreview) return false;
    commitStep(p, Number(event.delta) < 0 ? -1 : 1);
    return false;
  };

  p.keyPressed = () => {
    if (staticPreview) return false;
    if (p.keyCode === p.UP_ARROW) commitStep(p, -1);
    else if (p.keyCode === p.DOWN_ARROW) commitStep(p, 1);
    else if (p.key === 'Enter' || p.key === ' ') commitStep(p, 1);
    else if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) liftLatest(p);
    else if (p.key && p.key.toLowerCase() === 'r') releasePanorama(p);
    else if (p.key && p.key.toLowerCase() === 's') p.saveCanvas('mutine-naive-v019', 'png');
    return false;
  };

  p.windowResized = () => {
    const bounds = panorama.getBoundingClientRect();
    p.resizeCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height));
    renderCurrent(p);
  };
};

const instance = new window.p5(sketch);
stepControl?.addEventListener('click', () => commitStep(instance, 1));
undoControl?.addEventListener('click', () => liftLatest(instance));
releaseControl?.addEventListener('click', () => releasePanorama(instance));
