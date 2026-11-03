import {
  applyCut,
  beginCut,
  buildFrame,
  buildTimeline,
  commitCut,
  continueCut,
  geometrySignature,
  liftLatest,
  releaseField,
  STAGES
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#cut-field');
const canvasHost = document.querySelector('#cut-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;

const KEYBOARD_ENTRY = { x: 0.08, y: 0.46 };
const KEYBOARD_VOID = { x: 0.5, y: 0.5 };
const KEYBOARD_EXIT = { x: 0.92, y: 0.54 };
const PALETTE = {
  ground: [205, 28, 8],
  deep: [205, 36, 4],
  ink: [46, 12, 92],
  clay: [19, 62, 80],
  rust: [17, 66, 78],
  bone: [39, 21, 87],
  mineral: [174, 30, 66],
  accent: [24, 72, 86],
  cyan: [178, 42, 78],
  mass: [[18, 54, 75], [14, 62, 69], [25, 57, 71], [8, 48, 65], [32, 58, 78], [171, 27, 64], [18, 70, 82], [190, 30, 72], [12, 52, 76]]
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(500, canvasHost.clientHeight || Math.min(820, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The mass is quiet. A cut must pass through absence.',
    'cut-armed-left': 'The near bank is carrying the cut. Enter the dark opening.',
    'cut-armed-right': 'The far bank is carrying the cut. Enter the dark opening.',
    'cut-armed-top': 'The upper bank is carrying the cut. Enter the dark opening.',
    'cut-armed-bottom': 'The lower bank is carrying the cut. Enter the dark opening.',
    'cut-preview': 'The passage is visible only as a possibility. The mass stays exact.',
    'cut-refused-interior': 'A cut must begin on an outer bank, not inside the mass.',
    'cut-refused-exit': 'The passage needs the opposite bank before it can leave the mass.',
    'cut-refused-bypass': 'The cut bypassed the dark opening. Nothing is spent.',
    'cut-refused-no-bank': 'No outer bank is carrying a cut.',
    'cut-refused-route': 'The route does not connect opposite banks through the void.',
    'cut-committed': 'The cut is stored elsewhere: depth moved, absence widened.',
    lifted: 'The latest depth cut has been lifted. The previous mass returns exactly.',
    'lift-refused': 'There is no recent depth cut to lift.',
    released: 'The mass releases every remembered cut.',
    timeline: 'Reduced motion holds four remote depth cuts in the mass.'
  };
  return messages[interaction] || 'The mass is waiting for a through-cut.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `depth ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering depth' : 'quiet mass'} · ${frame.memory.length} cut${frame.memory.length === 1 ? '' : 's'}`;
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

function worldPoint(piece, scale, p) {
  return {
    x: (piece.x - 0.5) * p.width * 0.72,
    y: (piece.y - 0.5) * p.height * 0.76,
    z: piece.z * scale * 0.92
  };
}

function drawAtmosphere(p) {
  p.background(...PALETTE.ground);
  p.ambientLight(30, 42, 43);
  p.directionalLight(160, 130, 108, -0.45, 0.3, -1);
  p.pointLight(80, 150, 138, -p.width * 0.34, -p.height * 0.24, 220);
  p.pointLight(165, 68, 46, p.width * 0.36, p.height * 0.3, 170);

  p.push();
  p.noStroke();
  p.translate(0, 0, -p.width * 0.62);
  p.fill(...PALETTE.deep, 48);
  p.plane(p.width * 2.2, p.height * 2.2);
  p.pop();

  p.push();
  p.stroke(...PALETTE.mineral, 26);
  p.strokeWeight(1);
  for (let index = 0; index < 80; index += 1) {
    const x = ((index * 97) % 113) / 113 - 0.5;
    const y = ((index * 53) % 89) / 89 - 0.5;
    const z = -p.width * 0.35 + ((index * 71) % 100) / 100 * p.width * 0.65;
    p.point(x * p.width * 1.2, y * p.height * 1.1, z);
  }
  p.pop();
}

function drawMass(p) {
  const scale = Math.min(p.width, p.height);
  p.push();
  p.rotateX(-0.12);
  p.rotateY(0.18);
  p.rotateZ(-0.035);
  p.translate(0, 0, 0);

  p.push();
  p.noStroke();
  p.fill(...PALETTE.deep, 150);
  p.translate(0, 0, -scale * 0.08);
  p.box(p.width * 0.72, p.height * 0.76, scale * 0.06);
  p.pop();

  frame.body.mass.forEach((piece, index) => {
    const point = worldPoint(piece, scale, p);
    const tone = PALETTE.mass[index % PALETTE.mass.length];
    const depth = piece.depth * scale * 0.8;
    p.push();
    p.translate(point.x, point.y, point.z);
    p.rotateZ(piece.angle);
    p.rotateY(piece.angle * 0.7 + piece.cut * 0.035);
    p.noStroke();
    p.specularMaterial(...tone, 100);
    p.box(piece.width * p.width * 0.47, piece.height * p.height * 0.47, depth);
    p.push();
    p.translate(0, 0, depth * 0.51);
    p.fill(...PALETTE.bone, 36 + Math.min(54, piece.cut * 18));
    p.plane(piece.width * p.width * 0.39, piece.height * p.height * 0.38);
    p.pop();
    p.pop();
  });

  p.push();
  p.noFill();
  p.stroke(...PALETTE.cyan, 64);
  p.strokeWeight(1.05);
  frame.body.seams.forEach((seam, index) => {
    const left = { x: (seam.a - 0.5) * p.width * 0.62, y: (0.18 + index * 0.085 - 0.5) * p.height * 0.72, z: index * scale * 0.018 };
    const right = { x: (seam.b - 0.5) * p.width * 0.62, y: (0.78 - index * 0.073 - 0.5) * p.height * 0.72, z: -index * scale * 0.015 };
    p.line(left.x, left.y, left.z, right.x, right.y, right.z);
  });
  p.pop();

  frame.body.voids.forEach((voidCell, index) => {
    const x = (voidCell.x - 0.5) * p.width * 0.72;
    const y = (voidCell.y - 0.5) * p.height * 0.76;
    const z = voidCell.z * scale * 0.92 + scale * 0.06;
    p.push();
    p.translate(x, y, z);
    p.rotateZ(voidCell.tilt);
    p.rotateX(Math.PI / 2);
    p.noStroke();
    p.fill(...PALETTE.deep, 210);
    p.torus(voidCell.width * scale * 0.7, Math.max(3, voidCell.depth * scale * 0.12), 18, 8);
    p.rotateZ(Math.PI / 2);
    p.fill(...PALETTE.ink, 90);
    p.ellipse(0, 0, voidCell.width * scale * 1.2, voidCell.height * scale * 1.2);
    p.pop();
    if (index % 2 === 0) {
      p.push();
      p.stroke(...PALETTE.rust, 42 + voidCell.opening * 40);
      p.strokeWeight(1);
      p.noFill();
      p.translate(x, y, z + scale * 0.05);
      p.rotateZ(voidCell.tilt);
      p.ellipse(0, 0, voidCell.width * scale * (1.7 + voidCell.opening * 0.4), voidCell.height * scale * 1.5);
      p.pop();
    }
  });

  frame.body.cuts.forEach((cut, index) => {
    const piece = frame.body.mass[cut.remotePiece];
    const point = worldPoint(piece, scale, p);
    p.push();
    p.translate(point.x, point.y, point.z + (index % 2 ? -1 : 1) * scale * 0.22);
    p.rotateY(index % 2 ? -0.6 : 0.6);
    p.noFill();
    p.stroke(...PALETTE.accent, 70);
    p.strokeWeight(1.2 + cut.pressure * 0.9);
    p.torus(scale * 0.045 + cut.depth * scale * 0.018, 1.4 + cut.pressure * 2.4, 16, 6);
    p.pop();
  });
  p.pop();
}

function drawComposition(p) {
  drawAtmosphere(p);
  drawMass(p);
}

function beginPointer(event) {
  if (staticMode) return;
  event.preventDefault();
  tracking = true;
  pointerId = event.pointerId;
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
  renderFrame(beginCut(frame, normalizedPoint(event)));
}

function movePointer(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  renderFrame(continueCut(frame, normalizedPoint(event)));
}

function endPointer(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
  renderFrame(commitCut(frame, normalizedPoint(event), 'visitor-through-void'));
  tracking = false;
  pointerId = null;
}

function cancelPointer() {
  tracking = false;
  pointerId = null;
  renderFrame(frame);
}

function performControlCut() {
  if (staticMode) return;
  renderFrame(applyCut(frame, KEYBOARD_ENTRY, KEYBOARD_EXIT, [KEYBOARD_ENTRY, KEYBOARD_VOID, KEYBOARD_EXIT], 'control-through-void'));
}

function performKeyboardStep(key) {
  if (staticMode) return;
  if (key === 'ArrowLeft') renderFrame(beginCut(frame, KEYBOARD_ENTRY));
  if (key === 'ArrowRight') renderFrame(continueCut(frame, KEYBOARD_VOID));
  if (key === 'Enter' || key === ' ') renderFrame(commitCut(frame, KEYBOARD_EXIT, 'keyboard-through-void'));
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginPointer);
  renderer.elt.addEventListener('pointermove', movePointer);
  renderer.elt.addEventListener('pointerup', endPointer);
  renderer.elt.addEventListener('pointercancel', cancelPointer);
}

function bindControls() {
  document.querySelector('[data-gesture="cut"]')?.addEventListener('click', performControlCut);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      performKeyboardStep(event.key);
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
      p5Instance.saveCanvas('mutine-brush-v046', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.setAttributes('antialias', true);
    renderer = p.createCanvas(size.width, size.height, p.WEBGL);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV046 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      cut: performControlCut,
      begin: (point) => renderFrame(beginCut(frame, point)),
      continue: (point) => renderFrame(continueCut(frame, point)),
      commit: (point) => renderFrame(commitCut(frame, point, 'probe-through-void')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      massCount: frame.body.mass.length,
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
