import {
  MEMORY_WINDOW,
  PLANE_COUNT,
  STAGES,
  buildFrame,
  buildTimeline,
  commitMisread,
  geometrySignature,
  liftLatestMisread,
  releaseMisread
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3600;
const APPROACH_RADIUS = 0.34;

const field = document.querySelector('#naive-theatre');
const canvasHost = document.querySelector('#theatre-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const misreadControl = document.querySelector('#misread-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');

let startedAt = performance.now();
let currentFrame = timeline[0];
let interactionFrame = null;
let lastInteraction = 'sequence';
let armedPlane = null;
let pointerDown = null;
let p5Instance = null;

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : currentFrame);
}

function setInteraction(value) {
  lastInteraction = value;
  field.dataset.interaction = value;
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.memory.length,
    memoryWindow: MEMORY_WINDOW,
    shadowMisreadCount: frame.scene.trace.shadowMisreadCount,
    changedPlaneCount: frame.scene.trace.changedPlaneCount,
    shadowOffsetTotal: frame.scene.trace.shadowOffsetTotal,
    armedPlane,
    interaction: interactionFrame?.interaction ?? lastInteraction,
    geometrySignature: geometrySignature(frame),
    p5WebGL: true
  };
}

window.__mutineNaiveV024 = { getState: stateSnapshot };
field.dataset.witness = 'shadow-misread';

if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}
if (blindMode) field.setAttribute('aria-label', 'A faceted paper theatre with a local hinge and a distant misread shadow');

