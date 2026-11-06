import {
  FOLD_COUNT,
  HOLD_THRESHOLD,
  STAGES,
  applyChord,
  armChord,
  buildFrame,
  buildTimeline,
  geometrySignature,
  holdChord,
  liftLatest,
  pressureSite,
  releaseChord,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#fold-field');
const canvasHost = document.querySelector('#fold-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;
const blindMode = params.get('blind') === '1';

const PALETTE = {
  night: [213, 48, 9],
  nightGlow: [197, 39, 15],
  bone: [42, 21, 88],
  clay: [17, 64, 78],
  rust: [13, 67, 86],
  ember: [5, 73, 89],
  mint: [158, 33, 76],
  saffron: [39, 68, 92],
  lilac: [248, 28, 82],
  seam: [44, 18, 72],
  pressure: [11, 73, 92]
};
const FOLD_COLORS = [PALETTE.clay, PALETTE.bone, PALETTE.rust, PALETTE.mint, PALETTE.saffron, PALETTE.lilac];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let pointerSides = new Map();
let chordStartedAt = 0;
let pressedKeys = new Set();
let keyChordStartedAt = 0;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(500, canvasHost.clientHeight || Math.min(820, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    quiet: 'The sheet is quiet. Two edges must hold together.',
    'chord-armed': 'A pressure site is held. Find its opposite before release.',
    'chord-holding': 'The sheet is listening to duration. Do not release yet.',
    'chord-refused-side': 'The sheet knows only two pressure edges.',
    'chord-refused-repeat': 'One edge cannot make a chord twice.',
    'chord-refused-full': 'The chord is already full. Release or reset.',
    'chord-refused-short': 'The hold was too brief. No fold opens.',
    'chord-refused-incomplete': 'One hand left alone. The sheet kept its shape.',
    'chord-refused-alternation': 'The sheet refuses the same lead twice. Change sides.',
    'chord-refused-empty': 'No pressure was held. The sheet remains quiet.',
    'chord-committed': 'The chord released. A new fold has opened inside the sheet.',
    lifted: 'The latest fold has been lifted. The prior sheet returns exactly.',
    'lift-refused': 'There is no recent fold to lift.',
    released: 'The sheet releases every remembered fold.',
    timeline: 'Reduced motion holds four internal folds.'
  };
  return messages[interaction] || 'The sheet is listening for a pressure chord.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `SHEET ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering duration' : 'quiet sheet'} · ${frame.memory.length} fold${frame.memory.length === 1 ? '' : 's'} opened`;
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

function sideAt(point) {
  if (point.x < 0.3) return 'left';
  if (point.x > 0.7) return 'right';
  return null;
}

function screenPoint(point, p) {
  return { x: point.x * p.width, y: point.y * p.height };
}

function seededNoise(index) {
  return (Math.sin(index * 12.9898 + 4.1414) * 43758.5453) % 1;
}

function drawBackground(p) {
  p.background(...PALETTE.night);
  p.noStroke();
  for (let ring = 0; ring < 18; ring += 1) {
    p.fill(...PALETTE.nightGlow, 3.5 + ring * 0.42);
    const x = p.width * (0.5 + Math.sin(ring * 1.37) * 0.25);
    const y = p.height * (0.51 + Math.cos(ring * 1.19) * 0.29);
    p.ellipse(x, y, p.width * (0.86 - ring * 0.027), p.height * (0.8 - ring * 0.026));
  }
  p.stroke(...PALETTE.seam, 16);
  p.strokeWeight(0.55);
  for (let index = 0; index < 64; index += 1) {
    const x = p.width * (0.05 + ((index * 0.6180339887) % 0.9));
    const y = p.height * (0.06 + ((index * 0.3819660113) % 0.88));
    const length = 3 + Math.abs(seededNoise(index)) * 13;
    p.line(x, y, x + length, y - length * 0.18);
  }
}

function drawPressureSite(p, site, active) {
  const point = screenPoint(site, p);
  const radius = site.radius * Math.min(p.width, p.height);
  p.push();
  p.translate(point.x, point.y);
  p.noFill();
  p.stroke(...PALETTE.pressure, active ? 78 : 34);
  p.strokeWeight(active ? 1.9 : 0.8);
  p.arc(0, 0, radius * 2.5, radius * 1.18, site.id === 'left' ? -1.2 : 1.95, site.id === 'left' ? 1.2 : 4.35);
  p.stroke(...PALETTE.bone, active ? 74 : 22);
  p.strokeWeight(0.7);
  p.line(site.id === 'left' ? -radius * 0.9 : radius * 0.9, 0, site.id === 'left' ? radius * 0.25 : -radius * 0.25, 0);
  p.pop();
}

function drawSheetShadow(p, body) {
  p.push();
  p.translate(p.width * 0.5 + 15, p.height * 0.5 + 18);
  p.rotate(-0.035);
  p.noStroke();
  p.fill(0, 0, 0, 42);
  p.beginShape();
  p.vertex(-p.width * 0.23, -p.height * 0.4);
  p.vertex(p.width * 0.22, -p.height * 0.42);
  p.vertex(p.width * 0.25, p.height * 0.39);
  p.vertex(-p.width * 0.2, p.height * 0.43);
  p.endShape(p.CLOSE);
  p.pop();
  p.stroke(...PALETTE.seam, 30);
  p.strokeWeight(1);
  for (let index = 0; index < body.seams.length; index += 1) {
    const x = p.width * (0.5 + body.seams[index].bend * 1.8);
    const top = p.height * (0.11 + index * 0.104);
    p.line(x - p.width * 0.14, top, x + p.width * 0.14, top + p.height * 0.01);
  }
}

function drawFold(p, fold, index) {
  const scale = Math.min(p.width, p.height);
  const cx = fold.x * p.width;
  const cy = fold.y * p.height;
  const width = fold.width * scale;
  const height = fold.height * scale;
  const lean = fold.lean;
  const color = FOLD_COLORS[index % FOLD_COLORS.length];
  const opening = Math.min(0.62, fold.opening);
  const notch = Math.min(0.78, fold.notch);

  p.push();
  p.translate(cx, cy);
  p.rotate(lean * 0.42);
  p.noStroke();
  p.fill(...color, 74 + fold.crease * 8);
  p.beginShape();
  p.vertex(-width * 0.52, -height * 0.28);
  p.vertex(-width * 0.2, -height * 0.56);
  p.vertex(width * 0.46, -height * 0.42);
  p.vertex(width * 0.56, -height * 0.03);
  p.vertex(width * 0.34, height * 0.42);
  p.vertex(width * 0.05, height * 0.55);
  p.vertex(-width * 0.4, height * 0.31);
  p.vertex(-width * (0.56 - opening * 0.34), height * 0.04);
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke(...PALETTE.bone, 31 + fold.crease * 16);
  p.strokeWeight(0.75 + fold.crease * 0.5);
  p.beginShape();
  p.vertex(-width * 0.4, -height * 0.18);
  p.bezierVertex(-width * 0.1, -height * (0.66 - opening * 0.12), width * 0.24, -height * 0.05, width * 0.42, height * 0.28);
  p.endShape();

  p.stroke(...PALETTE.seam, 28 + fold.grain * 20);
  p.strokeWeight(0.55);
  p.beginShape();
  p.vertex(-width * 0.48, height * 0.05);
  p.bezierVertex(-width * 0.14, height * (0.2 + notch * 0.12), width * 0.11, height * 0.45, width * 0.39, height * 0.3);
  p.endShape();

  if (fold.crease > 0.5) {
    p.stroke(...PALETTE.saffron, 32 + fold.crease * 14);
    p.strokeWeight(1.1);
    p.arc(width * 0.1, -height * 0.03, width * (0.4 + opening * 0.45), height * 0.74, -0.7, 1.9);
  }
  p.pop();
}

function drawFaults(p, body) {
  body.faults.forEach((fault, index) => {
    const fold = body.folds[fault.layer];
    const x = fold.x * p.width;
    const y = fold.y * p.height;
    const reach = fold.width * Math.min(p.width, p.height) * (0.3 + fault.opening * 0.2);
    p.push();
    p.translate(x, y);
    p.rotate(fold.lean * 0.42);
    p.noFill();
    p.stroke(...PALETTE.ember, 72 - index * 8);
    p.strokeWeight(1.5 - index * 0.12);
    p.arc(reach * fault.direction * 0.12, 0, reach, fold.height * Math.min(p.width, p.height) * 1.8, fault.direction > 0 ? -1.2 : 1.7, fault.direction > 0 ? 1.05 : 3.95);
    p.stroke(...PALETTE.bone, 36);
    p.strokeWeight(0.65);
    p.line(-reach * 0.42, fold.height * 0.4, reach * 0.48, -fold.height * 0.34);
    p.pop();
  });
}

function drawComposition(p) {
  drawBackground(p);
  drawSheetShadow(p, frame.body);
  frame.body.folds.forEach((fold, index) => drawFold(p, fold, index));
  drawFaults(p, frame.body);
  if (!blindMode) {
    drawPressureSite(p, pressureSite(frame, 'left'), frame.pending.sides.includes('left'));
    drawPressureSite(p, pressureSite(frame, 'right'), frame.pending.sides.includes('right'));
  }
}

function beginPointer(event) {
  if (staticMode) return;
  event.preventDefault();
  const side = sideAt(normalizedPoint(event));
  if (!side) return;
  pointerSides.set(event.pointerId, side);
  if (!chordStartedAt) chordStartedAt = performance.now();
  renderFrame(armChord(frame, side));
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
}

function endPointer(event) {
  if (staticMode || !pointerSides.has(event.pointerId)) return;
  event.preventDefault();
  const elapsed = performance.now() - chordStartedAt;
  pointerSides.delete(event.pointerId);
  const held = holdChord(frame, elapsed);
  const next = releaseChord(held, 'visitor-chord');
  chordStartedAt = pointerSides.size ? chordStartedAt : 0;
  renderFrame(next);
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
}

function cancelPointers() {
  pointerSides.clear();
  chordStartedAt = 0;
  renderFrame(buildFrame(frame.stage, frame.memory));
}

function performControlChord() {
  if (staticMode) return;
  const lead = frame.memory.length % 2 === 0 ? 'left' : 'right';
  renderFrame(applyChord(frame, lead, HOLD_THRESHOLD + 120, 'control-chord'));
}

function performKeyboard(event) {
  if (staticMode) return;
  const side = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null;
  if (side) {
    event.preventDefault();
    if (!pressedKeys.size) keyChordStartedAt = performance.now();
    pressedKeys.add(side);
    renderFrame(armChord(frame, side));
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && !pressedKeys.size) {
    event.preventDefault();
    performControlChord();
  }
}

function finishKeyboard(event) {
  const side = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null;
  if (!side || !pressedKeys.has(side) || staticMode) return;
  event.preventDefault();
  pressedKeys.delete(side);
  if (!pressedKeys.size) {
    renderFrame(releaseChord(holdChord(frame, performance.now() - keyChordStartedAt), 'keyboard-chord'));
    keyChordStartedAt = 0;
  }
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginPointer);
  renderer.elt.addEventListener('pointerup', endPointer);
  renderer.elt.addEventListener('pointercancel', cancelPointers);
}

function bindControls() {
  document.querySelector('[data-gesture="chord"]')?.addEventListener('click', performControlChord);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', performKeyboard);
  field?.addEventListener('keyup', finishKeyboard);
  field?.addEventListener('keydown', (event) => {
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
      p5Instance.saveCanvas('mutine-brush-v049', 'png');
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
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV049 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      chord: performControlChord,
      arm: (side) => renderFrame(armChord(frame, side)),
      hold: (milliseconds) => renderFrame(holdChord(frame, milliseconds)),
      releaseChord: () => renderFrame(releaseChord(frame, 'probe-chord')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      pressureSite: (side) => pressureSite(frame, side),
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
