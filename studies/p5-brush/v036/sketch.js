import {
  applyControlEclipse,
  applyMove,
  applyPress,
  applyRelease,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseSlab
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#eclipse-field');
const canvasHost = document.querySelector('#eclipse-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const blind = params.get('blind') === '1';

const PALETTE = {
  deep: '#091012',
  ground: '#101719',
  ink: '#eadfc5',
  slab: '#b6a88d',
  slabLight: '#d7c9a9',
  coral: '#ed7c63',
  acid: '#c8d46b',
  blue: '#88a4b0',
  violet: '#62556e',
  void: '#172d31'
};

let frame = params.get('static') === '1' || reducedMotion ? buildTimeline().at(-1) : buildFrame(0, []);
let renderer;
let p5Instance;
let pressPoint = null;

function alphaColor(hex, alpha) {
  const value = p5Instance.color(hex);
  value.setAlpha(alpha);
  return value;
}

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, Math.min(760, width * 0.60));
  return { width, height };
}

function pointFromEvent(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function screenPoint(point, z = 0) {
  return { x: point.x * p5Instance.width - p5Instance.width / 2, y: point.y * p5Instance.height - p5Instance.height / 2, z };
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / 13`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} eclipse${frame.memory.length === 1 ? '' : 's'} held${frame.pending.phase !== 'idle' ? ` · ${frame.pending.phase}` : ''}`;
  const messages = {
    baseline: 'The slab is unbroken.',
    'press-refused': 'The slab refused that pressure.',
    'press-refused-busy': 'Finish or release the route first.',
    'fault-armed': 'The fault is listening. Cross a distant vent.',
    'vent-crossed': 'The vent is crossed. Leave the slab to make the cut.',
    'cross-refused': 'The route is still holding its fault.',
    'release-refused': 'No complete route was released.',
    'release-refused-local': 'The exit must be outside the marked places.',
    'eclipse-committed': 'The exit opened an eclipse elsewhere.',
    lifted: 'The latest eclipse has been lifted.',
    'lift-refused': 'Nothing is held to lift.',
    released: 'The slab released its ledger.',
    timeline: 'Reduced motion settles the slab into remembered eclipses.'
  };
  if (stateReadout) stateReadout.textContent = messages[frame.interaction] || 'The slab is listening.';
}

function performEclipse() {
  renderFrame(applyControlEclipse(frame, frame.memory.length));
}

function drawBackground() {
  p5Instance.background(PALETTE.ground);
  p5Instance.push();
  p5Instance.ortho(-p5Instance.width / 2, p5Instance.width / 2, -p5Instance.height / 2, p5Instance.height / 2, -1200, 1200);
  p5Instance.translate(0, 0, -260);
  for (let layer = 0; layer < 12; layer += 1) {
    const amount = layer / 11;
    p5Instance.noStroke();
    p5Instance.fill(p5Instance.lerpColor(p5Instance.color(PALETTE.deep), p5Instance.color(PALETTE.ground), amount));
    p5Instance.rect(-p5Instance.width / 2, -p5Instance.height / 2 + layer * p5Instance.height / 12, p5Instance.width, p5Instance.height / 12 + 1);
  }
  p5Instance.noFill();
  p5Instance.stroke(alphaColor(PALETTE.blue, 36));
  p5Instance.strokeWeight(1);
  for (let ring = 0; ring < 8; ring += 1) {
    const w = p5Instance.width * (0.35 + ring * 0.12);
    const h = p5Instance.height * (0.18 + ring * 0.07);
    p5Instance.ellipse(p5Instance.width * -0.18, p5Instance.height * 0.15, w, h);
  }
  p5Instance.pop();
}

function drawSurfaceBridge() {
  const ribs = frame.ribs;
  p5Instance.push();
  p5Instance.noStroke();
  p5Instance.fill(alphaColor(PALETTE.slab, 72));
  p5Instance.beginShape(p5Instance.QUAD_STRIP);
  ribs.forEach((rib) => {
    const top = screenPoint(rib.front[1], 34 + rib.z * 120);
    const bottom = screenPoint(rib.front[5], 34 + rib.z * 120);
    p5Instance.vertex(top.x, top.y, top.z);
    p5Instance.vertex(bottom.x, bottom.y, bottom.z);
  });
  p5Instance.endShape();
  p5Instance.pop();
}

function drawRib(rib, index) {
  const frontZ = 34 + rib.z * 120;
  const backZ = frontZ - 58 - rib.shed * 28;
  const front = rib.front.map((point) => screenPoint(point, frontZ));
  const back = rib.back.map((point) => screenPoint(point, backZ));
  const face = index % 4 === 0 ? PALETTE.slabLight : index % 3 === 0 ? PALETTE.slab : PALETTE.violet;

  p5Instance.push();
  p5Instance.stroke(alphaColor(PALETTE.ink, 72));
  p5Instance.strokeWeight(0.7 + rib.cut * 0.65);
  p5Instance.fill(alphaColor(face, 226));
  p5Instance.beginShape();
  front.forEach((point) => p5Instance.vertex(point.x, point.y, point.z));
  p5Instance.endShape(p5Instance.CLOSE);

  p5Instance.noStroke();
  p5Instance.fill(alphaColor(PALETTE.blue, 128));
  for (let point = 0; point < front.length; point += 1) {
    const next = (point + 1) % front.length;
    p5Instance.beginShape(p5Instance.QUADS);
    p5Instance.vertex(front[point].x, front[point].y, front[point].z);
    p5Instance.vertex(front[next].x, front[next].y, front[next].z);
    p5Instance.vertex(back[next].x, back[next].y, back[next].z);
    p5Instance.vertex(back[point].x, back[point].y, back[point].z);
    p5Instance.endShape();
  }

  if (rib.underside > 0.03) {
    p5Instance.noFill();
    p5Instance.stroke(alphaColor(PALETTE.coral, 150));
    p5Instance.strokeWeight(1.2 + rib.underside);
    p5Instance.beginShape();
    [back[5], back[6], back[7]].forEach((point) => p5Instance.vertex(point.x, point.y, point.z - 4));
    p5Instance.endShape();
  }
  p5Instance.pop();
}

function drawAperture(aperture) {
  const point = screenPoint(aperture, 174 + aperture.depth * 82);
  const rx = aperture.rx * p5Instance.width * (1 + aperture.depth * 0.72);
  const ry = aperture.ry * p5Instance.height * (1 + aperture.depth * 0.58);
  p5Instance.push();
  p5Instance.translate(point.x, point.y, point.z);
  p5Instance.rotateZ(aperture.angle);
  p5Instance.noStroke();
  p5Instance.fill(alphaColor(PALETTE.coral, 136 + aperture.rim * 32));
  p5Instance.ellipse(0, 0, rx * 1.52, ry * 1.52);
  p5Instance.fill(alphaColor(PALETTE.void, 230));
  p5Instance.ellipse(0, 0, rx, ry);
  if (aperture.depth > 0.04) {
    p5Instance.translate(0, 0, -34 - aperture.depth * 32);
    p5Instance.fill(alphaColor(PALETTE.deep, 245));
    p5Instance.ellipse(0, 0, rx * 0.56, ry * 0.55);
    p5Instance.noFill();
    p5Instance.stroke(alphaColor(PALETTE.acid, 156));
    p5Instance.strokeWeight(1.1 + aperture.rim * 0.8);
    p5Instance.ellipse(0, 0, rx * 0.66, ry * 0.64);
  }
  p5Instance.pop();
}

function drawRouteMarkers() {
  if (blind) return;
  const drawMarker = (point, color, index, z) => {
    const mapped = screenPoint(point, z);
    p5Instance.push();
    p5Instance.translate(mapped.x, mapped.y, mapped.z);
    p5Instance.noFill();
    p5Instance.stroke(alphaColor(color, 190));
    p5Instance.strokeWeight(1.3);
    p5Instance.rotateZ(index * 0.6);
    p5Instance.rectMode(p5Instance.CENTER);
    p5Instance.rect(0, 0, 13 + index * 2, 13 + index * 2, 2);
    p5Instance.pop();
  };
  frame.faults.forEach((fault, index) => drawMarker(fault, PALETTE.coral, index, 220));
  frame.vents.forEach((vent, index) => drawMarker(vent, PALETTE.acid, index, 214));
  if (frame.pending.phase !== 'idle') {
    const fault = frame.faults[frame.pending.faultIndex];
    const vent = frame.pending.ventIndex >= 0 ? frame.vents[frame.pending.ventIndex] : null;
    if (fault && vent) {
      const a = screenPoint(fault, 228);
      const b = screenPoint(vent, 228);
      p5Instance.push();
      p5Instance.noFill();
      p5Instance.stroke(alphaColor(PALETTE.ink, 145));
      p5Instance.strokeWeight(1);
      p5Instance.beginShape();
      p5Instance.vertex(a.x, a.y, a.z);
      p5Instance.vertex((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 - 18, 228);
      p5Instance.vertex(b.x, b.y, b.z);
      p5Instance.endShape();
      p5Instance.pop();
    }
  }
}

function drawSlab() {
  const tilt = reducedMotion || blind ? -0.13 : -0.13 + Math.sin(p5Instance.frameCount * 0.012) * 0.018;
  p5Instance.push();
  p5Instance.ortho(-p5Instance.width / 2, p5Instance.width / 2, -p5Instance.height / 2, p5Instance.height / 2, -1200, 1200);
  p5Instance.translate(0, 8, 0);
  p5Instance.rotateX(tilt);
  p5Instance.rotateY(-0.12);
  p5Instance.ambientLight(130);
  p5Instance.directionalLight(220, 196, 165, -0.4, 0.5, -1);
  p5Instance.directionalLight(112, 156, 168, 0.7, -0.2, -0.5);
  drawSurfaceBridge();
  frame.ribs.forEach(drawRib);
  frame.apertures.forEach(drawAperture);
  drawRouteMarkers();
  p5Instance.pop();
}

function bindEvents() {
  renderer.elt.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pressPoint = { pointerId: event.pointerId };
    renderer.elt.setPointerCapture?.(event.pointerId);
    renderFrame(applyPress(frame, pointFromEvent(event), 'visitor-press'));
  });
  renderer.elt.addEventListener('pointermove', (event) => {
    if (!pressPoint) return;
    event.preventDefault();
    renderFrame(applyMove(frame, pointFromEvent(event), 'visitor-cross'));
  });
  renderer.elt.addEventListener('pointerup', (event) => {
    if (!pressPoint) return;
    event.preventDefault();
    renderFrame(applyRelease(frame, pointFromEvent(event), 'visitor-exit'));
    pressPoint = null;
  });
  renderer.elt.addEventListener('pointercancel', () => { pressPoint = null; });
  field.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); performEclipse(); }
    if (event.key === 'Delete') { event.preventDefault(); renderFrame(liftLatest(frame)); }
    if (event.key === 'Escape' || key === 'r') { event.preventDefault(); renderFrame(releaseSlab()); }
    if (key === 's') p5Instance.saveCanvas('mutine-brush-v036', 'png');
  });
  document.querySelector('[data-gesture="eclipse"]').addEventListener('click', performEclipse);
  document.querySelector('[data-gesture="lift"]').addEventListener('click', () => renderFrame(liftLatest(frame)));
  document.querySelector('[data-gesture="release"]').addEventListener('click', () => renderFrame(releaseSlab()));
}

const sketch = (p) => {
  p5Instance = p;
  p.setup = () => {
    const size = canvasSize();
    renderer = p.createCanvas(size.width, size.height, p.WEBGL);
    renderer.parent(canvasHost);
    p.pixelDensity(1);
    p.frameRate(30);
    renderer.elt.setAttribute('aria-label', 'A shallow painted slab with fault, vent, and eclipse geometry.');
    bindEvents();
    renderFrame(frame);
    window._p5Ready = true;
  };
  p.draw = () => {
    drawBackground();
    drawSlab();
  };
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
  };
};

new window.p5(sketch);

window.__mutineBrushV036 = {
  getFrame: () => frame,
  geometrySignature: () => geometrySignature(frame),
  eclipse: () => { performEclipse(); return frame; },
  lift: () => { renderFrame(liftLatest(frame)); return frame; },
  release: () => { renderFrame(releaseSlab()); return frame; }
};
