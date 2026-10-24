import {
  DIRECTION_COUNT,
  buildFrame,
  geometrySignature,
  liftLatest,
  propose,
  releaseField
} from './engine.mjs';

const PALETTE = {
  void: [5, 8, 15],
  ink: [228, 233, 242],
  ice: [169, 215, 213],
  copper: [213, 139, 103],
  violet: [132, 114, 199],
  dusk: [52, 64, 105]
};
const DIRECTIONS = ['north', 'east', 'south', 'west'];
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = staticMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = buildFrame(0);
let selectedDirection = 0;
let sketch;
let canvas;
let stage;
let statusNode;
let stageNode;
let memoryNode;
let stateNode;
let hintNode;
let dust = [];
let p5ctx;

function rgb(values, alpha = 255) {
  return p5ctx.color(values[0], values[1], values[2], alpha);
}

function setup() {
  stage = document.querySelector('[data-hinge-of-refusal]');
  statusNode = document.querySelector('[data-interaction-state]');
  stageNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  const width = stage.clientWidth || window.innerWidth;
  const height = stage.clientHeight || window.innerHeight;
  canvas = p5ctx.createCanvas(width, height, p5ctx.WEBGL);
  canvas.parent('hinge-canvas');
  canvas.elt.setAttribute('aria-hidden', 'true');
  p5ctx.pixelDensity(1);
  p5ctx.colorMode(p5ctx.RGB, 255, 255, 255, 255);
  p5ctx.randomSeed(0x435032);
  p5ctx.noiseSeed(0x435032);
  dust = Array.from({ length: 280 }, () => ({
    x: p5ctx.random(-1, 1),
    y: p5ctx.random(-1, 1),
    z: p5ctx.random(-.8, .8),
    size: p5ctx.random(.4, 1.8),
    phase: p5ctx.random(p5ctx.TWO_PI)
  }));
  bindControls();
  publishState();
  window.__mutinePortraitV032 = {
    getState: () => structuredClone(state),
    propose: (direction) => commitProposal(Number(direction)),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    geometrySignature: () => geometrySignature(state)
  };
  sketch = this;
}

function draw() {
  const t = reducedMotion ? 0 : p5ctx.millis() * 0.00016;
  p5ctx.background(...PALETTE.void);
  drawAtmosphere(t);
  p5ctx.push();
  p5ctx.rotateX(-0.08 + Math.sin(t * 0.7) * 0.025);
  p5ctx.rotateY(-0.16 + Math.cos(t * 0.5) * 0.035);
  drawHinge(state, t);
  p5ctx.pop();
}

function drawAtmosphere(t) {
  p5ctx.push();
  p5ctx.noFill();
  p5ctx.strokeWeight(1);
  for (let ring = 0; ring < 7; ring += 1) {
    p5ctx.stroke(rgba(PALETTE.dusk, 34 - ring * 3));
    p5ctx.rotateZ(t * (ring % 2 ? -0.012 : 0.009));
    p5ctx.ellipse(0, 0, 280 + ring * 105, 150 + ring * 62);
  }
  for (const mote of dust) {
    const drift = reducedMotion ? 0 : Math.sin(t * 2.2 + mote.phase) * 0.028;
    p5ctx.push();
    p5ctx.translate(mote.x * p5ctx.width * .62, mote.y * p5ctx.height * .55 + drift * p5ctx.height, mote.z * 190 - 110);
    p5ctx.noStroke();
    p5ctx.fill(rgba(mote.phase % 2 > 1 ? PALETTE.ice : PALETTE.violet, 18 + mote.size * 7));
    p5ctx.sphere(mote.size, 4, 3);
    p5ctx.pop();
  }
  p5ctx.pop();
}

function drawHinge(frame, t) {
  let scale = Math.min(p5ctx.width, p5ctx.height) / 650;
  scale *= 1.06;
  p5ctx.push();
  scaleCanvas(scale);
  const hinge = frame.hinge;
  const breathing = reducedMotion ? 0 : Math.sin(t * 3.4) * 0.018;
  p5ctx.rotateZ((hinge.axis - 1.5) * 0.06 + breathing);
  p5ctx.translate(hinge.offset * 75, 0, 0);
  drawHalo(hinge.voidScale);
  drawWing(-1, frame, t);
  drawWing(1, frame, t);
  drawSeam(frame);
  p5ctx.pop();
}

