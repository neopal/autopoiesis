import {
  BAND_COUNT,
  STAGES,
  applyScrape,
  beginScrape,
  buildFrame,
  buildTimeline,
  commitScrape,
  continueScrape,
  geometrySignature,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#counterfield-field');
const canvasHost = document.querySelector('#counterfield-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;
const TRAVERSE_PATH = [
  { x: 0.08, y: 0.34 },
  { x: 0.28, y: 0.38 },
  { x: 0.51, y: 0.43 },
  { x: 0.75, y: 0.48 },
  { x: 0.92, y: 0.51 }
];
const PALETTE = {
  ground: '#0d0d0c',
  field: '#171713',
  shadow: '#060706',
  bone: '#e2d6bd',
  rust: '#b86d52',
  amber: '#d4a165',
  sage: '#a5aa89',
  blue: '#7c9298',
  strata: ['#3d3530', '#56433a', '#735242', '#98644d', '#79564c', '#536263', '#394b4e']
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, canvasHost.clientHeight || Math.min(690, width * 0.62));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The strata are quiet. The field is waiting at the left edge.',
    'scrape-armed': 'The field has caught the edge. Cross the pressure threshold.',
    'scrape-preview': 'The hand is crossing. The produced strata remain exact.',
    'scrape-refused-edge': 'The field begins only at an edge.',
    'scrape-refused-direction': 'The pressure field refuses a return crossing.',
    'scrape-refused-incomplete': 'The traverse stopped before the threshold could be carried through.',
    'scrape-refused-no-start': 'No pressure was held at the edge.',
    'scrape-committed': 'The field classified the traverse and changed other strata.',
    lifted: 'The latest etch has been lifted. The prior field returns exactly.',
    'lift-refused': 'There is no recent etch to lift.',
    released: 'The field releases every remembered pressure event.',
    timeline: 'Reduced motion holds four pressure etches in the strata.'
  };
  return messages[interaction] || 'The field is waiting for pressure.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `field ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering pressure' : 'quiet strata'} · ${frame.memory.length} etch${frame.memory.length === 1 ? '' : 'es'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.06, Math.min(0.94, (event.clientY - rect.top) / rect.height))
  };
}

function mapPoint(point) {
  return { x: point.x * p5Instance.width, y: point.y * p5Instance.height };
}

function translucent(hex, alpha) {
  const value = p5Instance.color(hex);
  value.setAlpha(alpha);
  return value;
}

function drawAtmosphere() {
  const p = p5Instance;
  p.background(PALETTE.ground);
  p.noStroke();
  p.fill(PALETTE.field);
  p.ellipse(p.width * 0.5, p.height * 0.51, p.width * 0.92, p.height * 0.9);
  p.fill(19, 24, 24, 54);
  p.ellipse(p.width * 0.74, p.height * 0.22, p.width * 0.42, p.height * 0.46);
  p.fill(62, 37, 30, 32);
  p.ellipse(p.width * 0.2, p.height * 0.74, p.width * 0.52, p.height * 0.4);
  p.stroke(226, 214, 189, 18);
  p.strokeWeight(0.65);
  for (let line = 0; line < 13; line += 1) {
    const y = p.height * (0.08 + line * 0.071);
    p.line(p.width * 0.04, y, p.width * 0.96, y + Math.sin(line * 1.8) * 5);
  }
}

function drawFieldShadow() {
  const p = p5Instance;
  p.push();
  p.noStroke();
  p.fill(PALETTE.shadow);
  p.ellipse(p.width * 0.52, p.height * 0.58, p.width * 0.86, p.height * 0.7);
  p.fill(7, 12, 12, 120);
  p.ellipse(p.width * 0.5, p.height * 0.5, p.width * 0.92, p.height * 0.28);
  p.pop();
}

function drawStratum(stratum, index) {
  const p = p5Instance;
  const top = stratum.top.map(mapPoint);
  const bottom = stratum.bottom.map(mapPoint).reverse();
  p.push();
  p.noStroke();
  p.fill(PALETTE.strata[index % PALETTE.strata.length]);
  p.beginShape();
  top.forEach((point) => p.vertex(point.x, point.y));
  bottom.forEach((point) => p.vertex(point.x, point.y));
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(index % 2 ? PALETTE.amber : PALETTE.bone);
  p.strokeWeight(0.8 + Math.min(1.6, stratum.memory * 0.16));
  p.beginShape();
  top.forEach((point) => p.vertex(point.x, point.y));
  p.endShape();
  p.stroke(index % 3 === 0 ? PALETTE.rust : PALETTE.blue);
  p.strokeWeight(0.55);
  p.beginShape();
  bottom.forEach((point) => p.vertex(point.x, point.y));
  p.endShape();
  p.pop();
}

function drawStrata() {
  frame.body.strata.forEach(drawStratum);
  const p = p5Instance;
  p.push();
  p.stroke(229, 216, 188, 24);
  p.strokeWeight(0.5);
  for (let stripe = 0; stripe < 34; stripe += 1) {
    const x = p.width * (0.1 + stripe * 0.024);
    const y = p.height * (0.14 + ((stripe * 17) % 67) / 100);
    p.line(x, y, x + p.width * 0.012, y + p.height * (0.006 + (stripe % 3) * 0.004));
  }
  p.pop();
}