function renderFrame(frame) {
  stageReadout.textContent = `stage ${String(frame.stage).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} misread${frame.memory.length === 1 ? '' : 's'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.shadowMisreads = String(frame.scene.trace.shadowMisreadCount);
  field.dataset.changedPlanes = String(frame.scene.trace.changedPlaneCount);
  field.dataset.geometrySignature = geometrySignature(frame);
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function commit(focusIndex = null) {
  const source = activeFrame();
  interactionFrame = commitMisread(source, { focusIndex });
  armedPlane = null;
  setInteraction('misread-committed');
  renderFrame(interactionFrame);
}

function lift() {
  interactionFrame = liftLatestMisread(activeFrame());
  armedPlane = null;
  setInteraction('misread-lifted');
  renderFrame(interactionFrame);
}

function release() {
  interactionFrame = releaseMisread();
  armedPlane = null;
  setInteraction('released');
  renderFrame(interactionFrame);
}

function pointerPoint(event) {
  const rect = canvasHost.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height
  };
}

function nearestPlane(point) {
  if (!point) return null;
  let closest = null;
  let distance = Infinity;
  const frame = activeFrame();
  frame.scene.planes.forEach((plane, index) => {
    const dx = point.x - (plane.x * .42 + .5);
    const dy = point.y - (plane.y * .42 + .5);
    const next = dx * dx + dy * dy;
    if (next < distance) {
      distance = next;
      closest = index;
    }
  });
  return Math.sqrt(distance) <= APPROACH_RADIUS ? closest : null;
}

function armFromPointer(event) {
  const next = nearestPlane(pointerPoint(event));
  armedPlane = next;
  field.dataset.armed = next === null ? '' : String(next);
  setInteraction(next === null ? lastInteraction : 'armed');
}

function depart() {
  if (armedPlane !== null) commit(armedPlane);
  armedPlane = null;
  field.dataset.armed = '';
}

field.addEventListener('pointermove', armFromPointer);
field.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };
});
field.addEventListener('pointerup', (event) => {
  if (pointerDown) {
    const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    if (distance < 24) setInteraction('pointer-tap-refused');
  }
  pointerDown = null;
});
field.addEventListener('pointerleave', depart);
field.addEventListener('pointerout', (event) => {
  if (!field.contains(event.relatedTarget)) depart();
});
document.addEventListener('pointermove', (event) => {
  if (!field.contains(event.target) && armedPlane !== null) depart();
}, true);

misreadControl.addEventListener('click', () => commit());
undoControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(); }
  if (event.key === 'Delete') { event.preventDefault(); lift(); }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    const blob = new Blob([JSON.stringify(stateSnapshot(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mutine-naive-v024-state.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }
});

function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawBackdrop(p) {
  p.push();
  p.noStroke();
  p.translate(0, 0, -360);
  p.fill('#171d2a');
  p.rect(-p.width, -p.height, p.width * 2, p.height * 2);
  p.fill('rgba(101,132,151,0.10)');
  p.ellipse(-p.width * .28, -p.height * .28, p.width * .9, p.height * .7);
  p.fill('rgba(221,172,111,0.07)');
  p.ellipse(p.width * .31, p.height * .27, p.width * .82, p.height * .62);
  p.pop();

  p.push();
  p.stroke('rgba(226,210,177,0.10)');
  p.strokeWeight(1);
  for (let i = -8; i <= 8; i += 1) {
    p.line(i * 86, -p.height * .55, i * 64, p.height * .55);
  }
  for (let i = -4; i <= 4; i += 1) {
    p.line(-p.width * .58, i * 88, p.width * .58, i * 88);
  }
  p.pop();
}

function drawShadow(p, plane) {
  const w = p.width * .20 * plane.scale;
  const h = p.height * .18 * plane.scale;
  const x = plane.x * p.width * .42 + plane.shadowOffset * p.width * .44;
  const y = plane.y * p.height * .42 + Math.abs(plane.depth) * p.height * .16;
  p.push();
  p.translate(x, y, -180);
  p.rotateZ(plane.shadowAngle);
  p.scale(1.22, .78, 1);
  p.noStroke();
  p.fill('rgba(4,7,13,0.48)');
  p.ellipse(0, 0, w * 1.5, h * .86);
  p.pop();
}

function drawPlane(p, plane, index) {
  const x = plane.x * p.width * .42;
  const y = plane.y * p.height * .42;
  const scale = Math.min(p.width, p.height) * .13 * plane.scale;
  const z = plane.depth * 180;
  const thickness = 13 + Math.abs(plane.depth) * 20;
  p.push();
  p.translate(x, y, z);
  p.rotateZ(plane.hinge);
  p.scale(scale, scale, 1);
  p.stroke('rgba(20,27,39,0.78)');
  p.strokeWeight(0.018);
  p.fill('rgba(20,27,39,0.36)');
  p.beginShape();
  plane.outline.forEach(([px, py]) => p.vertex(px + .04, py + .05, -thickness / scale));
  p.endShape(p.CLOSE);
  p.fill(plane.tone);
  p.beginShape();
  plane.outline.forEach(([px, py]) => p.vertex(px, py, 0));
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke(rgba('#f8edcf', .45));
  p.strokeWeight(.012);
  p.beginShape();
  plane.outline.slice(0, 3).forEach(([px, py]) => p.vertex(px * .72, py * .72, .02));
  p.endShape();
  p.noStroke();
  p.fill(rgba('#f8edcf', .16));
  p.ellipse(-.08 + (index % 3) * .07, -.06, .10 + (index % 2) * .04, .10, 5, 5);
  p.pop();
}

function drawScene(p, frame) {
  p.background('#171d2a');
  p.ambientLight(125, 118, 104);
  p.directionalLight(220, 194, 153, -.45, -.62, -1);
  drawBackdrop(p);
  const planes = [...frame.scene.planes].sort((a, b) => a.depth - b.depth);
  planes.forEach((plane) => drawShadow(p, plane));
  planes.forEach((plane, index) => drawPlane(p, plane, index));
  if (armedPlane !== null) {
    const plane = frame.scene.planes[armedPlane];
    p.push();
    p.noFill();
    p.stroke('#f0b183');
    p.strokeWeight(2);
    p.translate(plane.x * p.width * .42, plane.y * p.height * .42, plane.depth * 180 + 18);
    p.ellipse(0, 0, 50 + plane.scale * 24, 50 + plane.scale * 24);
    p.pop();
  }
}

const sketch = (p) => {
  p.setup = () => {
    p.pixelDensity(1);
    const renderer = p.createCanvas(960, 720, p.WEBGL);
    renderer.parent(canvasHost);
    renderer.id('naive-stage');
    renderFrame(activeFrame());
    p5Instance = p;
  };

  p.draw = () => {
    if (!interactionFrame && !frozen) {
      currentFrame = frameAt(p.millis());
      renderFrame(currentFrame);
    }
    drawScene(p, activeFrame());
  };

  p.windowResized = () => {
    const box = canvasHost.getBoundingClientRect();
    if (box.width && box.height) p.resizeCanvas(Math.max(320, Math.floor(box.width)), Math.max(320, Math.floor(box.height)));
  };
};

if (window.p5) p5Instance = new window.p5(sketch);
else field.dataset.error = 'p5-load-failed';
