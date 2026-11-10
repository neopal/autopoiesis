import {
  buildField,
  buildTimeline,
  commitCounterstroke,
  geometrySignature,
  liftLatest,
  recordPoint,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const stageNode = document.querySelector('[data-profile-stage]');
const svgNode = document.querySelector('[data-profile-svg]');
const ribsNode = document.querySelector('[data-profile-ribs]');
const echoesNode = document.querySelector('[data-profile-echoes]');
const spineNode = document.querySelector('[data-profile-spine]');
const shadowNode = document.querySelector('[data-profile-shadow]');
const slitNode = document.querySelector('[data-profile-slit]');
const nucleusNode = document.querySelector('[data-profile-nucleus]');
const fieldCanvasNode = document.querySelector('[data-field-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

const KEYBOARD_STROKE = [
  [0.14, 0.68], [0.30, 0.54], [0.20, 0.42], [0.44, 0.30],
  [0.34, 0.18], [0.66, 0.24], [0.56, 0.62], [0.86, 0.40]
];

let field = staticMode ? buildTimeline().at(-1) : buildField();
let p5Instance;
let pointerStroke = null;

const stateText = (stage) => {
  if (stage === 'quiet profile') return 'the portrait is keeping its first contour';
  if (stage.startsWith('counterstroke held')) return 'the profile is storing a reversal, not a mark';
  if (stage === 'refused / no counterpressure') return 'a straight answer cannot move the portrait';
  if (stage.startsWith('rewritten /')) return 'the profile moved the pressure through itself';
  if (stage === 'lifted / exact') return 'the latest counterprofile was lifted exactly';
  if (stage === 'released / quiet') return 'the portrait returned to its first contour';
  return 'the portrait is making a decision';
};

function renderStatus(stage = field.interaction) {
  readoutNode.textContent = `${stage} / ${String(field.document.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${field.memory.length} rewrite${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.pending.length
    ? `${field.pending.length} points held · reverse direction before release`
    : 'draw a counterstroke · reverse direction three times · release';
  stageNode.dataset.revision = String(field.document.revision);
  stageNode.classList.remove('mode-quiet', 'mode-flare', 'mode-hinge', 'mode-counter', 'mode-drift');
  stageNode.classList.add(`mode-${field.document.mode}`);
}

function ribPath(rib, offset = 0) {
  const x = 500 + (rib.x + offset) * 350;
  const y = 380 + rib.y * 320;
  const dx = Math.cos(rib.angle) * rib.length * 330;
  const dy = Math.sin(rib.angle) * rib.length * 330;
  const bend = Math.sin(rib.index * 0.63 + field.document.phase * 6.28) * 18;
  return `M ${x.toFixed(2)} ${y.toFixed(2)} Q ${(x + dx * .48 + bend).toFixed(2)} ${(y + dy * .42 - bend * .25).toFixed(2)} ${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`;
}

function spinePath() {
  const points = field.ribs.map((rib) => [500 + rib.x * 350, 380 + rib.y * 320]);
  if (!points.length) return '';
  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const cx = (previous[0] + current[0]) / 2 + Math.sin(index * .7 + field.document.phase) * 18;
    path += ` Q ${cx.toFixed(2)} ${((previous[1] + current[1]) / 2).toFixed(2)} ${current[0].toFixed(2)} ${current[1].toFixed(2)}`;
  }
  return path;
}

function renderSvg() {
  ribsNode.replaceChildren();
  echoesNode.replaceChildren();
  for (const rib of field.ribs) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('profile-rib');
    if (field.document.mode === 'quiet') path.classList.add('profile-rib--quiet');
    path.dataset.ribIndex = String(rib.index);
    path.setAttribute('d', ribPath(rib));
    path.style.strokeWidth = `${(rib.weight * 100).toFixed(2)}`;
    path.style.opacity = `${0.54 + rib.echo}`;
    ribsNode.append(path);

    const echo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    echo.classList.add('profile-echo');
    echo.dataset.echoIndex = String(rib.index);
    echo.setAttribute('d', ribPath(rib, rib.echo * (field.document.hand || .4)));
    echo.style.opacity = `${Math.min(.8, rib.echo + field.document.revision * .04)}`;
    echoesNode.append(echo);
  }
  const spine = spinePath();
  spineNode.setAttribute('d', spine);
  shadowNode.setAttribute('d', spine);
  const aperture = 70 + field.document.aperture * 180;
  const slant = field.document.hand * 130;
  slitNode.setAttribute('d', `M ${500 - aperture * .13} 92 C ${500 + slant} 210 ${500 - slant} 290 ${500 + aperture * .12} 380 C ${500 + slant} 470 ${500 - slant} 560 ${500 + aperture * .13} 668`);
  slitNode.style.opacity = field.document.revision ? '.92' : '.35';
  nucleusNode.setAttribute('cx', String(500 + field.document.hand * 92));
  nucleusNode.setAttribute('cy', String(380 + Math.sin(field.document.phase * Math.PI * 2) * 22));
  nucleusNode.setAttribute('r', String(4 + field.document.revision * 1.5));
}

function renderAll(stage = field.interaction) {
  renderSvg();
  renderStatus(stage);
  p5Instance?.redraw();
}

function stagePoint(event) {
  const rect = stageNode.getBoundingClientRect();
  return [
    Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
    Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
  ];
}

function storePoint(x, y, time = performance.now()) {
  field = recordPoint(field, x, y, time);
  renderAll(field.interaction);
}

function commitStroke() {
  if (staticMode) return { accepted: false, field };
  const result = commitCounterstroke(field);
  field = result.field;
  renderAll(field.interaction);
  stageNode.focus({ preventScroll: true });
  return result;
}

function commitValid() {
  if (staticMode) return { accepted: false, field };
  field = buildFieldFromPoints(KEYBOARD_STROKE);
  return commitStroke();
}

function buildFieldFromPoints(points) {
  return points.reduce((current, [x, y], index) => recordPoint(current, x, y, index * 40), field);
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  renderAll('lifted / exact');
  stageNode.focus({ preventScroll: true });
  return field;
}

function releaseMemory() {
  if (staticMode) return field;
  field = releaseField();
  renderAll('released / quiet');
  stageNode.focus({ preventScroll: true });
  return field;
}

function onPointerDown(event) {
  if (staticMode || event.target.closest('.counterpressure-controls')) return;
  event.preventDefault();
  const [x, y] = stagePoint(event);
  pointerStroke = { pointerId: event.pointerId };
  stageNode.setPointerCapture?.(event.pointerId);
  storePoint(x, y);
}

function onPointerMove(event) {
  if (staticMode || !pointerStroke || event.pointerId !== pointerStroke.pointerId) return;
  event.preventDefault();
  const [x, y] = stagePoint(event);
  storePoint(x, y);
}

function onPointerUp(event) {
  if (staticMode || !pointerStroke || event.pointerId !== pointerStroke.pointerId || event.target.closest('.counterpressure-controls')) return;
  event.preventDefault();
  const [x, y] = stagePoint(event);
  storePoint(x, y);
  pointerStroke = null;
  commitStroke();
}

stageNode.addEventListener('pointerdown', onPointerDown);
stageNode.addEventListener('pointermove', onPointerMove);
stageNode.addEventListener('pointerup', onPointerUp);
stageNode.addEventListener('pointercancel', () => { pointerStroke = null; });
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const points = direction === 1 ? KEYBOARD_STROKE : [...KEYBOARD_STROKE].reverse();
    field = recordPoint(field, ...points[Math.min(field.pending.length, points.length - 1)], field.pending.length * 40);
    renderAll(field.interaction);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitStroke(); return; }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); return; }
  if (event.key === 'Escape') { event.preventDefault(); releaseMemory(); }
});

document.querySelector('[data-action="counterstroke"]').addEventListener('click', commitValid);
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', releaseMemory);

function drawField(p) {
  p.colorMode(p.HSB, 360, 100, 100, 100);
  p.background(193, 48, 5);
  const phase = field.document.phase * Math.PI * 2;
  p.push();
  p.noFill();
  for (let ring = 0; ring < 13; ring += 1) {
    const wobble = Math.sin(phase + ring * .41) * 12;
    p.stroke(ring % 3 === 0 ? 27 : 184, 35, 16 + ring * 2.1, 8 + ring * .8);
    p.strokeWeight(ring % 4 === 0 ? 1.2 : .6);
    p.ellipse(p.width * .52 + wobble, p.height * .51, p.width * (.22 + ring * .045), p.height * (.54 + ring * .012));
  }
  for (let beam = -8; beam < 10; beam += 1) {
    const y = p.height * (.5 + beam * .08) + Math.sin(phase * .7 + beam) * 18;
    p.stroke(164, 24, 30, 7);
    p.line(0, y, p.width, y + Math.sin(beam * .7 + phase) * 55);
  }
  p.pop();
}

new p5((p) => {
  p.setup = () => {
    p5Instance = p;
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(1, fieldCanvasNode.clientWidth), Math.max(1, fieldCanvasNode.clientHeight), p.P2D);
    canvas.parent(fieldCanvasNode);
    p.noLoop();
    renderAll(staticMode ? `rewritten / ${field.document.mode}` : field.interaction);
    window.__mutinePortraitV047 = {
      getState: () => field,
      geometrySignature: () => geometrySignature(field),
      record: storePoint,
      commit: commitStroke,
      commitValid,
      lift,
      release: releaseMemory
    };
    window._p5Ready = true;
  };
  p.draw = () => drawField(p);
  p.windowResized = () => {
    p.resizeCanvas(Math.max(1, fieldCanvasNode.clientWidth), Math.max(1, fieldCanvasNode.clientHeight));
    drawField(p);
  };
}, fieldCanvasNode);
