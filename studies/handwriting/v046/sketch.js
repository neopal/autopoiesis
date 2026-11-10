import {
  TOKEN_COUNT,
  buildTimeline,
  buildFrame,
  commitSelection,
  geometrySignature,
  liftLatest,
  releaseArchive,
  selectRange
} from './engine.mjs';

const field = document.querySelector('#counterform-field');
const tokenLayer = document.querySelector('.counterform-token-layer');
const voidLayer = document.querySelector('.counterform-void-layer');
const memoryReadout = document.querySelector('[data-memory]');
const stateText = document.querySelector('#interaction-state');
const stageText = document.querySelector('[data-stage]');
const interactionState = document.querySelector('[data-interaction-state]');
const staticMode = document.documentElement.classList.contains('static-mode');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let frame = staticMode ? buildTimeline().at(-1) : releaseArchive();
let pointerStart = null;
let keyboardCursor = 0;
let animationFrame = 0;

const rangeIds = (range) => range ? Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index) : [];

function tokenStyle(token) {
  return {
    left: `${token.x * 100}%`,
    top: `${token.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${token.angle}deg) scale(${token.scale}) scaleX(${token.width})`,
    writingMode: token.writingMode,
  };
}

function renderField() {
  const pendingIds = new Set(rangeIds(frame.pending));
  tokenLayer.replaceChildren();
  for (const token of frame.field.tokens) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'counterform-token';
    button.dataset.tokenId = String(token.id);
    button.dataset.role = token.role;
    button.dataset.pending = pendingIds.has(token.id) ? 'true' : 'false';
    button.textContent = token.glyph;
    button.setAttribute('aria-label', `Letter ${token.glyph === '·' ? 'separator' : token.glyph}, position ${token.id + 1}`);
    Object.assign(button.style, tokenStyle(token));
    button.addEventListener('click', () => selectFromToken(token.id));
    tokenLayer.append(button);
  }

  voidLayer.replaceChildren();
  for (const aperture of frame.field.voids) {
    const node = document.createElement('div');
    node.className = 'counterform-void';
    node.style.left = `${aperture.x * 100}%`;
    node.style.top = `${aperture.y * 100}%`;
    node.style.width = `${aperture.width * 100}%`;
    node.style.height = `${aperture.height * 100}%`;
    voidLayer.append(node);
  }
}

function describeState() {
  const cuts = frame.memory.length;
  const pending = frame.pending ? ` Span ${frame.pending.start + 1}–${frame.pending.end + 1} is held.` : ' Drag across three to six letters.';
  const accessible = cuts ? `${cuts} counterforms are present.${pending}` : `The inventory is quiet.${pending}`;
  stageText.textContent = frame.pending ? `${frame.lastEvent} / ${frame.pending.start + 1}–${frame.pending.end + 1}` : frame.lastEvent;
  memoryReadout.textContent = `${cuts} cuts · ${TOKEN_COUNT} letters`;
  stateText.textContent = accessible;
  interactionState.textContent = accessible;
}

function render() {
  renderField();
  describeState();
}

function pointFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

function nearestToken(point) {
  let nearest = null;
  let distance = Infinity;
  for (const token of frame.field.tokens) {
    const dx = point.x - token.x;
    const dy = (point.y - token.y) * (field.clientWidth / Math.max(field.clientHeight, 1));
    const nextDistance = dx * dx + dy * dy;
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = token.id;
    }
  }
  return distance < .075 ? nearest : null;
}

function selectFromToken(id) {
  if (staticMode) return;
  const end = Math.min(TOKEN_COUNT - 1, id + 3);
  frame = selectRange(frame, { start: id, end });
  render();
}

function selectByPointer(event) {
  const id = nearestToken(pointFromEvent(event));
  if (id === null) return;
  if (pointerStart === null) pointerStart = id;
  const start = Math.min(pointerStart, id);
  const end = Math.max(pointerStart, id);
  frame = selectRange(frame, { start, end });
  render();
}

function commitCut() {
  if (staticMode) return;
  frame = commitSelection(frame);
  render();
}

function cutDeterministic() {
  if (staticMode) return;
  const ranges = [{ start: 1, end: 4 }, { start: 7, end: 10 }, { start: 13, end: 16 }, { start: 19, end: 22 }];
  const range = ranges[frame.memory.length];
  if (!range) return;
  frame = commitSelection(selectRange(frame, range));
  render();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || event.target.closest('[data-action]')) return;
  field.setPointerCapture?.(event.pointerId);
  pointerStart = nearestToken(pointFromEvent(event));
  if (pointerStart !== null) selectByPointer(event);
});
field.addEventListener('pointermove', (event) => {
  if (staticMode || pointerStart === null) return;
  selectByPointer(event);
});
field.addEventListener('pointerup', () => { pointerStart = null; });
field.addEventListener('pointercancel', () => { pointerStart = null; });
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    keyboardCursor = (keyboardCursor + (event.key === 'ArrowRight' ? 1 : -1) + TOKEN_COUNT) % TOKEN_COUNT;
    const end = Math.min(TOKEN_COUNT - 1, keyboardCursor + 3);
    frame = selectRange(frame, { start: keyboardCursor, end });
    render();
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending) commitCut(); else cutDeterministic();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    frame = liftLatest(frame);
    render();
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    frame = releaseArchive();
    render();
  }
});

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'cut') commitCut();
    if (button.dataset.action === 'lift') { frame = liftLatest(frame); render(); }
    if (button.dataset.action === 'release') { frame = releaseArchive(); render(); }
  });
}

window.addEventListener('resize', render);
render();
window.__mutineHandwritingV046 = {
  getState: () => frame,
  geometrySignature: () => geometrySignature(frame),
  selectRange: (range) => { frame = selectRange(frame, range); render(); },
  commit: () => { frame = commitSelection(frame); render(); },
  cutDeterministic,
  lift: () => { frame = liftLatest(frame); render(); },
  release: () => { frame = releaseArchive(); render(); }
};
window._mutineReady = true;

function animate(time) {
  animationFrame = time;
  if (!staticMode && !reducedMotion) {
    field.style.setProperty('--counterform-time', String(animationFrame));
    window.requestAnimationFrame(animate);
  }
}
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
