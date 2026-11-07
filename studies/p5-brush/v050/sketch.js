import {
  ERASE_THRESHOLD,
  RIB_COUNT,
  STAGES,
  applyErase,
  armErase,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  liftSite,
  releaseErase,
  releaseField,
  traceErase
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#relief-field');
const canvasHost = document.querySelector('#relief-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;
const blindMode = params.get('blind') === '1';

const PALETTE = {
  night: [218, 39, 7],
  deep: [218, 53, 11],
  paper: [43, 18, 90],
  umber: [25, 62, 59],
  clay: [15, 67, 79],
  ochre: [36, 74, 88],
  mint: [161, 28, 75],
  ember: [8, 77, 90],
  cut: [214, 48, 5],
  seam: [31, 44, 68]
};
const RIB_COLORS = [PALETTE.umber, PALETTE.clay, PALETTE.ochre, PALETTE.mint, PALETTE.paper];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let selectedSite = 0;
let pointerTrace = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(500, canvasHost.clientHeight || Math.min(820, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    quiet: 'The relief is closed. Lift an edge, move inward, return, and release.',
    'erase-armed': 'An edge is held. Draw inward, then reverse before you release.',
    'erase-tracing': 'The material is measuring the return. Do not release yet.',
    'erase-refused-site': 'The relief has only three lift edges.',
    'erase-refused-active': 'One edge is already being lifted.',
    'erase-refused-short': 'The lift was too short. The relief kept its edge.',
    'erase-refused-direction': 'The stroke never returned. Nothing was removed.',
    'erase-refused-empty': 'No edge was lifted. The relief remains closed.',
    'erase-committed': 'The edge is gone. The neighbouring ribs have closed around the cut.',
    lifted: 'The latest subtraction is lifted. The prior relief returns exactly.',
    'lift-refused': 'There is no subtraction to lift.',
    released: 'The relief releases every remembered subtraction.'
  };
  return messages[interaction] || 'The relief is listening for a reversible lift.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `RELIEF ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering subtraction' : 'closed relief'} · ${frame.memory.length} cut${frame.memory.length === 1 ? '' : 's'} retained`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.04, Math.min(0.96, (event.clientY - rect.top) / rect.height))
  };
}

function screenPoint(point, p) {
  return { x: point.x * p.width, y: point.y * p.height };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestSite(point) {
  const sites = frame.body.liftSites;
  let best = null;
  let bestDistance = Infinity;
  sites.forEach((site) => {
    const next = distance(point, site);
    if (next < bestDistance) {
      best = site;
      bestDistance = next;
    }
  });
  return bestDistance <= 0.105 ? best : null;
}

function drawBackground(p) {
  p.background(...PALETTE.night);
  p.noStroke();
  for (let ring = 0; ring < 22; ring += 1) {
    p.fill(...PALETTE.deep, 2.5 + ring * 0.28);
    const x = p.width * (0.5 + Math.sin(ring * 1.47) * 0.28);
    const y = p.height * (0.51 + Math.cos(ring * 1.17) * 0.24);
    p.ellipse(x, y, p.width * (0.95 - ring * 0.027), p.height * (0.86 - ring * 0.024));
  }
  p.stroke(...PALETTE.seam, 14);
  p.strokeWeight(0.55);
  for (let index = 0; index < 80; index += 1) {
    const x = p.width * (0.04 + ((index * 0.6180339887) % 0.92));
    const y = p.height * (0.04 + ((index * 0.3819660113) % 0.9));
    const length = 3 + Math.abs(Math.sin(index * 12.9898)) * 14;
    p.line(x, y, x + length, y - length * 0.16);
  }
}

function drawPlateShadow(p) {
  const cx = p.width * 0.5;
  const cy = p.height * 0.53;
  p.push();
  p.translate(cx + p.width * 0.018, cy + p.height * 0.025);
  p.rotate(-0.04);
  p.noStroke();
  p.fill(0, 0, 0, 50);
  p.beginShape();
  p.vertex(-p.width * 0.31, -p.height * 0.34);
  p.vertex(p.width * 0.31, -p.height * 0.3);
  p.vertex(p.width * 0.34, p.height * 0.3);
  p.vertex(-p.width * 0.28, p.height * 0.35);
  p.endShape(p.CLOSE);
  p.pop();
}

function drawReliefBase(p) {
  const cx = p.width * 0.5;
  const cy = p.height * 0.53;
  p.push();
  p.translate(cx, cy);
  p.rotate(-0.035);
  p.noStroke();
  p.fill(...PALETTE.deep, 95);
  p.beginShape();
  p.vertex(-p.width * 0.31, -p.height * 0.34);
  p.vertex(p.width * 0.28, -p.height * 0.3);
  p.vertex(p.width * 0.32, p.height * 0.27);
  p.vertex(p.width * 0.22, p.height * 0.35);
  p.vertex(-p.width * 0.3, p.height * 0.31);
  p.endShape(p.CLOSE);
  p.pop();
}

function drawRib(p, rib, index) {
  const scale = Math.min(p.width, p.height);
  const cx = rib.x * p.width;
  const cy = rib.y * p.height;
  const width = rib.width * scale;
  const height = rib.height * scale;
  const notch = Math.min(0.82, rib.notch);
  const lean = rib.lean * scale;
  const color = RIB_COLORS[index % RIB_COLORS.length];

  p.push();
  p.translate(cx, cy);
  p.rotate(rib.lean * 0.28);
  p.noStroke();
  p.fill(...color, 76 + rib.fold * 9);
  p.beginShape();
  p.vertex(-width * 0.53 + lean * 0.08, -height * 0.48);
  p.vertex(-width * 0.13, -height * 0.6);
  p.vertex(width * 0.49, -height * 0.36);
  p.vertex(width * 0.54, height * 0.24);
  p.vertex(width * 0.2, height * 0.55);
  p.vertex(-width * 0.4, height * 0.43);
  p.vertex(-width * (0.48 - notch * 0.28), height * 0.02);
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke(...PALETTE.paper, 28 + rib.fold * 15);
  p.strokeWeight(0.8 + rib.fold * 0.55);
  p.beginShape();
  p.vertex(-width * 0.4, -height * 0.12);
  p.bezierVertex(-width * 0.1, -height * (0.68 - notch * 0.2), width * 0.22, height * 0.06, width * 0.44, height * 0.3);
  p.endShape();

  p.stroke(...PALETTE.seam, 24 + rib.grain * 18);
  p.strokeWeight(0.55);
  p.beginShape();
  p.vertex(-width * 0.42, height * 0.18);
  p.bezierVertex(-width * 0.1, height * 0.44, width * 0.2, height * 0.48, width * 0.38, height * 0.16);
  p.endShape();
  p.pop();
}

function drawCutout(p, cutout, index) {
  const scale = Math.min(p.width, p.height);
  const x = cutout.x * p.width;
  const y = cutout.y * p.height;
  const width = cutout.width * scale;
  const height = cutout.height * scale;
  p.push();
  p.translate(x, y);
  p.rotate(cutout.lean);
  p.noStroke();
  p.fill(...PALETTE.cut, 38 + cutout.depth * 34);
  p.beginShape();
  p.vertex(-width * 0.62, -height * 0.28);
  p.vertex(-width * 0.1, -height * 0.6);
  p.vertex(width * 0.64, -height * 0.18);
  p.vertex(width * 0.44, height * 0.52);
  p.vertex(-width * 0.42, height * 0.58);
  p.endShape(p.CLOSE);
  p.fill(...PALETTE.night, 88);
  p.beginShape();
  p.vertex(-width * 0.43, -height * 0.17);
  p.vertex(-width * 0.04, -height * 0.39);
  p.vertex(width * 0.43, -height * 0.08);
  p.vertex(width * 0.3, height * 0.35);
  p.vertex(-width * 0.32, height * 0.38);
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(...PALETTE.ember, 70 - index * 8);
  p.strokeWeight(1.35 - index * 0.1);
  p.arc(0, 0, width * 1.1, height * 1.1, -0.8, 1.8);
  p.pop();
}

function drawLiftSite(p, site, active) {
  const point = screenPoint(site, p);
  const radius = site.radius * Math.min(p.width, p.height);
  p.push();
  p.translate(point.x, point.y);
  p.noFill();
  p.stroke(...PALETTE.ember, active ? 88 : 38);
  p.strokeWeight(active ? 2 : 0.8);
  p.arc(0, 0, radius * 2.3, radius * 1.15, Math.PI * 0.1, Math.PI * 0.9);
  p.stroke(...PALETTE.paper, active ? 74 : 24);
  p.strokeWeight(0.7);
  p.line(-radius * 0.7, radius * 0.1, radius * 0.7, radius * 0.1);
  p.pop();
}

function drawPending(p) {
  if (blindMode || !frame.pending.active) return;
  const site = liftSite(frame, frame.pending.site);
  if (!site) return;
  const start = screenPoint(site, p);
  p.push();
  p.noFill();
  p.stroke(...PALETTE.ember, 55);
  p.strokeWeight(1.2);
  p.beginShape();
  p.vertex(start.x, start.y);
  p.bezierVertex(p.width * 0.5, p.height * 0.2, p.width * 0.5, p.height * 0.28, p.width * 0.5, p.height * 0.36);
  p.endShape();
  p.pop();
}

function drawComposition(p) {
  drawBackground(p);
  drawPlateShadow(p);
  drawReliefBase(p);
  frame.body.ribs.forEach((rib, index) => drawRib(p, rib, index));
  frame.body.cutouts.forEach((cutout, index) => drawCutout(p, cutout, index));
  if (!blindMode) frame.body.liftSites.forEach((site) => drawLiftSite(p, site, frame.pending.site === site.id));
  drawPending(p);
}

function beginPointer(event) {
  if (staticMode || pointerTrace) return;
  const point = normalizedPoint(event);
  const site = nearestSite(point);
  if (!site) return;
  event.preventDefault();
  pointerTrace = { id: event.pointerId, site: site.id, start: point, last: point, travel: 0, progress: 0, reversed: false };
  selectedSite = site.id;
  renderFrame(armErase(frame, site.id));
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
}

function movePointer(event) {
  if (staticMode || !pointerTrace || pointerTrace.id !== event.pointerId) return;
  event.preventDefault();
  const point = normalizedPoint(event);
  const trace = pointerTrace;
  trace.travel += distance(point, trace.last) / 0.7;
  const site = liftSite(frame, trace.site);
  const towardCenter = { x: 0.5 - site.x, y: 0.38 - site.y };
  const magnitude = Math.hypot(towardCenter.x, towardCenter.y) || 1;
  const direction = { x: towardCenter.x / magnitude, y: towardCenter.y / magnitude };
  const delta = { x: point.x - trace.start.x, y: point.y - trace.start.y };
  const progress = delta.x * direction.x + delta.y * direction.y;
  if (progress > trace.progress) trace.progress = progress;
  if (progress < trace.progress - 0.035) trace.reversed = true;
  trace.last = point;
  renderFrame(traceErase(frame, trace.travel, trace.reversed));
}

function endPointer(event) {
  if (staticMode || !pointerTrace || pointerTrace.id !== event.pointerId) return;
  event.preventDefault();
  const trace = pointerTrace;
  pointerTrace = null;
  const next = releaseErase(traceErase(frame, trace.travel, trace.reversed), 'visitor-lift');
  renderFrame(next);
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
}

function cancelPointer() {
  pointerTrace = null;
  renderFrame(buildFrame(frame.stage, frame.memory));
}

function performControlErase() {
  if (staticMode) return;
  renderFrame(applyErase(frame, selectedSite, ERASE_THRESHOLD + 0.12, 'control-lift'));
}

function selectSite(event) {
  const site = event.key === 'ArrowLeft' ? 0 : event.key === 'ArrowUp' ? 1 : event.key === 'ArrowRight' ? 2 : null;
  if (site === null) return false;
  event.preventDefault();
  selectedSite = site;
  renderFrame(buildFrame(frame.stage, frame.memory, 'site-selected'));
  return true;
}

function bindControls() {
  document.querySelector('[data-gesture="erase"]')?.addEventListener('click', performControlErase);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (selectSite(event)) return;
    if ((event.key === 'Enter' || event.key === ' ') && !staticMode) {
      event.preventDefault();
      performControlErase();
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
      p5Instance.saveCanvas('mutine-brush-v050', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.setAttributes('antialias', true);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    renderer.elt.addEventListener('pointerdown', beginPointer);
    renderer.elt.addEventListener('pointermove', movePointer);
    renderer.elt.addEventListener('pointerup', endPointer);
    renderer.elt.addEventListener('pointercancel', cancelPointer);
    renderer.elt.addEventListener('pointerleave', () => {});
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV050 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      erase: performControlErase,
      arm: (site) => renderFrame(armErase(frame, site)),
      trace: (travel, reversed) => renderFrame(traceErase(frame, travel, reversed)),
      releaseErase: () => renderFrame(releaseErase(frame, 'probe-lift')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      liftSite: (site) => liftSite(frame, site),
      ready: true
    };
  };
  p.draw = () => drawComposition(p);
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    p.redraw();
  };
};

p5Instance = new window.p5(sketch, canvasHost);
