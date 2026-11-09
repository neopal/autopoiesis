import {
  buildField,
  buildTimeline,
  compileMargin,
  liftLatest,
  markToken,
  releaseField,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field = staticMode ? buildTimeline().at(-1) : buildField();
let p5Instance;
let pointerToken = null;
let focusedToken = 0;

const stageNode = document.querySelector('[data-manuscript-stage]');
const manuscriptNode = document.querySelector('[data-manuscript]');
const fieldCanvasNode = document.querySelector('[data-field-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

const stateText = (stage) => ({
  'quiet manuscript': 'the page is keeping its first margin',
  'mark held': 'a line-break claim is provisional',
  'refused / repeated mark': 'the page refuses to count a word twice',
  'refused / insufficient pressure': 'the pressure did not reach the page',
  'refused / incomplete lineation': 'the page needs three different marks',
  'compiled / stagger': 'the page staggered its own measure',
  'compiled / hinge': 'the page hinged its own measure',
  'compiled / spill': 'the page spilled its own measure',
  'compiled / vertical': 'the page turned its own reading direction',
  'lifted / exact': 'the latest lineation was lifted exactly',
  'released / quiet': 'the page returned to its quiet margin'
}[stage] ?? 'the page is making a decision');

function renderStatus(stage = field.interaction) {
  const label = stage.replace('mark held / ', 'mark held / ');
  readoutNode.textContent = `${label} / ${String(field.document.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${field.memory.length} rewrite${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.pending.length
    ? `${field.pending.length} of 3 marks held · add a different word`
    : 'mark three different words · compile the pressure';
  stageNode.dataset.revision = String(field.document.revision);
  stageNode.classList.remove('mode-quiet', 'mode-stagger', 'mode-hinge', 'mode-spill', 'mode-vertical');
  stageNode.classList.add(`mode-${field.document.mode}`);
}

function renderManuscript() {
  manuscriptNode.replaceChildren();
  const pending = new Set(field.pending.map((mark) => mark.index));
  for (const token of field.tokens) {
    const word = document.createElement('span');
    word.dataset.tokenIndex = String(token.index);
    word.textContent = token.text;
    word.setAttribute('role', 'button');
    word.setAttribute('tabindex', token.index === focusedToken ? '0' : '-1');
    word.setAttribute('aria-label', `Mark word ${token.text}, position ${token.index + 1}`);
    word.classList.toggle('is-pending', pending.has(token.index));
    word.style.transform = `translate(calc(-50% + ${token.x * 250}px), calc(-50% + ${token.y * 230}px)) rotate(${token.rotation}rad) scale(${token.scale})`;
    manuscriptNode.append(word);
  }
  p5Instance?.redraw();
}

function renderAll(stage = field.interaction) {
  renderManuscript();
  renderStatus(stage);
}

function commitMark(index, pressure = 0.82, side = index % 2 ? 'outset' : 'inset') {
  if (staticMode) return field;
  field = markToken(field, index, pressure, side);
  focusedToken = index;
  renderAll(field.interaction);
  return field;
}

function compile() {
  if (staticMode) return { accepted: false, field };
  const result = compileMargin(field);
  field = result.field;
  renderAll(field.interaction);
  stageNode.focus({ preventScroll: true });
  return result;
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  renderAll('lifted / exact');
  stageNode.focus({ preventScroll: true });
  return field;
}

function release() {
  if (staticMode) return field;
  field = releaseField();
  renderAll('released / quiet');
  stageNode.focus({ preventScroll: true });
  return field;
}

function tokenFromTarget(target) {
  const token = target.closest?.('[data-token-index]');
  return token ? Number(token.dataset.tokenIndex) : null;
}

function pointerPressure(event, tokenNode) {
  const rect = tokenNode.getBoundingClientRect();
  const offset = Math.abs((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
  return Math.min(1, 0.68 + offset * 0.24);
}

function onPointerDown(event) {
  if (staticMode || event.target.closest('.margin-controls')) return;
  const tokenIndex = tokenFromTarget(event.target);
  if (tokenIndex === null) return;
  event.preventDefault();
  pointerToken = { index: tokenIndex, node: event.target.closest('[data-token-index]') };
  stageNode.setPointerCapture?.(event.pointerId);
}

function onPointerUp(event) {
  if (staticMode || !pointerToken || event.target.closest('.margin-controls')) return;
  event.preventDefault();
  const token = pointerToken;
  pointerToken = null;
  const pressure = pointerPressure(event, token.node);
  const side = event.clientX >= token.node.getBoundingClientRect().left + token.node.getBoundingClientRect().width / 2 ? 'outset' : 'inset';
  commitMark(token.index, pressure, side);
}

stageNode.addEventListener('pointerdown', onPointerDown);
stageNode.addEventListener('pointerup', onPointerUp);
stageNode.addEventListener('pointercancel', () => { pointerToken = null; });
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    focusedToken = (focusedToken + (event.key === 'ArrowRight' ? 1 : -1) + field.tokens.length) % field.tokens.length;
    renderManuscript();
    manuscriptNode.querySelector(`[data-token-index="${focusedToken}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitMark(focusedToken, 0.82, focusedToken % 2 ? 'outset' : 'inset');
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); return; }
  if (event.key === 'Escape') { event.preventDefault(); release(); }
});

document.querySelector('[data-action="compile"]').addEventListener('click', compile);
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', release);

function drawField(p) {
  p.colorMode(p.HSB, 360, 100, 100, 100);
  p.background(13, 30, 9);
  p.push();
  p.noStroke();
  for (let index = 0; index < 18; index += 1) {
    const phase = field.document.phase * Math.PI * 2 + index * .37;
    const hue = index % 2 ? 12 : 186;
    p.fill(hue, 28, 12 + index * .55, 9);
    p.ellipse(p.width * (.16 + Math.sin(phase) * .07), p.height * (.18 + index * .045), p.width * (.8 - index * .022), p.height * (.42 - index * .012));
  }
  p.pop();
  p.push();
  p.noFill();
  p.stroke(32, 18, 70, 12);
  p.strokeWeight(1);
  const phase = field.document.phase * Math.PI * 2;
  for (let index = -8; index < 14; index += 1) {
    const y = index * p.height * .09 + Math.sin(phase + index * .4) * 12;
    p.line(0, y, p.width, y + p.height * .12);
  }
  p.pop();
}

new p5((p) => {
  p.setup = () => {
    p5Instance = p;
    p.pixelDensity(1);
    const width = Math.max(1, fieldCanvasNode.clientWidth);
    const height = Math.max(1, fieldCanvasNode.clientHeight);
    const canvas = p.createCanvas(width, height, p.P2D);
    canvas.parent(fieldCanvasNode);
    p.noLoop();
    renderAll(staticMode ? `compiled / ${field.document.mode}` : field.interaction);
    window.__mutinePortraitV046 = {
      getState: () => field,
      geometrySignature: () => geometrySignature(field),
      mark: commitMark,
      compile,
      compileValid: () => {
        for (const index of [1, 6, 10]) commitMark(index, 0.82, index === 6 ? 'outset' : 'inset');
        return compile();
      },
      lift,
      release
    };
    window._p5Ready = true;
  };
  p.draw = () => drawField(p);
  p.windowResized = () => {
    p.resizeCanvas(Math.max(1, fieldCanvasNode.clientWidth), Math.max(1, fieldCanvasNode.clientHeight));
    drawField(p);
  };
}, fieldCanvasNode);
