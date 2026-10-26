import {
  SIGNAL_COUNT,
  buildFrame,
  buildTimeline,
  geometrySignature,
  registerSignal,
  liftLatest,
  releaseField
} from './engine.mjs';

const PALETTE = {
  ground: [8, 10, 17],
  deep: [15, 20, 32],
  ink: [232, 228, 216],
  ice: [145, 210, 203],
  gold: [233, 196, 134],
  coral: [239, 146, 119],
  violet: [168, 158, 232],
  dusk: [50, 70, 104]
};
const SIGNAL_NAMES = ['north', 'east', 'south', 'west'];
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = staticMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = staticMode ? buildTimeline().at(-1) : buildFrame(0);
let selectedSignal = 0;
let stage;
let statusNode;
let stageNode;
let memoryNode;
let stateNode;
let hintNode;
let canvas;

function setup() {
  stage = document.querySelector('[data-forecast-loom]');
  statusNode = document.querySelector('[data-interaction-state]');
  stageNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  canvas = createCanvas(stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight);
  canvas.parent('loom-canvas');
  canvas.elt.setAttribute('aria-hidden', 'true');
  pixelDensity(1);
  colorMode(RGB, 255, 255, 255, 255);
  randomSeed(0x503034);
  noiseSeed(0x503034);
  bindControls();
  renderState();
  window.__mutinePortraitV034 = {
    getState: () => structuredClone(state),
    register: (signal) => commitSignal(Number(signal)),
    signal: (signal) => commitSignal(Number(signal)),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    geometrySignature: () => geometrySignature(state)
  };
  if (reducedMotion) noLoop();
}

function draw() {
  const time = reducedMotion ? 0 : millis() * 0.00016;
  drawGround(time);
  push();
  translate(width * 0.5, height * 0.52);
  const scale = Math.min(width, height) / 760;
  scaleCanvas(scale);
  drawRails(time);
  drawLoom(state, time);
  pop();
}

function drawGround(time) {
  background(...PALETTE.ground);
  noStroke();
  for (let y = 0; y < height; y += 6) {
    const blend = y / Math.max(1, height);
    fill(
      PALETTE.deep[0] + blend * 5,
      PALETTE.deep[1] + blend * 5,
      PALETTE.deep[2] + blend * 12,
      255
    );
    rect(0, y, width, 7);
  }
  push();
  translate(width * .54, height * .48);
  noFill();
  for (let ring = 0; ring < 8; ring += 1) {
    stroke(PALETTE.dusk[0], PALETTE.dusk[1], PALETTE.dusk[2], 20 - ring);
    strokeWeight(1);
    rotate((ring % 2 ? -1 : 1) * time * (0.7 + ring * .08));
    ellipse(0, 0, width * (.22 + ring * .13), height * (.16 + ring * .08));
  }
  pop();
}

function drawRails(time) {
  push();
  noFill();
  strokeWeight(1);
  for (let index = 0; index < 5; index += 1) {
    const y = -245 + index * 122;
    const sway = Math.sin(time * 1.7 + index * .8) * 5;
    stroke(PALETTE.ice[0], PALETTE.ice[1], PALETTE.ice[2], 26 - index * 3);
    beginShape();
    vertex(-345, y);
    bezierVertex(-180, y - 14 + sway, 120, y + 18 - sway, 350, y + sway);
    endShape();
  }
  pop();
}

function drawLoom(frame, time) {
  push();
  rotate(frame.loom.tilt * .16);
  translate(frame.loom.offset * 120, 0);
  drawAperture(frame, time);
  frame.ribs.forEach((rib, index) => drawRib(rib, frame, time, index));
  drawCrossWeft(frame, time);
  pop();
}