function scaleCanvas(value) {
  p5ctx.scale(value, value, value);
}

function drawHalo(voidScale) {
  p5ctx.push();
  p5ctx.rotateX(p5ctx.HALF_PI);
  p5ctx.noFill();
  p5ctx.stroke(rgba(PALETTE.copper, 80));
  p5ctx.strokeWeight(1.2);
  p5ctx.ellipse(0, 0, 265 * voidScale, 125 * voidScale);
  p5ctx.stroke(rgba(PALETTE.ice, 28));
  p5ctx.ellipse(0, 0, 310 * voidScale, 164 * voidScale);
  p5ctx.pop();
}

function drawWing(side, frame, t) {
  const fold = frame.hinge.fold;
  const angle = side * (0.32 + fold * 0.46) + frame.hinge.angle * 0.14;
  p5ctx.push();
  p5ctx.translate(side * (145 + frame.hinge.voidScale * 16), 0, 0);
  p5ctx.rotateY(angle);
  p5ctx.rotateZ(side * 0.045 + frame.hinge.axis * 0.012);
  drawPanel(side, frame, t);
  p5ctx.pop();
}

function drawPanel(side, frame, t) {
  const halfW = 145 + frame.hinge.fold * 32;
  const halfH = 190;
  const edge = side < 0 ? -1 : 1;
  const panelColor = side < 0 ? PALETTE.ice : PALETTE.copper;
  p5ctx.push();
  p5ctx.translate(0, frame.hinge.offset * 16, 0);
  p5ctx.noStroke();
  p5ctx.fill(rgba([19, 27, 45], 235));
  p5ctx.beginShape();
  p5ctx.vertex(-halfW, -halfH, 4);
  p5ctx.vertex(halfW, -halfH + edge * 26, 4);
  p5ctx.vertex(halfW - edge * 16, halfH, 4);
  p5ctx.vertex(-halfW + edge * 30, halfH - edge * 18, 4);
  p5ctx.endShape(p5ctx.CLOSE);

  p5ctx.stroke(rgba(panelColor, 180));
  p5ctx.strokeWeight(1.5);
  p5ctx.noFill();
  p5ctx.beginShape();
  p5ctx.vertex(-halfW, -halfH, 6);
  p5ctx.vertex(halfW, -halfH + edge * 26, 6);
  p5ctx.vertex(halfW - edge * 16, halfH, 6);
  p5ctx.vertex(-halfW + edge * 30, halfH - edge * 18, 6);
  p5ctx.endShape(p5ctx.CLOSE);

  drawPanelTicks(side, halfW, halfH, panelColor);
  const start = side < 0 ? 0 : 9;
  for (let local = 0; local < 9; local += 1) {
    drawFacet(frame.facets[start + local], side, local, halfW, halfH, panelColor, t);
  }
  p5ctx.pop();
}

function drawPanelTicks(side, halfW, halfH, panelColor) {
  p5ctx.stroke(rgba(panelColor, 46));
  p5ctx.strokeWeight(1);
  for (let index = 0; index < 6; index += 1) {
    const x = -halfW + 28 + index * 45;
    p5ctx.line(x, -halfH + 12, x + side * 12, halfH - 18);
  }
  p5ctx.stroke(rgba(PALETTE.ink, 46));
  p5ctx.line(-halfW + 18, side * 24, halfW - 24, side * -18);
}

function drawFacet(facet, side, local, halfW, halfH, panelColor, t) {
  if (!facet) return;
  const column = local % 3;
  const row = Math.floor(local / 3);
  const x = -halfW + 45 + column * (halfW * .62);
  const y = -halfH + 62 + row * 108;
  const span = 28 + facet.radius * 35;
  const height = 18 + facet.height * 44;
  const flutter = reducedMotion ? 0 : Math.sin(t * 2 + facet.index) * 2.5;
  const z = 12 + facet.lift * 180;
  const accent = facet.state === 'hinged' ? PALETTE.copper : facet.state === 'refused' ? PALETTE.violet : facet.state === 'witness' ? PALETTE.ice : panelColor;
  p5ctx.push();
  p5ctx.translate(x + facet.lean * 80 + flutter, y, z);
  p5ctx.rotateZ(facet.lean);
  p5ctx.noStroke();
  p5ctx.fill(rgba(accent, facet.state === 'quiet' ? 92 : 190));
  p5ctx.beginShape(p5ctx.TRIANGLES);
  p5ctx.vertex(-span, height * .55, 0);
  p5ctx.vertex(0, -height, 4 + facet.cut * 18);
  p5ctx.vertex(span, height * .35, 0);
  p5ctx.endShape();
  p5ctx.stroke(rgba(accent, facet.state === 'quiet' ? 92 : 220));
  p5ctx.strokeWeight(facet.state === 'hinged' ? 2.3 : 1);
  p5ctx.line(-span, height * .55, 0, -facet.cut * 22, -height * .7, 5 + facet.cut * 15);
  p5ctx.pop();
}

