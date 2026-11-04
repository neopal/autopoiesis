import {
  LIGATURE_LENGTH,
  PORT_COUNT,
  beginLigature,
  finishLigature,
  commitLigature,
  liftLatest,
  release
} from './engine.mjs';

const field = document.querySelector('#ligature-field');
const svg = document.querySelector('#ligature-svg');
const strokeLayer = document.querySelector('#stroke-layer');
const portLayer = document.querySelector('#port-layer');
const memoryLayer = document.querySelector('#memory-layer');
const ghostLayer = document.querySelector('#ghost-layer');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateText = document.querySelector('#interaction-state');
const interactionState = document.querySelector('[data-interaction-state]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const NS = 'http://www.w3.org/2000/svg';
const DETERMINISTIC_PAIR = [1, 5];
const STROKE_PATHS = [
  'M -112 -32 C -60 -122 42 -105 95 -34 S 48 106 -72 78',
  'M -108 -64 C -12 -108 94 -42 55 12 S -35 116 -98 45',
  'M -106 52 C -50 -54 38 -122 101 -35 S 40 98 -78 53',
  'M -94 -84 C 16 -122 110 -32 44 22 S -34 112 -98 64'
];
let frame = release();
let pointerStart = null;
let pointerPoint = null;
let keyboardCursor = 0;

function createSvg(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function strokePath(stroke) {
  const base = STROKE_PATHS[stroke.id % STROKE_PATHS.length];
  const direction = stroke.id % 2 ? -1 : 1;
  const kink = stroke.bend * 22;
  const suffix = stroke.role === 'fused'
    ? ` M ${direction * -72} ${48 + kink} C ${direction * -18} ${8 - kink} ${direction * 22} ${-12 + kink} ${direction * 82} ${-64 - kink}`
    : stroke.role === 'hinged'
      ? ` M ${direction * -70} ${-54 - kink} C ${direction * -18} ${-10 + kink} ${direction * 26} ${18 - kink} ${direction * 78} ${58 + kink}`
      : '';
  return `${base}${suffix}`;
}

function strokeTransform(stroke) {
  return `translate(${stroke.x * 1100} ${stroke.y * 760}) rotate(${stroke.angle}) scale(${stroke.width * stroke.scale} ${stroke.scale})`;
}

function renderStroke(stroke) {
  const group = createSvg('g', {
    class: `route-group route-group--${stroke.role}`,
    transform: strokeTransform(stroke),
    'data-stroke-id': stroke.id
  });
  const shadow = createSvg('path', { class: 'route-shadow', d: strokePath(stroke) });
  const route = createSvg('path', { class: 'route', d: strokePath(stroke), 'data-route-id': stroke.id });
  const seam = createSvg('path', { class: 'route-seam', d: strokePath(stroke) });
  group.append(shadow, route, seam);
  if (stroke.role !== 'quiet') {
    const notch = createSvg('path', {
      class: 'route-notch',
      d: stroke.role === 'fused' ? 'M -26 -8 L 26 8 M -18 10 L 18 22' : 'M -32 10 L 28 -6',
      'data-route-role': stroke.role
    });
    group.append(notch);
  }
  return group;
}

function renderPort(port) {
  const group = createSvg('g', { class: 'mouth-group', transform: `translate(${port.x * 1100} ${port.y * 760}) rotate(${port.angle})`, 'data-port-id': port.id });
  const halo = createSvg('circle', { class: 'mouth-halo', r: 30 });
  const mouth = createSvg('circle', { class: 'mouth', r: 15, 'data-port-id': port.id, focusable: 'false' });
  const tooth = createSvg('path', { class: 'mouth-tooth', d: 'M -7 -2 L 7 2' });
  group.append(halo, mouth, tooth);
  return group;
}

function renderMemory(frameState) {
  const marks = frameState.history.flatMap((event, index) => event.sequence.map((portId) => ({ portId, index })));
  memoryLayer.replaceChildren(...marks.map(({ portId, index }) => {
    const port = frameState.field.ports[portId];
    return createSvg('circle', { class: 'memory-mark', cx: port.x * 1100, cy: port.y * 760, r: 20 + index * 3 });
  }));
}

function renderGhost() {
  if (!frame.pending.length || !pointerPoint) {
    ghostLayer.replaceChildren();
    return;
  }
  const start = frame.field.ports[frame.pending[0]];
  const ghost = createSvg('path', {
    class: 'ligature-ghost',
    d: `M ${start.x * 1100} ${start.y * 760} C ${(start.x * 1100 + pointerPoint.x) / 2} ${start.y * 760 - 34} ${(start.x * 1100 + pointerPoint.x) / 2} ${pointerPoint.y + 34} ${pointerPoint.x} ${pointerPoint.y}`
  });
  ghostLayer.append(ghost);
}

function render() {
  strokeLayer.replaceChildren(...frame.field.strokes.map(renderStroke));
  portLayer.replaceChildren(...frame.field.ports.map(renderPort));
  renderMemory(frame);
  renderGhost();
  const count = frame.memory.length;
  stage.textContent = frame.pending.length ? `${frame.pending.length}/${LIGATURE_LENGTH} mouths joined` : frame.lastEvent;
  memoryReadout.textContent = `${count} fusions · ${frame.field.strokes.length} routes`;
  const accessible = frame.pending.length
    ? `Mouth ${frame.pending.join(' then ')} pending. Complete the pair at another open mouth.`
    : count ? `${count} remote hinge fusions remain.` : 'The body is quiet. Eight open routes are holding.';
  stateText.textContent = accessible;
  interactionState.textContent = accessible;
}

function svgPoint(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(svg.getScreenCTM().inverse());
  return { x: local.x, y: local.y };
}

function nearestPort(event) {
  const point = svgPoint(event);
  let choice = null;
  let best = Infinity;
  for (const port of frame.field.ports) {
    const dx = point.x - port.x * 1100;
    const dy = point.y - port.y * 760;
    const distance = Math.hypot(dx, dy);
    if (distance < best) { best = distance; choice = port.id; }
  }
  return best < 82 ? choice : null;
}

function bindDeterministic() {
  frame = beginLigature(frame, DETERMINISTIC_PAIR[0]);
  frame = finishLigature(frame, DETERMINISTIC_PAIR[1]);
  frame = commitLigature(frame);
  render();
}

function handleAction(action) {
  if (action === 'bind') bindDeterministic();
  if (action === 'lift') { frame = liftLatest(frame); render(); }
  if (action === 'release') { frame = release(); pointerStart = null; pointerPoint = null; render(); }
}

field.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') field.classList.add('touch-binding');
  const target = event.target.closest?.('[data-port-id]');
  const portId = target ? Number(target.dataset.portId) : nearestPort(event);
  if (!Number.isInteger(portId)) return;
  pointerStart = portId;
  pointerPoint = svgPoint(event);
  frame = beginLigature(frame, portId);
  try { field.setPointerCapture?.(event.pointerId); } catch { /* synthetic probes have no active pointer capture */ }
  render();
});
field.addEventListener('pointermove', (event) => {
  if (pointerStart === null) return;
  pointerPoint = svgPoint(event);
  renderGhost();
});
field.addEventListener('pointerup', (event) => {
  if (pointerStart === null) return;
  pointerPoint = svgPoint(event);
  const end = nearestPort(event);
  if (Number.isInteger(end)) frame = finishLigature(frame, end);
  if (frame.pending.length === LIGATURE_LENGTH) frame = commitLigature(frame);
  pointerStart = null;
  pointerPoint = null;
  try { field.releasePointerCapture?.(event.pointerId); } catch { /* synthetic probes have no active pointer capture */ }
  render();
});
field.addEventListener('pointercancel', () => { pointerStart = null; pointerPoint = null; render(); });
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardCursor = (keyboardCursor + 1) % PORT_COUNT;
    frame = frame.pending.length ? finishLigature(frame, keyboardCursor) : beginLigature(frame, keyboardCursor);
    render();
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending.length === LIGATURE_LENGTH) frame = commitLigature(frame);
    else bindDeterministic();
    render();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); frame = liftLatest(frame); render(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); frame = release(); render(); }
});
for (const button of actionButtons) button.addEventListener('click', () => handleAction(button.dataset.action));

render();
window.__mutineHandwritingV042 = { getState: () => frame, bindDeterministic, lift: () => { frame = liftLatest(frame); render(); }, release: () => { frame = release(); render(); } };
window._mutineReady = true;