function drawAperture(frame, time) {
  push();
  noFill();
  stroke(PALETTE.gold[0], PALETTE.gold[1], PALETTE.gold[2], 28 + frame.loom.aperture * 42);
  strokeWeight(1.2);
  const widthScale = 190 + frame.loom.aperture * 130;
  const heightScale = 520 - frame.loom.tension * 120;
  rotate(-.22 + Math.sin(time) * .01);
  rectMode(CENTER);
  rect(0, 0, widthScale, heightScale, 4);
  rect(0, 0, widthScale * .75, heightScale * .9, 2);
  rectMode(CORNER);
  pop();
}

function drawRib(rib, frame, time, index) {
  const x = (index - 4.5) * 78 + rib.side * 10;
  const top = rib.y * 55 - 235;
  const bottom = top + 470 + rib.span * 70;
  const widthBase = 22 + rib.span * 52;
  const bend = rib.bend * 150;
  const sway = reducedMotion ? 0 : Math.sin(time * (0.8 + index * .04) + index) * 4;
  const color = stateColor(rib.state);

  push();
  noStroke();
  fill(color[0], color[1], color[2], rib.state === 'quiet' ? 82 : 168);
  beginShape();
  for (let step = 0; step <= 12; step += 1) {
    const progress = step / 12;
    const notch = Math.abs(progress - .5) < rib.notch * .8 ? rib.notch * 72 : 0;
    const curve = Math.sin(progress * Math.PI) * bend + sway;
    const px = x + curve - (widthBase - notch) * .5;
    const py = top + (bottom - top) * progress;
    vertex(px, py);
  }
  for (let step = 12; step >= 0; step -= 1) {
    const progress = step / 12;
    const notch = Math.abs(progress - .5) < rib.notch * .8 ? rib.notch * 72 : 0;
    const curve = Math.sin(progress * Math.PI) * bend + sway;
    const px = x + curve + (widthBase - notch) * .5;
    const py = top + (bottom - top) * progress;
    vertex(px, py);
  }
  endShape(CLOSE);

  noFill();
  stroke(color[0], color[1], color[2], rib.state === 'quiet' ? 110 : 230);
  strokeWeight(rib.state === 'quiet' ? 1.1 : 2.2);
  beginShape();
  for (let step = 0; step <= 12; step += 1) {
    const progress = step / 12;
    const curve = Math.sin(progress * Math.PI) * bend + sway;
    vertex(x + curve, top + (bottom - top) * progress);
  }
  endShape();

  if (rib.state === 'error') drawErrorNotch(x, top, bottom, rib, color);
  if (rib.state === 'counterfactual') drawCounterfactual(x, top, bottom, rib, color);
  if (rib.state === 'confirmed') drawConfirmation(x, top, bottom, rib, color);
  if (rib.state === 'witness') drawWitness(x, top, bottom, rib, color);
  pop();
}

function drawErrorNotch(x, top, bottom, rib, color) {
  push();
  stroke(PALETTE.coral[0], PALETTE.coral[1], PALETTE.coral[2], 220);
  strokeWeight(2);
  const mid = (top + bottom) * .5;
  line(x - 28, mid - 14, x + 28, mid + 14);
  line(x - 28, mid + 14, x + 28, mid - 14);
  pop();
}

function drawCounterfactual(x, top, bottom, rib, color) {
  push();
  noFill();
  stroke(PALETTE.violet[0], PALETTE.violet[1], PALETTE.violet[2], 210);
  strokeWeight(1.4);
  const offset = rib.side < 0 ? -38 : 38;
  beginShape();
  vertex(x + offset, top + 26);
  bezierVertex(x + offset * 1.6, top + 120, x - offset * .8, bottom - 120, x - offset, bottom - 26);
  endShape();
  pop();
}

function drawConfirmation(x, top, bottom, rib, color) {
  push();
  stroke(PALETTE.gold[0], PALETTE.gold[1], PALETTE.gold[2], 210);
  strokeWeight(1.5);
  const inset = 10 + rib.split * 12;
  line(x - inset, top + 35, x - inset * .5, bottom - 35);
  line(x + inset, top + 35, x + inset * .5, bottom - 35);
  pop();
}

