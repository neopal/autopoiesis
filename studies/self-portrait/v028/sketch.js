import {
  STAGES,
  buildTimeline,
  commitGesture,
  liftLatestGesture,
  releaseGrammar,
  geometrySignature,
  RULE_NAMES
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview || blindMode;
const timeline = buildTimeline();
const STAGE_MS = 3300;
const stage = document.querySelector('[data-fold-volume]');
const mount = document.querySelector('#fold-volume-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const ruleReadout = document.querySelector('[data-rule]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const guide = document.querySelector('[data-gesture-guide]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const palette = {
  bg: [224, 42, 6],
  deep: [226, 44, 3],
  paper: [44, 22, 91],
  paperWarm: [31, 20, 76],
  coral: [10, 62, 91],
  cyan: [176, 47, 84],
  acid: [59, 44, 87],
  violet: [258, 35, 86],
  ink: [226, 37, 12]
};
const deterministicPaths = [
  [[-0.82, -0.34], [-0.32, 0.28], [0.08, -0.18], [0.76, 0.34]],
  [[-0.75, 0.46], [-0.25, -0.22], [0.22, 0.42], [0.78, -0.38]],
  [[-0.7, -0.46], [-0.22, 0.1], [0.16, -0.4], [0.72, 0.24]],
  [[-0.78, 0.22], [-0.34, -0.34], [0.2, 0.18], [0.74, 0.46]]
];
let startedAt = performance.now();
let currentFrame = frozen ? timeline.at(-1) : timeline[0];
let interactionFrame = null;
let lastPaintedSignature = '';
let gesturePoints = [];
let dragging = false;
let pointerId = null;
let p5Sketch = null;

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function updateInterface(frame) {
  const signature = geometrySignature(frame);
  if (signature === lastPaintedSignature && frame.interaction === currentFrame.interaction) return;
  lastPaintedSignature = signature;
  if (stageReadout) stageReadout.textContent = frame.interaction === 'grammar-fold' ? 'grammar-fold opened' : frame.interaction === 'gesture-refused' ? 'gesture too quiet' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} grammar fold${frame.memory.length === 1 ? '' : 's'}`;
  if (ruleReadout) ruleReadout.textContent = `rule ${RULE_NAMES[frame.ruleIndex]}`;
  if (hint) hint.textContent = frame.interaction === 'gesture-refused'
    ? 'the grammar needs a longer sentence'
    : gesturePoints.length
      ? `${gesturePoints.length} points held; release to parse`
      : 'drag a crooked sentence; release to let the grammar answer';
  if (stateReadout) stateReadout.textContent = frame.interaction === 'grammar-fold'
    ? `The gesture changed the volume. Rule ${RULE_NAMES[frame.ruleIndex]} will read the next one.`
    : frame.interaction === 'gesture-refused'
      ? 'A short gesture cannot change the grammar.'
      : 'The volume is waiting for a sentence.';
  if (guide) guide.classList.toggle('is-active', gesturePoints.length > 0);
  if (stage) {
    stage.dataset.stage = String(frame.stage);
    stage.dataset.memory = String(frame.memory.length);
    stage.dataset.rule = RULE_NAMES[frame.ruleIndex];
    stage.dataset.interaction = frame.interaction;
    stage.dataset.signature = signature;
  }
}

function pointFromEvent(event) {
  const rect = stage.getBoundingClientRect();
  return [
    Number((((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(5)),
    Number((((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(5))
  ];
}

function deterministicPath() {
  const index = (currentFrame.memory.length + currentFrame.ruleIndex) % deterministicPaths.length;
  return deterministicPaths[index].map((point) => point.slice());
}

function baseForInteraction() {
  return interactionFrame ?? activeFrameAt();
}

function paintInteraction(frame) {
  interactionFrame = frame;
  currentFrame = frame;
  updateInterface(frame);
}

function commitPath(points) {
  if (staticPreview || blindMode) return;
  paintInteraction(commitGesture(baseForInteraction(), { points }));
}

function lift() {
  if (staticPreview || blindMode) return;
  paintInteraction(liftLatestGesture(baseForInteraction()));
}

function release() {
  if (staticPreview || blindMode) return;
  interactionFrame = releaseGrammar(0);
  currentFrame = interactionFrame;
  startedAt = performance.now();
  gesturePoints = [];
  updateInterface(currentFrame);
}

function handlePointerDown(event) {
  if (staticPreview || blindMode || event.target.closest('button')) return;
  dragging = true;
  pointerId = event.pointerId;
  gesturePoints = [pointFromEvent(event)];
  stage.setPointerCapture?.(pointerId);
  updateInterface(baseForInteraction());
  event.preventDefault();
}

function handlePointerMove(event) {
  if (!dragging || event.pointerId !== pointerId) return;
  const point = pointFromEvent(event);
  const previous = gesturePoints.at(-1);
  if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.025) gesturePoints.push(point);
  updateInterface(baseForInteraction());
  event.preventDefault();
}

function handlePointerUp(event) {
  if (!dragging || event.pointerId !== pointerId) return;
  dragging = false;
  pointerId = null;
  stage.releasePointerCapture?.(event.pointerId);
  const points = gesturePoints.slice();
  gesturePoints = [];
  commitPath(points);
  updateInterface(currentFrame);
  event.preventDefault();
}

function handleKeyDown(event) {
  if (staticPreview || blindMode) return;
  if (event.code === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    commitPath(deterministicPath());
  } else if (event.code === 'Delete') {
    event.preventDefault();
    lift();
  } else if (event.code === 'KeyR' || event.code === 'Escape') {
    event.preventDefault();
    release();
  }
}

function hsb(p, value, alpha = 100) {
  p.fill(value[0], value[1], value[2], alpha);
}

function strokeHsb(p, value, alpha = 100) {
  p.stroke(value[0], value[1], value[2], alpha);
}

function drawPlate(p, plate, unit, seconds) {
  const width = plate.width * unit * 0.48;
  const height = plate.height * unit * 0.44;
  const foldZ = plate.fold * unit * 0.12;
  const body = plate.state === 'hinge' ? palette.coral : plate.state === 'counterfold' ? palette.cyan : plate.state === 'relay' ? palette.acid : plate.index % 3 === 0 ? palette.paper : palette.paperWarm;
  const edge = plate.state === 'quiet' ? palette.violet : body;
  const breathing = reducedMotion ? 0 : Math.sin(seconds * 0.42 + plate.phase) * unit * 0.004;

  p.push();
  p.translate(plate.x * unit * 0.62 + breathing, plate.y * unit * 0.46, plate.z * unit * 0.34);
  p.rotateX(Math.sin(plate.phase + seconds * 0.07) * 0.04);
  p.rotateY(plate.tilt + plate.fold * 0.16);
  p.rotateZ(plate.fold * 0.22);
  p.noStroke();
  hsb(p, palette.deep, 46);
  p.push();
  p.translate(unit * 0.012, unit * 0.018, -unit * 0.018);
  p.box(width * 1.04, height * 1.03, unit * 0.025);
  p.pop();

  hsb(p, body, 88);
  p.beginShape(p.QUADS);
  p.vertex(-width, -height, 0);
  p.vertex(0, -height * 0.92, foldZ);
  p.vertex(0, height * 0.92, foldZ);
  p.vertex(-width, height, 0);
  p.endShape();

  hsb(p, body, 72);
  p.beginShape(p.QUADS);
  p.vertex(0, -height * 0.92, foldZ);
  p.vertex(width, -height * 0.68, -foldZ * 0.62);
  p.vertex(width * 0.88, height * 0.74, -foldZ * 0.62);
  p.vertex(0, height * 0.92, foldZ);
  p.endShape();

  strokeHsb(p, edge, 64);
  p.strokeWeight(Math.max(1, unit * 0.002));
  p.noFill();
  p.beginShape();
  p.vertex(-width, -height, unit * 0.006);
  p.vertex(0, -height * 0.92, foldZ + unit * 0.006);
  p.vertex(width, -height * 0.68, -foldZ * 0.62 + unit * 0.006);
  p.vertex(width * 0.88, height * 0.74, -foldZ * 0.62 + unit * 0.006);
  p.vertex(0, height * 0.92, foldZ + unit * 0.006);
  p.vertex(-width, height, unit * 0.006);
  p.endShape(p.CLOSE);

  if (plate.state !== 'quiet' || plate.crease > 0.66) {
    strokeHsb(p, edge, plate.state === 'quiet' ? 34 : 88);
    p.strokeWeight(Math.max(1, unit * 0.003));
    p.line(0, -height * 0.92, foldZ + unit * 0.012, 0, height * 0.92, foldZ + unit * 0.012);
  }
  p.pop();
}

function drawVolume(p, frame, now) {
  const seconds = now * 0.001;
  const unit = Math.min(p.width, p.height);
  p.background(...palette.bg);
  p.ambientLight(0, 0, 26);
  p.directionalLight(45, 35, 72, -0.5, -0.35, -1);
  p.pointLight(170, 42, 88, -unit * 0.42, -unit * 0.34, unit * 0.64);
  p.pointLight(190, 34, 76, unit * 0.42, unit * 0.24, unit * 0.38);

  p.push();
  p.translate(0, 0, -unit * 0.08);
  p.rotateX(-0.16);
  p.rotateY(reducedMotion ? 0.09 : Math.sin(seconds * 0.16) * 0.13);
  p.rotateZ(-0.045 + frame.ruleIndex * 0.011);

  hsb(p, palette.violet, 8);
  p.push();
  p.translate(0, 0, -unit * 0.42);
  p.rotateZ(-0.12);
  p.plane(unit * 1.55, unit * 0.86);
  p.pop();

  const ordered = [...frame.plates].sort((a, b) => a.z - b.z);
  ordered.forEach((plate) => drawPlate(p, plate, unit, seconds));

  hsb(p, palette.ink, 68);
  p.push();
  p.translate(0, unit * 0.02, unit * 0.02);
  p.rotateZ(-0.04);
  p.box(unit * 0.018, unit * 0.86, unit * 0.018);
  p.pop();

  if (gesturePoints.length > 1) {
    p.push();
    p.translate(0, 0, unit * 0.46);
    strokeHsb(p, palette.acid, 84);
    p.strokeWeight(Math.max(1, unit * 0.004));
    p.noFill();
    p.beginShape();
    gesturePoints.forEach(([x, y]) => p.vertex(x * unit * 0.34, y * unit * 0.28, Math.sin(x * 3 + y * 2) * unit * 0.015));
    p.endShape();
    p.pop();
  }
  p.pop();
}

function startSketch() {
  const P5 = window.p5;
  if (!P5 || !mount) return;
  p5Sketch = new P5((p) => {
    p.setup = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      p.pixelDensity(1);
      p.createCanvas(width, height, p.WEBGL);
      p.colorMode(p.HSB, 360, 100, 100, 100);
      p.setAttributes('antialias', true);
      updateInterface(currentFrame);
    };
    p.draw = () => {
      const frame = activeFrameAt();
      if (frame !== currentFrame) {
        currentFrame = frame;
        updateInterface(frame);
      }
      drawVolume(p, frame, performance.now());
    };
    p.windowResized = () => {
      p.resizeCanvas(Math.max(1, mount.clientWidth), Math.max(1, mount.clientHeight));
    };
  }, mount);
}

stage.addEventListener('pointerdown', handlePointerDown);
stage.addEventListener('pointermove', handlePointerMove);
stage.addEventListener('pointerup', handlePointerUp);
stage.addEventListener('pointercancel', handlePointerUp);
stage.addEventListener('keydown', handleKeyDown);
actionButtons.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.action === 'fold') commitPath(deterministicPath());
  if (button.dataset.action === 'lift') lift();
  if (button.dataset.action === 'release') release();
}));

window.__mutinePortraitV028 = {
  getState: () => ({
    frame: JSON.parse(JSON.stringify(currentFrame)),
    signature: geometrySignature(currentFrame),
    gesturePoints: gesturePoints.map((point) => point.slice()),
    reducedMotion,
    staticPreview,
    blindMode
  }),
  commit: () => commitPath(deterministicPath()),
  lift,
  release,
  geometrySignature
};

updateInterface(currentFrame);
startSketch();
