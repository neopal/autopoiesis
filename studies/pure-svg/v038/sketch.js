import {
  FOLD_COUNT,
  MEMORY_WINDOW,
  applyAccord,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAccord,
  releaseField
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const accordControl = document.querySelector('#accord-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_ACCORDS = [
  { start: { x: 0.14, y: 0.18 }, end: { x: 0.83, y: 0.70 } },
  { start: { x: 0.24, y: 0.34 }, end: { x: 0.76, y: 0.34 } },
  { start: { x: 0.13, y: 0.51 }, end: { x: 0.63, y: 0.21 } },
  { start: { x: 0.39, y: 0.75 }, end: { x: 0.83, y: 0.70 } }
];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function centerForFold(fold, current) {
  const side = fold.id % 2 === 0 ? 1 : -1;
  return {
    x: Math.max(0.07, Math.min(0.93, fold.x + fold.offsetX + side * current.state.swayX * 0.44)),
    y: Math.max(0.08, Math.min(0.92, fold.y + fold.offsetY + (fold.id % 3 === 0 ? current.state.swayY : -current.state.swayY * 0.45)))
  };
}

function stateLabel(current) {
  if (current.interaction === 'accord-committed') return 'PAIR REFUSED / COUNTERFOLD PRODUCED ELSEWHERE';
  if (current.interaction === 'accord-refused-incomplete') return 'ONE EDGE REFUSED / OFFER A PAIR';
  if (current.interaction === 'accord-refused-near') return 'NEAR PAIR REFUSED / MARGINS STAY EXACT';
  if (current.interaction === 'accord-refused-same-edge') return 'SAME EDGE REFUSED / NO ACCORD';
  if (current.interaction === 'accord-refused-sprawling') return 'SPRAWLING PAIR REFUSED / FIELD STAYED EXACT';
  if (current.interaction === 'accord-memory-full') return 'FOUR REFUSALS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'accord-lifted') return 'LATEST REFUSAL LIFTED / PRIOR FIELD RESTORED';
  if (current.interaction === 'released') return 'FIELD RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function foldClasses(fold, current) {
  const remembered = new Set(current.memory.flatMap((event) => [
    event.startFold,
    event.endFold,
    event.counterFold,
    event.hingeFold,
    event.echoFold
  ]));
  const classes = ['field-fold', `field-fold--${fold.role}`];
  if (remembered.has(fold.id)) classes.push('field-fold--remembered');
  return classes.join(' ');
}

function offerPath(pair) {
  return `M ${fixed(pair.start.x * 1000)} ${fixed(pair.start.y * 760)} L ${fixed(pair.end.x * 1000)} ${fixed(pair.end.y * 760)}`;
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="48">${stateLabel(current)}</text><text x="958" y="714" text-anchor="end">${FOLD_COUNT} FOLDS / ${current.memory.length} ACCORDS / ${current.event?.committed ? `COUNTER ${current.event.counterFold + 1}` : 'QUIET'}</text></g>`;
  const folds = current.folds.map((fold) => `<path class="${foldClasses(fold, current)}" data-fold="${fold.id}" d="${fold.pathSignature}" fill-rule="evenodd"/>`).join('');
  const creases = current.folds.map((fold) => `<path class="field-crease field-crease--${fold.role}" data-crease="${fold.id}" d="${fold.creaseSignature}"/>`).join('');
  const offer = pointerSession?.start && pointerSession?.end ? `<path class="accord-offer" d="${offerPath(pointerSession)}"/>` : '';
  const counterMarks = current.folds.filter((fold) => fold.role !== 'quiet').map((fold) => {
    const center = centerForFold(fold, current);
    const radius = fold.role === 'counterfold' ? 7 : 4;
    return `<circle class="field-mark field-mark--${fold.role}" cx="${fixed(center.x * 1000)}" cy="${fixed(center.y * 760)}" r="${radius}"/>`;
  }).join('');

  field.innerHTML = `<defs>
    <linearGradient id="field-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b24"/><stop offset=".5" stop-color="#111118"/><stop offset="1" stop-color="#08080d"/></linearGradient>
    <linearGradient id="fold-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9e2d2"/><stop offset=".38" stop-color="#c7d5c1"/><stop offset=".7" stop-color="#b9abc9"/><stop offset="1" stop-color="#d2a18d"/></linearGradient>
    <linearGradient id="counter-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2d4a5"/><stop offset=".52" stop-color="#d69b84"/><stop offset="1" stop-color="#ae9bc6"/></linearGradient>
    <radialGradient id="field-haze" cx="49%" cy="45%" r="65%"><stop offset="0" stop-color="#aeb4d4" stop-opacity=".12"/><stop offset=".72" stop-color="#6c728a" stop-opacity=".03"/><stop offset="1" stop-color="#05050a" stop-opacity="0"/></radialGradient>
    <filter id="field-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="13"/></filter>
    <filter id="field-grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence baseFrequency=".017" numOctaves="2" seed="38" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="760"/>
  <ellipse class="field-haze" cx="500" cy="380" rx="455" ry="330"/>
  <path class="field-margin field-margin--left" d="M 88 92 C 190 134 206 246 122 342 S 188 558 116 666"/>
  <path class="field-margin field-margin--right" d="M 910 108 C 828 194 820 278 892 364 S 820 544 884 664"/>
  <path class="field-middle" d="M 470 86 C 514 204 486 300 522 382 S 484 558 544 676"/>
  <g class="field-fold-shadows" aria-hidden="true">${folds.replaceAll('field-fold', 'field-fold-shadow')}</g>
  <g class="field-folds" filter="url(#field-grain)">${folds}</g>
  <g class="field-creases" aria-hidden="true">${creases}</g>
  <g class="field-markers" aria-hidden="true">${counterMarks}</g>
  ${offer}
  ${labels}`;

  if (current.interaction === 'accord-committed') stageReadout.textContent = 'pair refused · counterfold, hinge, and echo produced elsewhere';
  else if (current.interaction === 'accord-refused-incomplete') stageReadout.textContent = 'one edge refused · offer two separated edges';
  else if (current.interaction === 'accord-refused-near') stageReadout.textContent = 'near pair refused · the margins stayed exact';
  else if (current.interaction === 'accord-refused-same-edge') stageReadout.textContent = 'same edge refused · the field stayed exact';
  else if (current.interaction === 'accord-refused-sprawling') stageReadout.textContent = 'sprawling pair refused · the field stayed exact';
  else if (current.interaction === 'accord-memory-full') stageReadout.textContent = 'four refusals retained · lift or release';
  else if (current.interaction === 'accord-lifted') stageReadout.textContent = 'latest refusal lifted · prior field restored';
  else if (current.interaction === 'released') stageReadout.textContent = 'field released · seed restored';
  else if (pointerSession !== null) stageReadout.textContent = 'two-edge accord in progress · cross the quiet middle';
  else stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;

  memoryReadout.textContent = `${current.memory.length} accords · ${current.event?.committed ? `counterfold ${current.event.counterFold + 1} / hinge ${current.event.hingeFold + 1}` : 'the field is uncommitted'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.foldCount = String(current.folds.length);
  field.dataset.counterfoldCount = String(current.state.counterfoldCount);
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  accordControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  accordControl.textContent = current.memory.length ? 'offer again' : 'offer two edges';
}

function commitAccord(accord) {
  if (staticMode || blind) return;
  frame = applyAccord(frame, accord);
  notice = frame.event?.committed ? 'accord-committed' : frame.interaction;
  render(frame);
}

function deterministicAccord() {
  commitAccord(DEFAULT_ACCORDS[frame.memory.length % DEFAULT_ACCORDS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestAccord(frame);
  notice = 'accord-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseField();
  notice = 'released';
  render(frame);
}

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)))
  };
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, start: normalizedPoint(event.clientX, event.clientY), end: null };
  render(frame);
}, true);

field.addEventListener('pointermove', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  pointerSession.end = normalizedPoint(event.clientX, event.clientY);
  render(frame);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  pointerSession.end = normalizedPoint(event.clientX, event.clientY);
  field.releasePointerCapture?.(event.pointerId);
  const accord = { start: pointerSession.start, end: pointerSession.end };
  pointerSession = null;
  commitAccord(accord);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicAccord();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

accordControl.addEventListener('click', deterministicAccord);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
