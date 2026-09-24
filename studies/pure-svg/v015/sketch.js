import {
  PRIMITIVE_BUDGET,
  STAGES,
  applyAttention,
  buildTimeline,
  deleteAttention
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attentionControl = document.querySelector('#attention-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const frozen = reducedMotion || staticMode;
const blind = params.get('blind') === '1';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#17122a',
  groundDeep: '#0a0712',
  groundSoft: '#2a1e42',
  paper: '#eee6d2',
  acid: '#b9e769',
  rose: '#e88c91',
  lilac: '#bbb0ee',
  gold: '#e8c56f',
  ink: '#0a0712',
  smoke: '#927fa9'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let hoveredTerritory = -1;
let lastPointerPoint = null;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;

function transformPoint(point, territory) {
  const cos = Math.cos(territory.rotation);
  const sin = Math.sin(territory.rotation);
  return {
    x: territory.center.x + (point.x * cos - point.y * sin) * territory.scale,
    y: territory.center.y + (point.x * sin + point.y * cos) * territory.scale
  };
}

function contourPath(territory) {
  const points = territory.contour.map((point) => transformPoint(point, territory));
  return `M ${pointAt(points[0])} ${points.slice(1).map((point) => `L ${pointAt(point)}`).join(' ')} Z`;
}

function ellipsePath(territory) {
  const hole = territory.hole;
  const center = { x: hole.center.x, y: hole.center.y };
  const rx = hole.radiusX;
  const ry = hole.radiusY;
  const rotation = hole.rotation;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points = Array.from({ length: 18 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 18;
    return {
      x: center.x + (Math.cos(angle) * rx * cos - Math.sin(angle) * ry * sin),
      y: center.y + (Math.cos(angle) * rx * sin + Math.sin(angle) * ry * cos)
    };
  });
  return `M ${pointAt(points[0])} ${points.slice(1).map((point) => `L ${pointAt(point)}`).join(' ')} Z`;
}

function territoryPath(territory) {
  return territory.holeOpen ? `${contourPath(territory)} ${ellipsePath(territory)}` : contourPath(territory);
}

function renderTerritory(territory) {
  if (!territory.visible) return '';
  return `<path class="territory territory--${territory.role}" data-territory="${territory.id}" data-role="${territory.role}" data-hole-open="${territory.holeOpen}" d="${territoryPath(territory)}" fill-rule="evenodd"/>`;
}

function renderVoidMark(territory, index, active = false) {
  if (blind || !territory.holeOpen) return '';
  const radius = active ? 16 : 8 + index * 2;
  return `<circle class="void-mark${active ? ' void-mark--active' : ''}" cx="${px(territory.hole.center.x)}" cy="${py(territory.hole.center.y)}" r="${radius}"/>`;
}

function renderAttention(attention, index, active = false) {
  if (blind || !attention) return '';
  const radius = active ? 44 : 10 + index * 5;
  const opacity = active ? 0.8 : 0.12 + index * 0.08;
  return `<circle class="attention-mark${active ? ' attention-mark--active' : ''}" cx="${px(attention.point.x)}" cy="${py(attention.point.y)}" r="${radius}" opacity="${opacity}"/>`;
}

function render(frame, progress = 1, state = 'sequence') {
  const modeLabel = state === 'visitor-attention'
    ? 'VISITOR ATTENTION / VOID TRANSFER'
    : state === 'unconstrained'
      ? 'LATEST ATTENTION LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const active = frame.memory.at(-1);
  const opacity = Math.max(.22, progress);
  const territories = frame.territories.map(renderTerritory).join('');
  const voidMarks = frame.territories.map((territory, index) => renderVoidMark(territory, index, territory.role === 'receiving')).join('');
  const attentionMarks = frame.memory.map((attention, index) => renderAttention(attention, index)).join('');
  const activeAttention = renderAttention(active, frame.memory.length, true);

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="50%" cy="40%" r="82%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".58" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="territory-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".55" stop-color="${palette.lilac}"/><stop offset="1" stop-color="${palette.smoke}"/></linearGradient>
    <linearGradient id="receiving-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${palette.gold}"/><stop offset=".62" stop-color="${palette.acid}"/><stop offset="1" stop-color="${palette.paper}"/></linearGradient>
    <filter id="territory-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="15"/></filter>
    <pattern id="grain-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="${palette.lilac}" stroke-opacity=".11" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="grain-grid" x="28" y="32" width="944" height="654"/>
  <path class="field-orbit" d="M 160 182 C 290 72 700 66 842 210 C 920 290 870 558 676 642 C 454 738 190 610 122 416 C 88 320 102 230 160 182 Z"/>
  <path class="field-orbit field-orbit--inner" d="M 224 218 C 360 124 624 116 772 244 C 832 296 798 500 634 582 C 446 676 242 568 190 408 C 162 324 174 254 224 218 Z"/>
  <g class="territory-shadow" opacity="${opacity}">${frame.territories.map((territory) => `<path d="${contourPath(territory)}"/>`).join('')}</g>
  <g class="territory-layer" opacity="${opacity}">${territories}</g>
  ${voidMarks}
  ${attentionMarks}
  ${activeAttention}
  <g class="artwork-label" aria-hidden="true"><text x="48" y="684">${modeLabel}</text><text x="952" y="684" text-anchor="end">${PRIMITIVE_BUDGET} TERRITORIES / ${frame.holes} OPEN VOIDS</text></g>
  <g class="count-label" aria-hidden="true"><text x="500" y="390" text-anchor="middle">${frame.closedVoids ? `${frame.closedVoids} → ${frame.holes}` : '—'}</text></g>`;

  stageReadout.textContent = state === 'visitor-attention'
    ? 'visitor attention / paused'
    : state === 'unconstrained'
      ? 'latest attention lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered attentions · ${frame.holes} open voids`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.holes = String(frame.holes);
  field.dataset.closedVoids = String(frame.closedVoids);
  field.dataset.topology = frame.topology;
  field.dataset.interaction = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return { frame: timeline[currentStage], progress: (elapsed % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = frameAt(now);
  if (current.frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = current.frame.stage;
    lastPaint = now;
    render(current.frame, current.progress, 'sequence');
  }
  requestAnimationFrame(renderCurrent);
}

function pointerPoint(event) {
  const bounds = field.getBoundingClientRect();
  const scale = Math.min(bounds.width / 1000, bounds.height / 760);
  const drawnWidth = 1000 * scale;
  const drawnHeight = 760 * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return {
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, .14, .86),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, .18, .82)
  };
}

function nearestTerritory(frame, point) {
  return frame.territories.reduce((best, territory, index) => {
    const bestDistance = Math.hypot(point.x - frame.territories[best].anchor.x, point.y - frame.territories[best].anchor.y);
    const nextDistance = Math.hypot(point.x - territory.anchor.x, point.y - territory.anchor.y);
    return nextDistance < bestDistance ? index : best;
  }, 0);
}

function makeAttention(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyAttention(base, point);
  render(interactionFrame, 1, 'visitor-attention');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...deleteAttention(base), interaction: 'unconstrained' };
  render(interactionFrame, 1, 'unconstrained');
  updateButtons();
}

function releaseField() {
  interactionFrame = null;
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  hoveredTerritory = -1;
  lastPointerPoint = null;
  frozen ? render(timeline[0], 1, 'sequence') : renderCurrent();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v015-void-host.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  const point = pointerPoint(event);
  const base = interactionFrame ?? timeline[currentStage];
  const nextTerritory = nearestTerritory(base, point);
  field.dataset.proximity = 'near';
  if (nextTerritory !== hoveredTerritory || !lastPointerPoint) {
    hoveredTerritory = nextTerritory;
    lastPointerPoint = point;
    makeAttention(point);
  }
});

field.addEventListener('pointerleave', () => {
  field.dataset.proximity = 'away';
  hoveredTerritory = -1;
  lastPointerPoint = null;
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  makeAttention(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeAttention({ x: .86, y: .18 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseField();
  }
});

attentionControl.addEventListener('click', () => makeAttention({ x: .86, y: .18 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseField);

renderCurrent();
updateButtons();
window._mutineReady = true;
