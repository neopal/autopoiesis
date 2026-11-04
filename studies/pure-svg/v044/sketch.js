import {
  beginCut,
  buildFrame,
  buildTimeline,
  commitCut,
  escapeSurface,
  geometrySignature,
  liftLatestCut,
  reenterSurface,
  releaseSkin
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
const RIM_LAYOUT = [
  { index: 0, x: 146, y: 258 },
  { index: 1, x: 432, y: 118 },
  { index: 2, x: 858, y: 310 },
  { index: 3, x: 612, y: 644 }
];
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let activePointer = false;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function polygonPath(points) {
  return `M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')} Z`;
}

function compoundPath(nextFrame) {
  const parts = [polygonPath(nextFrame.shell)];
  for (const aperture of nextFrame.apertures) {
    parts.push(aperture.path);
    if (aperture.secondaryPath) parts.push(aperture.secondaryPath);
  }
  return parts.join(' ');
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'skin-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#121b21' }),
    svgElement('stop', { offset: '52%', 'stop-color': '#080a0d' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#211719' })
  );
  const halo = svgElement('radialGradient', { id: 'skin-halo', cx: '.48', cy: '.44', r: '.7' });
  halo.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#dfe8c0', 'stop-opacity': '.10' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#050609', 'stop-opacity': '.42' })
  );
  const fill = svgElement('linearGradient', { id: 'skin-fill', x1: '0', y1: '0', x2: '1', y2: '1' });
  fill.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#dce5cb' }),
    svgElement('stop', { offset: '36%', 'stop-color': '#a3b8aa' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#76565a' })
  );
  const shadow = svgElement('filter', { id: 'skin-shadow', x: '-20%', y: '-20%', width: '140%', height: '160%' });
  shadow.append(svgElement('feGaussianBlur', { stdDeviation: '10' }));
  defs.append(ground, halo, fill, shadow);
  return defs;
}

function rimPoint(index) {
  return RIM_LAYOUT.find((rim) => rim.index === index);
}

