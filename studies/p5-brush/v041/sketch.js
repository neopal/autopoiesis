import {
  applyWitness,
  buildFrame,
  buildTimeline,
  commitWitness,
  geometrySignature,
  liftLatest,
  previewWitness,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#membrane-field');
const canvasHost = document.querySelector('#membrane-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;

const PALETTE = {
  void: '#070d12',
  blueBlack: '#0d1b22',
  shell: '#d7d9bf',
  lichen: '#b9c984',
  ember: '#d88967',
  lake: '#79a8a8',
  ochre: '#d4b56f',
  plum: '#907c9d'
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;
let offerPoint = null;
let departurePoint = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, canvasHost.clientHeight || Math.min(760, width * 0.68));
  return { width, height };
}

function colorWithAlpha(hex, alpha) {
  const value = p5Instance.color(hex);
  value.setAlpha(alpha);
  return value;
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The membrane is intact. It does not answer a solitary look.',
    'attention-preview': 'The offer is held in the surface. Nothing has turned yet.',
    'attention-refused-miss': 'The glance found no material threshold. The membrane stays still.',
    'attention-refused-near': 'The look returned to itself. No backface can form.',
    'backface-committed': 'The answer turns elsewhere. A remote backface rises in the membrane.',
    lifted: 'The latest answer has been lifted. The prior surface returns exactly.',
    'lift-refused': 'There is no recent answer to lift.',
    released: 'The membrane releases every remembered answer.',
    timeline: 'Reduced motion holds four remote answers in the surface.'
  };
  return messages[interaction] || 'The material is listening for a separated look.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${String(9).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering membrane' : 'quiet membrane'} · ${frame.memory.length} backface${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.02, Math.min(0.98, (event.clientY - rect.top) / rect.height))
  };
}

function surfaceSample(row, column) {
  return frame.surface[row * 24 + column];
}

function reliefVertex(sample) {
  const x = (sample.x - 0.5) * p5Instance.width * 0.84;
  const y = (sample.y - 0.5) * p5Instance.height * 0.68;
  const z = (sample.z - 0.052) * 420 - 34;
  return { x, y, z };
}

function shadeFor(sample) {
  const answer = Math.min(1, sample.backface * 3.2);
  const seam = Math.min(1, sample.seam * 0.6);
  return {
    hue: 190 - answer * 136 + seam * 26,
    saturation: 25 + answer * 48 + seam * 20,
    brightness: 44 + answer * 32 + seam * 20,
    alpha: 210 + answer * 35
  };
}

function drawGround() {
  p5Instance.push();
  p5Instance.noStroke();
  p5Instance.translate(0, 82, -98);
  p5Instance.rotateX(Math.PI * 0.5);
  p5Instance.fill(colorWithAlpha(PALETTE.void, 190));
  p5Instance.ellipse(0, 0, p5Instance.width * 0.8, p5Instance.height * 0.32);
  p5Instance.pop();
}

function drawRelief() {
  p5Instance.push();
  p5Instance.rotateX(0.88);
  p5Instance.rotateZ(-0.13);
  p5Instance.noStroke();
  for (let row = 0; row < 15; row += 1) {
    for (let column = 0; column < 23; column += 1) {
      const a = reliefVertex(surfaceSample(row, column));
      const b = reliefVertex(surfaceSample(row, column + 1));
      const c = reliefVertex(surfaceSample(row + 1, column + 1));
      const d = reliefVertex(surfaceSample(row + 1, column));
      const average = {
        z: (surfaceSample(row, column).z + surfaceSample(row, column + 1).z + surfaceSample(row + 1, column + 1).z + surfaceSample(row + 1, column).z) / 4,
        backface: (surfaceSample(row, column).backface + surfaceSample(row, column + 1).backface + surfaceSample(row + 1, column + 1).backface + surfaceSample(row + 1, column).backface) / 4,
        seam: (surfaceSample(row, column).seam + surfaceSample(row, column + 1).seam + surfaceSample(row + 1, column + 1).seam + surfaceSample(row + 1, column).seam) / 4
      };
      const shade = shadeFor(average);
      p5Instance.fill(shade.hue, shade.saturation, shade.brightness, shade.alpha);
      p5Instance.beginShape(p5Instance.TRIANGLES);
      p5Instance.vertex(a.x, a.y, a.z);
      p5Instance.vertex(b.x, b.y, b.z);
      p5Instance.vertex(c.x, c.y, c.z);
      p5Instance.vertex(a.x, a.y, a.z);
      p5Instance.vertex(c.x, c.y, c.z);
      p5Instance.vertex(d.x, d.y, d.z);
      p5Instance.endShape();
    }
  }

  p5Instance.noFill();
  p5Instance.strokeWeight(0.55);
  for (let row = 1; row < 15; row += 2) {
    p5Instance.stroke(191, 18, 82, 33);
    p5Instance.beginShape();
    for (let column = 0; column < 24; column += 1) {
      const vertex = reliefVertex(surfaceSample(row, column));
      p5Instance.vertex(vertex.x, vertex.y, vertex.z + 2);
    }
    p5Instance.endShape();
  }
  p5Instance.pop();
}

