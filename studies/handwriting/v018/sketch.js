import {
  STAGES,
  applyPressure,
  buildTimeline,
  removeLatestPressure
} from './engine.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#piece');
const defs = document.querySelector('#defs');
const mask = document.querySelector('#ink-mask');
const paperLayer = document.querySelector('#paper-layer');
const inkLayer = document.querySelector('#ink-layer');
const registrationLayer = document.querySelector('#registration-layer');
const stateNode = document.querySelector('#state');
const pressureButton = document.querySelector('#hold-pressure');
const liftButton = document.querySelector('#lift-perforation');
const releaseButton = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 2200;
const HOLD_MS = 560;
const timeline = buildTimeline(FINAL_STAGE);

let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let startedAt = performance.now();
let animationFrame = 0;
let lastPoint = { x: 0.42, y: 0.38 };
let pressureStartedAt = 0;

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function ensureDefs() {
  defs.replaceChildren();
  const paperGradient = svgElement('linearGradient', { id: 'paper-gradient', x1: '0', y1: '0', x2: '1', y2: '1' });
  paperGradient.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#f2dfbd' }),
    svgElement('stop', { offset: '52%', 'stop-color': '#ddc19b' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#9e624b' })
  );
  const inkMask = svgElement('mask', { id: 'ink-mask', maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: '1200', height: '760' });
  defs.append(paperGradient, inkMask);
  return inkMask;
}

function render() {
  const activeMask = ensureDefs();
  paperLayer.replaceChildren();
  inkLayer.replaceChildren();
  registrationLayer.replaceChildren();

  activeMask.append(svgElement('rect', { x: 0, y: 0, width: 1200, height: 760, fill: 'white' }));
  for (const perforation of frameState.perforations) {
    activeMask.append(svgElement('path', { d: perforation.path, fill: 'black', 'data-kind': perforation.kind }));
  }

  paperLayer.append(
    svgElement('rect', { class: 'paper-ground', x: 0, y: 0, width: 1200, height: 760, fill: 'url(#paper-gradient)' }),
    svgElement('path', { class: 'paper-fold', d: 'M 0 112 C 260 72 440 142 700 106 S 1010 74 1200 124', fill: 'none' }),
    svgElement('path', { class: 'paper-fold paper-fold-lower', d: 'M 0 664 C 320 620 470 692 768 650 S 1020 626 1200 672', fill: 'none' })
  );

  for (const line of frameState.lines) {
    const x = line.x * 1200;
    const y = line.baseline * 760;
    const text = svgElement('text', {
      class: `word word-${line.state}`,
      x,
      y,
      'font-size': line.size,
      'font-weight': line.state === 'punched' ? 650 : 520,
      'letter-spacing': `${line.tracking}em`,
      'data-line': line.id,
      'data-state': line.state,
      'data-pressure-debt': line.pressureDebt,
      transform: `rotate(${line.rotation * 57.2958} ${x} ${y})`
    });
    text.textContent = line.text;
    inkLayer.append(text);
  }

  for (const perforation of frameState.perforations) {
    const mark = svgElement('path', {
      class: 'counter-registration',
      d: perforation.path,
      fill: 'none',
      'data-line': perforation.lineIndex,
      'data-kind': perforation.kind
    });
    registrationLayer.append(mark);
  }

  field.dataset.stage = String(frameState.stage);
  field.dataset.memory = String(frameState.memory.length);
  field.dataset.perforations = String(frameState.perforationCount);
  field.dataset.rerouted = String(frameState.reroutedCount);
  field.dataset.punched = String(frameState.punchedLineCount);
  field.dataset.blind = String(blind);
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (pressureButton) pressureButton.disabled = !interactive || staticPreview;
  if (liftButton) liftButton.disabled = !interactive || staticPreview || frameState.memory.length === 0;
  if (releaseButton) releaseButton.disabled = !interactive || staticPreview;
}

function positionFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / Math.max(1, rect.width),
    y: (event.clientY - rect.top) / Math.max(1, rect.height)
  };
}

function pressAt(point) {
  if (!interactive || staticPreview) return false;
  window.cancelAnimationFrame(animationFrame);
  const changed = applyPressure(frameState, point);
  lastPoint = { x: point.x, y: point.y };
  frameState = changed;
  paused = true;
  updateState('Pressure crossed the threshold: one counter is punched and a later word inherits the missing room.');
  updateButtons();
  render();
  return true;
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = removeLatestPressure(frameState);
  paused = true;
  updateState('The latest pressure lifted; the earlier typographic lock-up is exact again.');
  updateButtons();
  render();
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  paused = false;
  startedAt = performance.now();
  updateState('The ink is closed; pressure has not crossed the counter.');
  updateButtons();
  render();
  animationFrame = window.requestAnimationFrame(drawFrame);
}

function saveStill() {
  const svg = new XMLSerializer().serializeToString(field);
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v018-counter.svg';
  link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  link.click();
  URL.revokeObjectURL(link.href);
}

function drawFrame(now) {
  render();
  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      updateButtons();
    }
    if (nextStage < FINAL_STAGE) animationFrame = window.requestAnimationFrame(drawFrame);
  }
}

field.addEventListener('pointerdown', (event) => {
  if (!interactive || staticPreview) return;
  lastPoint = positionFromEvent(event);
  pressureStartedAt = performance.now();
  field.classList.add('is-pressing');
});
field.addEventListener('pointerup', (event) => {
  if (!interactive || staticPreview) return;
  const point = positionFromEvent(event);
  lastPoint = point;
  const heldFor = performance.now() - pressureStartedAt;
  field.classList.remove('is-pressing');
  if (heldFor >= HOLD_MS) {
    pressAt(point);
  } else {
    updateState('Short pressure refused; hold until the ink gives way.');
  }
});
field.addEventListener('pointercancel', () => {
  pressureStartedAt = 0;
  field.classList.remove('is-pressing');
});
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pressAt(lastPoint);
  }
  if (event.key === 'Delete' || event.key.toLowerCase() === 'u') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
pressureButton?.addEventListener('click', () => pressAt(lastPoint));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', render);

window.__mutineHandwritingV018 = {
  HOLD_MS,
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((entry) => ({ ...entry })),
    perforationCount: frameState.perforationCount,
    reroutedCount: frameState.reroutedCount,
    punchedLineCount: frameState.punchedLineCount,
    paused,
    interactive,
    blind,
    holdThreshold: HOLD_MS
  }),
  pressAt,
  liftLatest,
  releaseSequence,
  getSignature: () => field.innerHTML,
  getField: () => field
};

updateButtons();
drawFrame(performance.now());