function rimPath(index) {
  const rim = rimPoint(index);
  const angles = [0.34, 1.16, 2.72, 4.02];
  const angle = angles[index];
  const x1 = rim.x - Math.cos(angle) * 30;
  const y1 = rim.y - Math.sin(angle) * 30;
  const x2 = rim.x + Math.cos(angle) * 30;
  const y2 = rim.y + Math.sin(angle) * 30;
  return `M ${x1} ${y1} Q ${rim.x} ${rim.y - 12} ${x2} ${y2}`;
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  const surface = compoundPath(frame);
  fragment.append(makeDefs());
  fragment.append(svgElement('rect', { class: 'skin-ground', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('rect', { class: 'skin-halo', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('path', { class: 'skin-shadow', d: surface, 'fill-rule': 'evenodd' }));
  fragment.append(svgElement('path', { class: 'skin', d: surface, 'fill-rule': 'evenodd', 'data-skin': 'true' }));
  fragment.append(svgElement('path', { class: 'skin-rim', d: polygonPath(frame.shell) }));
  fragment.append(svgElement('path', { class: 'skin-suture', d: 'M 170 190 Q 420 86 754 188' }));
  fragment.append(svgElement('path', { class: 'skin-suture', d: 'M 174 520 Q 478 674 802 530' }));
  fragment.append(svgElement('path', { class: 'skin-suture', d: 'M 252 198 Q 494 360 730 552' }));

  for (const aperture of frame.apertures) {
    const selected = frame.pending[0] === aperture.index;
    fragment.append(svgElement('path', {
      class: `aperture${selected ? ' is-pending' : ''}`,
      d: aperture.path,
      'data-aperture': String(aperture.index),
      'data-topology': aperture.topology
    }));
    fragment.append(svgElement('path', { class: 'aperture-glint', d: aperture.path, 'data-aperture-glint': String(aperture.index) }));
    if (aperture.secondaryPath) {
      fragment.append(svgElement('path', { class: 'aperture aperture-secondary', d: aperture.secondaryPath, 'data-secondary-aperture': String(aperture.index), 'data-topology': 'split' }));
      fragment.append(svgElement('path', { class: 'split-bridge', d: `M ${aperture.x - 30} ${aperture.y + 4} Q ${aperture.x} ${aperture.y + 19} ${aperture.x + 31} ${aperture.y - 2}` }));
    }
  }

  const rims = svgElement('g', { class: 'rim-field', 'aria-hidden': 'true' });
  for (const rim of RIM_LAYOUT) {
    const ready = frame.pending.length === 2 && frame.pending[1] === rim.index;
    rims.append(svgElement('path', { class: `rim-marker${ready ? ' is-ready' : ''}`, d: rimPath(rim.index), 'data-rim': String(rim.index) }));
  }
  fragment.append(rims);
  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.apertureCount = String(frame.apertures.length);
  field.dataset.splitCount = String(frame.apertures.filter((aperture) => aperture.topology === 'split').length);
  field.dataset.selected = frame.pending.join(',');
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} cut${frame.memory.length === 1 ? '' : 's'} · ${frame.memory.length ? 'topology spent elsewhere' : 'no topology spent'}`;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1000,
    y: ((event.clientY - rect.top) / rect.height) * 760
  };
}

function apertureAt(point) {
  let nearest = null;
  let score = Infinity;
  for (const aperture of frame.apertures) {
    const dx = (point.x - aperture.x) / aperture.rx;
    const dy = (point.y - aperture.y) / aperture.ry;
    const nextScore = dx * dx + dy * dy;
    if (nextScore <= 1.45 && nextScore < score) {
      nearest = aperture.index;
      score = nextScore;
    }
  }
  return nearest;
}

function rimAt(point) {
  let nearest = null;
  let distance = Infinity;
  for (const rim of RIM_LAYOUT) {
    const nextDistance = Math.hypot(point.x - rim.x, point.y - rim.y);
    if (nextDistance <= 54 && nextDistance < distance) {
      nearest = rim.index;
      distance = nextDistance;
    }
  }
  return nearest;
}

function deterministicCut() {
  let next = beginCut(frame, 0);
  next = escapeSurface(next, 0);
  renderFrame(commitCut(next));
}

field.addEventListener('pointerdown', (event) => {
  const aperture = apertureAt(localPoint(event));
  if (aperture === null) return;
  activePointer = true;
  try { field.setPointerCapture?.(event.pointerId); } catch {}
  renderFrame(beginCut(frame, aperture));
});

field.addEventListener('pointermove', (event) => {
  if (!activePointer) return;
  const point = localPoint(event);
  if (frame.pending.length === 1) {
    const rim = rimAt(point);
    if (rim !== null) renderFrame(escapeSurface(frame, rim));
  } else if (frame.pending.length === 2 && apertureAt(point) === frame.pending[0]) {
    renderFrame(reenterSurface(frame, frame.pending[0]));
  }
});

field.addEventListener('pointerup', (event) => {
  if (!activePointer) return;
  activePointer = false;
  try { field.releasePointerCapture?.(event.pointerId); } catch {}
  if (frame.interaction === 'cut-refused-reentry') return;
  renderFrame(commitCut(frame));
});

field.addEventListener('pointercancel', () => {
  activePointer = false;
  renderFrame(releaseSkin());
});

document.querySelector('#tear-control').addEventListener('click', deterministicCut);
document.querySelector('#lift-control').addEventListener('click', () => renderFrame(liftLatestCut(frame)));
document.querySelector('#release-control').addEventListener('click', () => renderFrame(releaseSkin()));

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (!frame.pending.length) renderFrame(beginCut(frame, 0));
    else if (frame.pending.length === 1) renderFrame(escapeSurface(frame, 0));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    renderFrame(commitCut(frame));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    renderFrame(liftLatestCut(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    renderFrame(releaseSkin());
  }
});

if (document.documentElement.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window.__mutineSvgV044 = {
  getFrame: () => frame,
  commitDeterministicCut: deterministicCut,
  geometrySignature: () => geometrySignature(frame)
};
window._mutineReady = true;
field.dataset.ready = 'true';
