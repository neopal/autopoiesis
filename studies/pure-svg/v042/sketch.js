import {
  GATE_CHAMBERS,
  GATE_COUNT,
  beginSweep,
  buildFrame,
  buildTimeline,
  commitSweep,
  geometrySignature,
  liftLatestSweep,
  releaseRegister,
  visitGate
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
const roleClasses = ['unseal', 'fold', 'seal'];
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let activePointer = false;
let keyboardCursor = 0;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function pointsAttribute(points) {
  return points.map(({ x, y }) => `${x},${y}`).join(' ');
}

function polylinePath(points) {
  if (!points.length) return '';
  const first = points[0];
  const parts = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    parts.push(`Q ${previous.x} ${previous.y} ${midX} ${midY}`);
  }
  const last = points.at(-1);
  parts.push(`Q ${last.x} ${last.y} ${first.x} ${first.y}`);
  return parts.join(' ');
}

function makeDefs() {
  const defs = svgElement('defs');
  const bg = svgElement('linearGradient', { id: 'field-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  bg.append(svgElement('stop', { offset: '0%', 'stop-color': '#121c20' }), svgElement('stop', { offset: '52%', 'stop-color': '#0b1216' }), svgElement('stop', { offset: '100%', 'stop-color': '#1b1417' }));
  const vignette = svgElement('radialGradient', { id: 'field-vignette', cx: '.48', cy: '.46', r: '.72' });
  vignette.append(svgElement('stop', { offset: '0%', 'stop-color': '#f3dfb5', 'stop-opacity': '.08' }), svgElement('stop', { offset: '100%', 'stop-color': '#020506', 'stop-opacity': '.35' }));
  const shadow = svgElement('filter', { id: 'soft-shadow', x: '-20%', y: '-20%', width: '140%', height: '160%' });
  shadow.append(svgElement('feGaussianBlur', { stdDeviation: '10' }));
  const gradients = [
    ['chamber-unseal', '#f4c76a', '#915c38'],
    ['chamber-fold', '#ee8f70', '#743d4c'],
    ['chamber-seal', '#83d1c4', '#2a6670']
  ];
  for (const [id, start, end] of gradients) {
    const gradient = svgElement('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' });
    gradient.append(svgElement('stop', { offset: '0%', 'stop-color': start }), svgElement('stop', { offset: '100%', 'stop-color': end }));
    defs.append(gradient);
  }
  defs.append(bg, vignette, shadow);
  return defs;
}

function roleForChamber(index) {
  const latest = frame.memory.at(-1);
  if (!latest) return '';
  const roleIndex = latest.remoteIndices.indexOf(index);
  return roleIndex >= 0 ? latest.roles[roleIndex] : '';
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  fragment.append(svgElement('rect', { class: 'field-ground', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('rect', { class: 'field-vignette', x: '0', y: '0', width: '1000', height: '760' }));

  const centroids = frame.chambers.map((chamber) => chamber.centroid);
  const rib = svgElement('path', { class: 'body-rib', d: polylinePath(centroids) });
  const innerRib = svgElement('path', { class: 'body-rib-inner', d: polylinePath([...centroids].reverse()) });
  fragment.append(rib, innerRib);

  const activeRoles = new Map();
  const latest = frame.memory.at(-1);
  if (latest) latest.remoteIndices.forEach((index, roleIndex) => activeRoles.set(index, latest.roles[roleIndex]));
  for (const chamber of frame.chambers) {
    const role = activeRoles.get(chamber.index) ?? '';
    const shadow = svgElement('polygon', { class: 'chamber-shadow', points: pointsAttribute(chamber.points) });
    const polygon = svgElement('polygon', { class: `chamber ${role ? `chamber-${role}` : ''}`, points: pointsAttribute(chamber.points), 'data-chamber': String(chamber.index), ...(role ? { 'data-role': role } : {}) });
    const edge = svgElement('polygon', { class: 'chamber-edge', points: pointsAttribute(chamber.points) });
    const cut = chamber.points.slice(1, 4);
    const cutPath = svgElement('path', { class: 'chamber-cut', d: polylinePath(cut) });
    fragment.append(shadow, polygon, edge, cutPath);
  }

  const gates = svgElement('g', { class: 'gate-marks', 'aria-hidden': 'true' });
  for (const gate of frame.gates) {
    const selected = frame.pending.includes(gate.index);
    gates.append(svgElement('circle', { class: `gate-mark${selected ? ' is-pending' : ''}`, cx: gate.x, cy: gate.y, r: gate.radius }));
    gates.append(svgElement('path', { class: 'gate-mark', d: `M ${gate.x - gate.radius / 2} ${gate.y} L ${gate.x + gate.radius / 2} ${gate.y}` }));
  }
  fragment.append(gates);

  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.chamberCount = String(frame.chambers.length);
  field.dataset.gateCount = String(frame.gates.length);
  field.dataset.selected = frame.pending.join(',');
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} knot${frame.memory.length === 1 ? '' : 's'} · ${frame.memory.length ? 'the body remembers elsewhere' : 'no chamber has answered'}`;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1000,
    y: ((event.clientY - rect.top) / rect.height) * 760
  };
}

function gateAt(point) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const gate of frame.gates) {
    const dx = point.x - gate.x;
    const dy = point.y - gate.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= gate.radius * 1.45 && distance < nearestDistance) {
      nearest = gate.index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function deterministicCross() {
  renderFrame(commitSweep(visitGate(beginSweep(frame, keyboardCursor), (keyboardCursor + 3) % GATE_COUNT)));
  keyboardCursor = (keyboardCursor + 1) % GATE_COUNT;
}

field.addEventListener('pointerdown', (event) => {
  const gate = gateAt(localPoint(event));
  if (gate === null) return;
  activePointer = true;
  field.setPointerCapture?.(event.pointerId);
  renderFrame(beginSweep(frame, gate));
});
field.addEventListener('pointermove', (event) => {
  if (!activePointer) return;
  const gate = gateAt(localPoint(event));
  if (gate !== null) renderFrame(visitGate(frame, gate));
});
field.addEventListener('pointerup', (event) => {
  if (!activePointer) return;
  activePointer = false;
  field.releasePointerCapture?.(event.pointerId);
  if (frame.pending.length === 2) renderFrame(commitSweep(frame));
  else renderFrame({ ...frame, interaction: 'sweep-refused-incomplete', event: { type: 'sweep-refused' } });
});
field.addEventListener('pointercancel', () => { activePointer = false; renderFrame(releaseRegister()); });

document.querySelector('#cross-control').addEventListener('click', deterministicCross);
document.querySelector('#lift-control').addEventListener('click', () => renderFrame(liftLatestSweep(frame)));
document.querySelector('#release-control').addEventListener('click', () => renderFrame(releaseRegister()));

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (!frame.pending.length) renderFrame(beginSweep(frame, keyboardCursor));
    else renderFrame(visitGate(frame, (frame.pending[0] + 3) % GATE_COUNT));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending.length === 2) renderFrame(commitSweep(frame));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    renderFrame(liftLatestSweep(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    renderFrame(releaseRegister());
  }
});

if (document.documentElement.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window._mutineReady = true;
field.dataset.ready = 'true';
