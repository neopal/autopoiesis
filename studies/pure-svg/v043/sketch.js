import {
  beginPass,
  buildFrame,
  buildTimeline,
  commitPass,
  geometrySignature,
  liftLatestPass,
  releaseLoom,
  sampleZone
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let activePointer = false;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function polygonPath(points) {
  if (!points.length) return '';
  return `M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')} Z`;
}

function centerlinePath(strand) {
  const half = strand.points.length / 2;
  const points = strand.points.slice(0, half).map((point, index) => {
    const opposite = strand.points[strand.points.length - 1 - index];
    return { x: (point.x + opposite.x) / 2, y: (point.y + opposite.y) / 2 };
  });
  return `M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')}`;
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'loom-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#17151a' }),
    svgElement('stop', { offset: '48%', 'stop-color': '#0d0d11' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#201619' })
  );
  const glow = svgElement('radialGradient', { id: 'loom-glow', cx: '.5', cy: '.48', r: '.72' });
  glow.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#f4ead5', 'stop-opacity': '.10' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#050507', 'stop-opacity': '.40' })
  );
  const shadow = svgElement('filter', { id: 'loom-shadow', x: '-20%', y: '-20%', width: '140%', height: '160%' });
  shadow.append(svgElement('feGaussianBlur', { stdDeviation: '9' }));
  const colors = [
    ['strand-gold', '#f2c96d', '#955d3f'],
    ['strand-coral', '#e99079', '#743d4c'],
    ['strand-blue', '#8fc7c2', '#2d6670'],
    ['strand-plum', '#b4a1ca', '#57466e']
  ];
  for (const [id, start, end] of colors) {
    const gradient = svgElement('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' });
    gradient.append(
      svgElement('stop', { offset: '0%', 'stop-color': start }),
      svgElement('stop', { offset: '100%', 'stop-color': end })
    );
    defs.append(gradient);
  }
  defs.append(ground, glow, shadow);
  return defs;
}

function toneFor(index) {
  return ['gold', 'coral', 'blue', 'plum'][index % 4];
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  fragment.append(svgElement('rect', { class: 'field-ground', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('rect', { class: 'field-glow', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('path', { class: 'loom-edge', d: 'M 122 156 Q 496 254 878 138' }));
  fragment.append(svgElement('path', { class: 'loom-edge', d: 'M 108 610 Q 500 522 894 638' }));
  fragment.append(svgElement('path', { class: 'loom-edge', d: 'M 470 118 Q 504 360 532 646' }));

  for (const strand of frame.strands) {
    const d = polygonPath(strand.points);
    fragment.append(svgElement('path', { class: 'strand-shadow', d, 'data-strand-shadow': String(strand.index) }));
    fragment.append(svgElement('path', { class: 'strand', d, 'data-strand': String(strand.index), 'data-tone': toneFor(strand.index) }));
    fragment.append(svgElement('path', { class: 'strand-edge', d, 'data-strand-edge': String(strand.index) }));
    fragment.append(svgElement('path', { class: 'strand-core', d: centerlinePath(strand), 'data-strand-core': String(strand.index) }));
    const notch = strand.center;
    fragment.append(svgElement('path', { class: 'material-notch', d: `M ${notch.x - 21} ${notch.y + 4} Q ${notch.x} ${notch.y - 12} ${notch.x + 21} ${notch.y + 4}` }));
  }

  const zones = svgElement('g', { class: 'pressure-zones', 'aria-hidden': 'true' });
  for (const zone of frame.zones) {
    const selected = frame.pending.includes(zone.index);
    zones.append(svgElement('circle', { class: `pressure-zone${selected ? ' is-pending' : ''}`, cx: zone.x, cy: zone.y, r: zone.radius, 'data-zone': String(zone.index) }));
    zones.append(svgElement('path', { class: 'pressure-zone', d: `M ${zone.x} ${zone.y - zone.radius / 2} L ${zone.x} ${zone.y + zone.radius / 2}` }));
  }
  fragment.append(zones);
  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.strandCount = String(frame.strands.length);
  field.dataset.zoneCount = String(frame.zones.length);
  field.dataset.selected = frame.pending.join(',');
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} pass${frame.memory.length === 1 ? '' : 'es'} · ${frame.memory.length ? 'pressure spent through the weave' : 'no pressure spent'}`;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1000,
    y: ((event.clientY - rect.top) / rect.height) * 760
  };
}

function zoneAt(point) {
  let nearest = null;
  let distance = Infinity;
  for (const zone of frame.zones) {
    const nextDistance = Math.hypot(point.x - zone.x, point.y - zone.y);
    if (nextDistance <= zone.radius * 1.45 && nextDistance < distance) {
      nearest = zone.index;
      distance = nextDistance;
    }
  }
  return nearest;
}

function deterministicPass() {
  let next = beginPass(frame, 0);
  next = sampleZone(next, 1);
  next = sampleZone(next, 2);
  renderFrame(commitPass(next));
}

field.addEventListener('pointerdown', (event) => {
  const zone = zoneAt(localPoint(event));
  if (zone === null) return;
  activePointer = true;
  try { field.setPointerCapture?.(event.pointerId); } catch {}
  renderFrame(beginPass(frame, zone));
});

field.addEventListener('pointermove', (event) => {
  if (!activePointer) return;
  const zone = zoneAt(localPoint(event));
  if (zone !== null) renderFrame(sampleZone(frame, zone));
});

field.addEventListener('pointerup', (event) => {
  if (!activePointer) return;
  activePointer = false;
  try { field.releasePointerCapture?.(event.pointerId); } catch {}
  renderFrame(commitPass(frame));
});

field.addEventListener('pointercancel', () => {
  activePointer = false;
  renderFrame(releaseLoom());
});

document.querySelector('#pass-control').addEventListener('click', deterministicPass);
document.querySelector('#lift-control').addEventListener('click', () => renderFrame(liftLatestPass(frame)));
document.querySelector('#release-control').addEventListener('click', () => renderFrame(releaseLoom()));

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (!frame.pending.length) renderFrame(beginPass(frame, 0));
    else renderFrame(sampleZone(frame, frame.pending.length));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    renderFrame(commitPass(frame));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    renderFrame(liftLatestPass(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    renderFrame(releaseLoom());
  }
});

if (document.documentElement.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window._mutineReady = true;
field.dataset.ready = 'true';