function drawWitness(x, top, bottom, rib, color) {
  push();
  stroke(PALETTE.ice[0], PALETTE.ice[1], PALETTE.ice[2], 150);
  strokeWeight(1);
  const y = (top + bottom) * .5;
  line(x - 24, y, x + 24, y);
  pop();
}

function drawCrossWeft(frame, time) {
  push();
  noFill();
  stroke(PALETTE.ink[0], PALETTE.ink[1], PALETTE.ink[2], 26 + frame.loom.tension * 32);
  strokeWeight(1);
  for (let row = -2; row <= 2; row += 1) {
    const y = row * 96 + Math.sin(time * .9 + row) * 2;
    beginShape();
    vertex(-360, y);
    bezierVertex(-130, y + 20, 130, y - 18, 360, y + 8);
    endShape();
  }
  pop();
}

function stateColor(role) {
  if (role === 'confirmed') return PALETTE.gold;
  if (role === 'error') return PALETTE.coral;
  if (role === 'counterfactual') return PALETTE.violet;
  if (role === 'witness') return PALETTE.ice;
  return [100, 120, 146];
}

function scaleCanvas(factor) {
  scale(factor, factor);
}

function bindControls() {
  document.querySelectorAll('[data-signal]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.addEventListener('click', () => commitSignal(Number(button.dataset.signal)));
  });
  document.querySelector('[data-action="lift"]').addEventListener('click', liftRevision);
  document.querySelector('[data-action="release"]').addEventListener('click', releaseRevision);
  stage.addEventListener('keydown', handleKeydown);
}

function handleKeydown(event) {
  const directions = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  if (Object.hasOwn(directions, event.key)) {
    event.preventDefault();
    selectedSignal = directions[event.key];
    commitSignal(selectedSignal);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitSignal(state.forecast === null ? selectedSignal : state.forecast);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftRevision();
  } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
    event.preventDefault();
    releaseRevision();
  }
}

function commitSignal(signal) {
  selectedSignal = Number(signal);
  const result = registerSignal(state, selectedSignal);
  state = result.frame;
  renderState(result.reason || (result.accepted ? result.event.kind : state.interaction));
  redraw();
  return result;
}

function liftRevision() {
  state = liftLatest(state);
  renderState('lifted');
  redraw();
}

function releaseRevision() {
  state = releaseField(0);
  renderState('released');
  redraw();
}

function renderState(reason = state.interaction) {
  const pending = state.forecast !== null;
  stageNode.textContent = `${pending ? 'forecast held' : 'quiet loom'} / ${String(state.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${state.memory.length} decision${state.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = pending ? `the loom predicts ${SIGNAL_NAMES[state.forecast]}` : state.memory.length ? 'the loom has made a decision' : 'the portrait is not guessing yet';
  hintNode.textContent = pending ? `answer the forecast · ${SIGNAL_NAMES[state.forecast]}` : 'offer a signal · let the loom guess';
  statusNode.textContent = humanState(reason);
  document.querySelectorAll('[data-signal]').forEach((button) => {
    button.classList.toggle('is-pending', pending && Number(button.dataset.signal) === state.forecast);
    button.setAttribute('aria-pressed', pending && Number(button.dataset.signal) === state.forecast ? 'true' : 'false');
  });
}

function humanState(reason) {
  const labels = {
    'forecast-seeded': 'The first signal became a forecast. The loom has not changed.',
    'forecast-confirmed': 'The loom was right. A distant rib hardened.',
    'forecast-mismatch': 'The loom was wrong. A counterfactual split remains.',
    lifted: 'The latest decision was lifted from the loom.',
    released: 'The forecast returned to its quiet seed.',
    'invalid-signal': 'The loom refused that signal.'
  };
  return labels[reason] || labels[state.interaction] || 'The loom is waiting for a first signal.';
}

function windowResized() {
  if (!stage) return;
  resizeCanvas(stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight);
  redraw();
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
