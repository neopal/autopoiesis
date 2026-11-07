import {
  LOOP_SEGMENTS,
  SEED,
  buildField,
  buildTimeline,
  compileLoop,
  geometrySignature,
  liftLatest,
  releaseField,
  traceLoop,
  validLoop
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field = staticMode ? buildTimeline().at(-1) : buildField();
let renderer;
let pointerActive = false;
let pointerId = null;
let strokePoints = [];

const stageNode = document.querySelector('[data-loop-stage]');
const hostNode = document.querySelector('[data-loop-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

const stateText = (stage) => ({
  'quiet compiler': 'the form is running its quiet rule',
  'trace armed': 'a trace is provisional until it closes',
  'refused / open loop': 'the compiler refused an open loop',
  'compiled / hinge': 'the form hinged its own production rule',
  'compiled / coil': 'the form coiled its own production rule',
  'compiled / fork': 'the form forked its own production rule',
  'compiled / return': 'the form returned through its own rule',
  'lifted / exact': 'the latest compilation was lifted exactly',
  'released / quiet': 'the compiler returned to its seed'
}[stage] ?? 'the form is compiling');

function renderStatus(stage = field.interaction) {
  readoutNode.textContent = `${stage} / ${String(field.form.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${field.memory.length} compilation${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.stroke?.length
    ? `trace ${field.stroke.length} points · close the loop to compile`
    : 'draw one closed loop · release to compile';
}

function pointFromEvent(event) {
  const rect = stageNode.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
  };
}

function appendPoint(event) {
  strokePoints = [...strokePoints, pointFromEvent(event)].slice(-240);
  field = traceLoop(field, strokePoints);
  renderStatus(field.interaction);
}

function compile() {
  if (staticMode) return { accepted: false, field };
  const result = compileLoop(field);
  field = result.field;
  strokePoints = [];
  renderStatus(field.interaction);
  stageNode.focus({ preventScroll: true });
  return result;
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  strokePoints = [];
  renderStatus('lifted / exact');
  stageNode.focus({ preventScroll: true });
  return field;
}

function release() {
  if (staticMode) return field;
  field = releaseField();
  strokePoints = [];
  renderStatus('released / quiet');
  stageNode.focus({ preventScroll: true });
  return field;
}

function onPointerDown(event) {
  if (staticMode || event.target.closest('.compiler-controls')) return;
  event.preventDefault();
  pointerActive = true;
  pointerId = event.pointerId;
  strokePoints = [pointFromEvent(event)];
  field = traceLoop(field, strokePoints);
  stageNode.setPointerCapture?.(event.pointerId);
  renderStatus(field.interaction);
}

function onPointerMove(event) {
  if (staticMode || !pointerActive || event.pointerId !== pointerId) return;
  event.preventDefault();
  appendPoint(event);
}

function onPointerUp(event) {
  if (staticMode || !pointerActive || event.pointerId !== pointerId || event.target.closest('.compiler-controls')) return;
  event.preventDefault();
  appendPoint(event);
  pointerActive = false;
  pointerId = null;
  compile();
}

stageNode.addEventListener('pointerdown', onPointerDown);
stageNode.addEventListener('pointermove', onPointerMove);
stageNode.addEventListener('pointerup', onPointerUp);
stageNode.addEventListener('pointercancel', (event) => {
  if (!pointerActive || event.pointerId !== pointerId) return;
  pointerActive = false;
  pointerId = null;
  field = traceLoop(field, strokePoints);
  renderStatus('refused / open loop');
});
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); field = traceLoop(field, validLoop(1)); compile(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape') { event.preventDefault(); release(); }
});

document.querySelector('[data-action="compile"]').addEventListener('click', () => { field = traceLoop(field, validLoop(field.form.revision % 2 ? -1 : 1)); compile(); });
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', release);

function makeBackground(p) {
  p.background(222, 42, 7);
  p.push();
  p.noStroke();
  for (let radius = Math.max(p.width, p.height) * 1.2; radius > 20; radius -= 32) {
    const hue = radius % 80 < 40 ? 222 : 270;
    p.fill(hue, 34, 8 + (radius / Math.max(p.width, p.height)) * 10, 8);
    p.ellipse(-p.width * .14, -p.height * .18, radius * 1.7, radius * 1.2);
  }
  p.pop();
  p.push();
  p.noFill();
  p.stroke(190, 20, 80, 8);
  p.strokeWeight(1);
  for (let index = -7; index < 9; index += 1) {
    const offset = index * Math.max(p.width, p.height) * .11;
    p.line(-p.width, offset, p.width, offset + p.height * .32);
  }
  p.pop();
}

function bodyPoint(form, a, b, p) {
  const modeShift = form.mode === 'coil' ? Math.sin(a * 3 + form.phase * 6) * 0.16 : 0;
  const forkShift = form.mode === 'fork' ? Math.sin(a * 2) * form.aperture * 0.22 : 0;
  const returnShift = form.mode === 'return' ? Math.cos(a * 2 + form.phase) * 0.13 : 0;
  const loopRadiusX = 175 + Math.sin(a * 2 + form.phase * 5) * 22 + form.shear * 34;
  const loopRadiusY = 118 + Math.cos(a * 3 - form.phase * 3) * 15;
  const centreX = Math.cos(a) * loopRadiusX;
  const centreY = Math.sin(a) * loopRadiusY + returnShift * 120;
  const centreZ = Math.sin(a * 2 + form.twist) * (28 + form.depth * 42) + modeShift * 85;
  const tubeX = Math.cos(a) * Math.cos(b) * (36 + form.waist * 18);
  const tubeY = Math.sin(b) * (38 + form.aperture * 30);
  const tubeZ = Math.sin(a + form.twist) * Math.cos(b) * (42 + form.depth * 28) + forkShift * 92;
  const rotation = form.twist * .38 + a * .08;
  return {
    x: centreX + tubeX * Math.cos(rotation) - tubeZ * Math.sin(rotation),
    y: centreY + tubeY,
    z: centreZ + tubeX * Math.sin(rotation) + tubeZ * Math.cos(rotation)
  };
}

function drawFacetedLoop(p) {
  const form = field.form;
  p.push();
  p.rotateX(-0.26 + (reducedMotion ? 0 : Math.sin(p.frameCount * .004) * .018));
  p.rotateY(0.18 + form.shear * .22 + (reducedMotion ? 0 : Math.cos(p.frameCount * .003) * .024));
  p.rotateZ(form.shear * .12);
  p.scale(Math.min(p.width, p.height) / 680);

  for (let index = 0; index < form.segments; index += 1) {
    const a0 = index / form.segments * Math.PI * 2;
    const a1 = (index + 1) / form.segments * Math.PI * 2;
    for (let side = 0; side < 9; side += 1) {
      const b0 = side / 9 * Math.PI * 2;
      const b1 = (side + 1) / 9 * Math.PI * 2;
      const q0 = bodyPoint(form, a0, b0, p);
      const q1 = bodyPoint(form, a1, b0, p);
      const q2 = bodyPoint(form, a1, b1, p);
      const q3 = bodyPoint(form, a0, b1, p);
      const hue = (214 + index * 3.7 + side * 9 + form.facetBias * 60) % 360;
      const brightness = 24 + (side % 3) * 5 + (index % 5 === 0 ? 7 : 0);
      p.noStroke();
      p.fill(hue, 36 + (side % 2) * 14, brightness, 100);
      p.beginShape(p.QUADS);
      p.vertex(q0.x, q0.y, q0.z);
      p.vertex(q1.x, q1.y, q1.z);
      p.vertex(q2.x, q2.y, q2.z);
      p.vertex(q3.x, q3.y, q3.z);
      p.endShape();
    }
  }

  p.noFill();
  p.stroke(42, 16, 95, 45);
  p.strokeWeight(1.1);
  for (let side = 0; side < 9; side += 2) {
    p.beginShape();
    for (let index = 0; index <= form.segments; index += 1) {
      const point = bodyPoint(form, index / form.segments * Math.PI * 2, side / 9 * Math.PI * 2, p);
      p.vertex(point.x, point.y, point.z);
    }
    p.endShape();
  }

  p.stroke(276, 28, 98, 38);
  p.strokeWeight(1.5);
  p.beginShape();
  for (let index = 0; index <= form.segments; index += 1) {
    const point = bodyPoint(form, index / form.segments * Math.PI * 2, Math.PI * .16, p);
    p.vertex(point.x, point.y, point.z + 4);
  }
  p.endShape();
  p.pop();
}

new p5((p) => {
  p.setup = () => {
    const width = Math.max(1, hostNode.clientWidth);
    const height = Math.max(1, hostNode.clientHeight);
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    renderer = p.createCanvas(width, height, p.WEBGL);
    renderer.parent(hostNode);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    renderStatus(staticMode ? `compiled / ${field.form.mode}` : 'quiet compiler');
    window.__mutinePortraitV045 = {
      getState: () => field,
      geometrySignature: () => geometrySignature(field),
      trace: (points) => { field = traceLoop(field, points); renderStatus(field.interaction); return field; },
      compile,
      compileValid: (direction = 1) => { field = traceLoop(field, validLoop(direction)); return compile(); },
      lift,
      release
    };
  };

  p.draw = () => {
    makeBackground(p);
    p.ambientLight(70, 20, 72);
    p.pointLight(276, 44, 100, -240, -180, 420);
    p.pointLight(24, 42, 100, 260, 170, 260);
    drawFacetedLoop(p);
  };

  p.windowResized = () => {
    if (!hostNode.clientWidth || !hostNode.clientHeight) return;
    p.resizeCanvas(hostNode.clientWidth, hostNode.clientHeight);
  };
});
