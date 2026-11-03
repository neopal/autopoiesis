import {
  GAP_COUNT,
  SILENCE_LENGTH,
  beginSilence,
  appendSilence,
  commitSilence,
  liftLatest,
  release
} from './engine.mjs';

const field = document.querySelector('#negative-field');
const svg = document.querySelector('#negative-svg');
const glyphLayer = document.querySelector('#glyph-layer');
const gapLayer = document.querySelector('#gap-layer');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateText = document.querySelector('#interaction-state');
const interactionState = document.querySelector('[data-interaction-state]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const NS = 'http://www.w3.org/2000/svg';
const QUIET_GAPS = [1, 4, 7];
const glyphFontSize = 118;
let frame = buildInitialFrame();
let pointerGap = null;
let keyboardCursor = 0;

function buildInitialFrame() {
  return release();
}

function createSvg(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function glyphTransform(glyph) {
  const x = glyph.x * 1000;
  const y = glyph.y * 760;
  const widthScale = glyph.width;
  return `translate(${x} ${y}) rotate(${glyph.angle}) scale(${widthScale * glyph.scale} ${glyph.scale})`;
}

function renderGlyph(glyph) {
  const group = createSvg('g', { class: `glyph-group glyph-group--${glyph.role}`, transform: glyphTransform(glyph), 'data-glyph-id': glyph.id });
  const text = createSvg('text', { class: `glyph glyph--${glyph.role}`, x: 0, y: 0, 'font-size': glyphFontSize, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  text.textContent = glyph.char;
  group.append(text);
  if (glyph.role !== 'quiet') {
    const mark = createSvg('path', {
      class: 'glyph-mark',
      d: glyph.role === 'recruited' ? 'M -43 48 L 43 48 M -30 57 L 30 57' : glyph.role === 'hollowed' ? 'M -48 -52 L 48 52 M 48 -52 L -48 52' : 'M -50 58 L 50 42',
      'data-role-mark': glyph.role
    });
    group.append(mark);
  }
  return group;
}

function renderGap(gap) {
  const circle = createSvg('circle', { class: 'gap', cx: gap.x * 1000, cy: gap.y * 760, r: 17, 'data-gap-id': gap.id, focusable: 'false' });
  circle.dataset.gapId = gap.id;
  return circle;
}

function render() {
  glyphLayer.replaceChildren(...frame.field.glyphs.map(renderGlyph));
  gapLayer.replaceChildren(...frame.field.gaps.map((gap) => {
    const node = renderGap(gap);
    if (frame.pending.includes(gap.id)) node.classList.add('gap--visited');
    return node;
  }));
  const count = frame.memory.length;
  stage.textContent = frame.pending.length ? `${frame.pending.length}/${SILENCE_LENGTH} gaps visited` : frame.lastEvent;
  memoryReadout.textContent = `${count} recruitments · ${frame.field.glyphs.length} glyphs`;
  const accessible = frame.pending.length ? `Pending gaps ${frame.pending.join(', ')}. Visit ${SILENCE_LENGTH - frame.pending.length} more.` : count ? `${count} negative syntax readings remain.` : 'The field is quiet. No gaps have been visited.';
  stateText.textContent = accessible;
  interactionState.textContent = accessible;
}

function fieldPoint(event) {
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 1000;
  const y = ((event.clientY - rect.top) / rect.height) * 760;
  return { x, y };
}

function nearestGap(event) {
  const point = fieldPoint(event);
  let choice = null;
  let best = Infinity;
  for (const gap of frame.field.gaps) {
    const dx = point.x - gap.x * 1000;
    const dy = point.y - gap.y * 760;
    const distance = Math.hypot(dx, dy);
    if (distance < best) { best = distance; choice = gap.id; }
  }
  return best < 72 ? choice : null;
}

function visitGap(id, autoCommit = true) {
  if (!Number.isInteger(id)) return;
  frame = frame.pending.length ? appendSilence(frame, id) : beginSilence(frame, id);
  if (autoCommit && frame.pending.length === SILENCE_LENGTH) frame = commitSilence(frame);
  render();
}

function readDeterministic() {
  frame = beginSilence(frame, QUIET_GAPS[0]);
  frame = appendSilence(frame, QUIET_GAPS[1]);
  frame = appendSilence(frame, QUIET_GAPS[2]);
  frame = commitSilence(frame);
  render();
}

function handleAction(action) {
  if (action === 'read') readDeterministic();
  if (action === 'lift') { frame = liftLatest(frame); render(); }
  if (action === 'release') { frame = release(); render(); }
}

field.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') field.classList.add('touch-reading');
  const targetGap = event.target.closest?.('.gap');
  pointerGap = targetGap ? Number(targetGap.dataset.gapId) : nearestGap(event);
  if (pointerGap !== null) field.setPointerCapture?.(event.pointerId);
});
field.addEventListener('pointerup', (event) => {
  if (pointerGap !== null) visitGap(pointerGap);
  pointerGap = null;
  field.releasePointerCapture?.(event.pointerId);
});
field.addEventListener('pointercancel', () => { pointerGap = null; });
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardCursor = (keyboardCursor + 1) % GAP_COUNT;
    visitGap(keyboardCursor, false);
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending.length === SILENCE_LENGTH) frame = commitSilence(frame);
    else readDeterministic();
    render();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); frame = liftLatest(frame); render(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); frame = release(); render(); }
});
for (const button of actionButtons) button.addEventListener('click', () => handleAction(button.dataset.action));

render();
window._mutineReady = true;