function drawCutsAndDeposits() {
  const p = p5Instance;
  frame.body.cuts.forEach((cut) => {
    const point = mapPoint({ x: cut.x, y: cut.y });
    p.push();
    p.translate(point.x, point.y);
    p.rotate(cut.tilt);
    p.noStroke();
    p.fill(5, 7, 7, 240);
    p.beginShape();
    p.vertex(-cut.width * p.width, 0);
    p.vertex(cut.width * p.width * 0.82, -cut.height * p.height);
    p.vertex(cut.width * p.width, cut.height * p.height * 0.72);
    p.vertex(-cut.width * p.width * 0.7, cut.height * p.height);
    p.endShape(p.CLOSE);
    p.noFill();
    p.stroke(PALETTE.bone);
    p.strokeWeight(0.75);
    p.line(-cut.width * p.width * 0.82, -cut.height * p.height * 0.6, cut.width * p.width * 0.72, cut.height * p.height * 0.5);
    p.pop();
  });
  frame.body.deposits.forEach((deposit) => {
    const point = mapPoint({ x: deposit.x, y: deposit.y });
    p.push();
    p.translate(point.x, point.y);
    p.rotate(deposit.tilt);
    p.noStroke();
    p.fill(deposit.mode === 'shear' ? PALETTE.amber : PALETTE.rust);
    p.beginShape();
    p.vertex(-deposit.width * p.width, 0);
    p.vertex(-deposit.width * p.width * 0.2, -deposit.height * p.height);
    p.vertex(deposit.width * p.width, -deposit.height * p.height * 0.35);
    p.vertex(deposit.width * p.width * 0.4, deposit.height * p.height);
    p.endShape(p.CLOSE);
    p.stroke(PALETTE.bone);
    p.strokeWeight(0.65);
    p.line(-deposit.width * p.width * 0.7, 0, deposit.width * p.width * 0.7, -deposit.height * p.height * 0.35);
    p.pop();
  });
}

function drawPressureField() {
  if (document.documentElement.classList.contains('blind-mode')) return;
  const p = p5Instance;
  frame.body.pressureThresholds.forEach((threshold, index) => {
    const point = mapPoint(threshold);
    p.push();
    p.stroke(translucent(index % 2 ? PALETTE.sage : PALETTE.blue, 85));
    p.strokeWeight(0.8);
    p.line(point.x, point.y - p.height * 0.045, point.x, point.y + p.height * 0.045);
    p.noStroke();
    p.fill(translucent(index % 2 ? PALETTE.sage : PALETTE.blue, 130));
    p.ellipse(point.x, point.y, 4 + threshold.width * p.width * 0.18, 4 + threshold.width * p.width * 0.18);
    p.pop();
  });
  if (frame.pending.active && frame.pending.path.length > 1) {
    p.push();
    p.noFill();
    p.stroke(translucent(PALETTE.bone, 150));
    p.strokeWeight(1.1);
    p.beginShape();
    frame.pending.path.forEach((point) => {
      const mapped = mapPoint(point);
      p.vertex(mapped.x, mapped.y);
    });
    p.endShape();
    p.pop();
  }
}

function drawComposition() {
  drawAtmosphere();
  drawFieldShadow();
  drawStrata();
  drawCutsAndDeposits();
  drawPressureField();
}

function beginTouch(event) {
  if (staticMode) return;
  event.preventDefault();
  tracking = true;
  pointerId = event.pointerId;
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
  renderFrame(beginScrape(frame, normalizedPoint(event)));
}

function moveTouch(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  renderFrame(continueScrape(frame, normalizedPoint(event)));
}

function endTouch(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
  renderFrame(commitScrape(frame, normalizedPoint(event), 'visitor-counterfield'));
  tracking = false;
  pointerId = null;
}

function cancelTouch() {
  tracking = false;
  pointerId = null;
  renderFrame(frame);
}

function performControlTraverse() {
  if (staticMode) return;
  renderFrame(applyScrape(frame, TRAVERSE_PATH, 'control-traverse'));
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginTouch);
  renderer.elt.addEventListener('pointermove', moveTouch);
  renderer.elt.addEventListener('pointerup', endTouch);
  renderer.elt.addEventListener('pointercancel', cancelTouch);
}

function bindControls() {
  document.querySelector('[data-gesture="traverse"]')?.addEventListener('click', performControlTraverse);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlTraverse();
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
      p5Instance.saveCanvas('mutine-brush-v044', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.RGB, 255, 255, 255, 255);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV044 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      traverse: performControlTraverse,
      begin: (point) => renderFrame(beginScrape(frame, point)),
      continue: (point) => renderFrame(continueScrape(frame, point)),
      commit: (point) => renderFrame(commitScrape(frame, point, 'probe-counterfield')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      bandCount: BAND_COUNT,
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