function drawBackfaceEchoes() {
  p5Instance.push();
  p5Instance.rotateX(0.88);
  p5Instance.rotateZ(-0.13);
  p5Instance.noFill();
  frame.zones.forEach((zone, index) => {
    if (zone.backface <= 0.001) return;
    const x = (zone.x - 0.5) * p5Instance.width * 0.84;
    const y = (zone.y - 0.5) * p5Instance.height * 0.68;
    const size = 26 + zone.backface * 75;
    p5Instance.stroke(48 + index * 13, 34 + zone.backface * 80, 72 + zone.backface * 20, 35 + zone.backface * 110);
    p5Instance.strokeWeight(0.7 + zone.backface * 1.2);
    p5Instance.ellipse(x, y, size, size * 0.42);
  });
  p5Instance.pop();
}

function drawAttentionTrace() {
  if (!frame.pending?.start || !frame.pending?.exit) return;
  const start = frame.pending.start;
  const exit = frame.pending.exit;
  p5Instance.push();
  p5Instance.rotateX(0.88);
  p5Instance.rotateZ(-0.13);
  const a = { x: (start.x - 0.5) * p5Instance.width * 0.84, y: (start.y - 0.5) * p5Instance.height * 0.68, z: -8 };
  const b = { x: (exit.x - 0.5) * p5Instance.width * 0.84, y: (exit.y - 0.5) * p5Instance.height * 0.68, z: -8 };
  p5Instance.noFill();
  p5Instance.stroke(colorWithAlpha(PALETTE.shell, 190));
  p5Instance.strokeWeight(1.3);
  p5Instance.line(a.x, a.y, a.z, b.x, b.y, b.z);
  p5Instance.noStroke();
  p5Instance.translate(a.x, a.y, a.z);
  p5Instance.fill(colorWithAlpha(PALETTE.ember, 205));
  p5Instance.sphere(5, 8, 5);
  p5Instance.translate(b.x - a.x, b.y - a.y, b.z - a.z);
  p5Instance.fill(colorWithAlpha(PALETTE.lichen, 170));
  p5Instance.sphere(4, 8, 5);
  p5Instance.pop();
}

function drawComposition() {
  p5Instance.background(PALETTE.void);
  p5Instance.ambientLight(90);
  p5Instance.directionalLight(160, 150, 140, -0.3, 0.5, -1);
  p5Instance.ortho(-p5Instance.width / 2, p5Instance.width / 2, -p5Instance.height / 2, p5Instance.height / 2, -700, 700);
  drawGround();
  drawRelief();
  drawBackfaceEchoes();
  drawAttentionTrace();
}

function commitPointerVisit() {
  if (!offerPoint || !departurePoint) return;
  renderFrame(commitWitness(frame, offerPoint, departurePoint, 'visitor-separated-look'));
  tracking = false;
  pointerId = null;
  offerPoint = null;
  departurePoint = null;
}

function cancelPointerVisit() {
  tracking = false;
  pointerId = null;
  offerPoint = null;
  departurePoint = null;
  renderFrame(frame);
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', (event) => {
    if (staticMode) return;
    event.preventDefault();
    tracking = true;
    pointerId = event.pointerId;
    offerPoint = normalizedPoint(event);
    departurePoint = offerPoint;
    renderer.elt.setPointerCapture?.(event.pointerId);
    renderFrame(previewWitness(frame, offerPoint, departurePoint));
  });
  renderer.elt.addEventListener('pointermove', (event) => {
    if (!tracking || event.pointerId !== pointerId) return;
    event.preventDefault();
    departurePoint = normalizedPoint(event);
    renderFrame(previewWitness(frame, offerPoint, departurePoint));
  });
  renderer.elt.addEventListener('pointerup', (event) => {
    if (!tracking || event.pointerId !== pointerId) return;
    event.preventDefault();
    departurePoint = normalizedPoint(event);
    renderer.elt.releasePointerCapture?.(event.pointerId);
    commitPointerVisit();
  });
  renderer.elt.addEventListener('pointercancel', cancelPointerVisit);
}

function performControlWitness() {
  if (!staticMode) renderFrame(applyWitness(frame, 0, 3, 'control-separated-look'));
}

function bindControls() {
  document.querySelector('[data-gesture="witness"]')?.addEventListener('click', performControlWitness);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlWitness();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!staticMode) renderFrame(liftLatest(frame));
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      if (!staticMode) renderFrame(releaseField(frame));
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      p5Instance.saveCanvas('mutine-brush-v041', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 255);
    renderer = p.createCanvas(size.width, size.height, p.WEBGL);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV041 = {
      getFrame: () => frame,
      geometrySignature: () => geometrySignature(frame),
      preview: (start, exit) => renderFrame(previewWitness(frame, start, exit)),
      commit: (start, exit) => renderFrame(commitWitness(frame, start, exit, 'probe-separated-look')),
      witness: performControlWitness,
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      ready: true
    };
  };
  p.draw = drawComposition;
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    p.redraw();
  };
};

p5Instance = new window.p5(sketch, canvasHost);