function drawSeam(frame) {
  p5ctx.push();
  p5ctx.translate(0, frame.hinge.offset * 12, 20);
  p5ctx.stroke(rgba(PALETTE.ink, 168));
  p5ctx.strokeWeight(1.2);
  p5ctx.line(0, -190, 0, 190);
  p5ctx.stroke(rgba(PALETTE.copper, 200));
  p5ctx.strokeWeight(2);
  p5ctx.line(0, -frame.hinge.voidScale * 58, 22, frame.hinge.angle * 36, frame.hinge.voidScale * 58, 22);
  p5ctx.pop();
}

function rgba(values, alpha) {
  return p5ctx.color(values[0], values[1], values[2], alpha);
}

function bindControls() {
  document.querySelectorAll('[data-action="propose"]').forEach((button) => {
    button.addEventListener('click', () => commitProposal(Number(button.dataset.direction)));
  });
  document.querySelector('[data-action="lift"]').addEventListener('click', liftRevision);
  document.querySelector('[data-action="release"]').addEventListener('click', releaseRevision);
  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const angle = Math.atan2(y, x);
    const direction = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % DIRECTION_COUNT;
    commitProposal(direction);
  });
  stage.addEventListener('keydown', (event) => {
    const directionKeys = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
    if (Object.hasOwn(directionKeys, event.key)) {
      event.preventDefault();
      commitProposal(directionKeys[event.key]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitProposal(selectedDirection);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      liftRevision();
    } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
      event.preventDefault();
      releaseRevision();
    }
  });
}

function commitProposal(direction) {
  if (!Number.isInteger(direction) || direction < 0 || direction >= DIRECTION_COUNT) return;
  selectedDirection = direction;
  const result = propose(state, direction);
  state = result.frame;
  if (result.accepted) {
    statusNode.textContent = `Contradiction committed: ${DIRECTIONS[result.event.firstDirection]} against ${DIRECTIONS[result.event.secondDirection]}.`;
  } else if (result.reason === 'duplicate-proposal') {
    statusNode.textContent = 'The same proposal is refused; the hinge stays continuous.';
  } else if (result.reason === 'awaiting-contradiction') {
    statusNode.textContent = `First proposal held: ${DIRECTIONS[direction]}. Offer another direction.`;
  } else {
    statusNode.textContent = 'The hinge refuses that proposal.';
  }
  publishState();
  p5ctx.redraw();
}

function liftRevision() {
  state = liftLatest(state);
  statusNode.textContent = state.memory.length ? 'Latest contradiction lifted; the preceding body is restored.' : 'Nothing is held to lift.';
  publishState();
  p5ctx.redraw();
}

function releaseRevision() {
  state = releaseField(0);
  statusNode.textContent = 'The refusal is released; the body returns to its quiet seed.';
  publishState();
  p5ctx.redraw();
}

function publishState() {
  stageNode.textContent = `hinge / ${String(state.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${state.memory.length} contradiction${state.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = state.pendingDirection === null ? (state.revision ? 'the body remembers disagreement' : 'the body is continuous') : `holding ${DIRECTIONS[state.pendingDirection]}`;
  hintNode.textContent = state.pendingDirection === null ? 'propose a direction, then contradict it' : 'now offer a different direction';
}

function windowResized() {
  if (!stage || !canvas) return;
  p5ctx.resizeCanvas(stage.clientWidth, stage.clientHeight);
}

new p5((p) => {
  p5ctx = p;
  p.setup = setup;
  p.draw = draw;
  p.windowResized = windowResized;
}, 'hinge-canvas');
