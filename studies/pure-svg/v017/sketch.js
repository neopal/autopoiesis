import {
  ANCHOR_COUNT,
  MEMORY_LIMIT,
  PRIMITIVE_BUDGET,
  STAGES,
  applyRelay,
  buildTimeline,
  geometrySignature,
  removeLatestRelay,
  releaseRelay
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const relayControl = document.querySelector('#relay-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2600;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#101526',
  groundDeep: '#050711',
  blue: '#31436f',
  ink: '#080b16',
  paper: '#f2efd9',
  cyan: '#75e1d0',
  orange: '#ff9a68',
  violet: '#a79bff',
  red: '#ff7182',
  smoke: '#7280a7'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let selectedIndex = null;
let pointerDownPoint = null;
let hoverIndex = null;
let notice = '';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (value) => `${px(value.x)} ${py(value.y)}`;

function polygon(center, radiusX, radiusY, sides, rotation = 0) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY
    };
  });
}

function closedPath(points) {
  return `M ${points.map(pointAt).join(' ')} Z`;
}

function sealPath(anchor, index) {
  const rotation = anchor.angle + Math.PI / 8;
  const outer = polygon(anchor.center, 0.066 + (index % 2) * 0.008, 0.045 + (index % 3) * 0.007, 6, rotation);
  const inner = polygon(anchor.center, anchor.aperture, anchor.aperture * 0.64, 6, rotation + 0.18);
  return `${closedPath(outer)} ${closedPath(inner)}`;
}

function linkPath(link) {
  return `M ${pointAt(link.fromPoint)} Q ${pointAt(link.bendPoint)} ${pointAt(link.toPoint)}`;
}

function centralVoid(stage) {
  const points = polygon({ x: 0.5, y: 0.5 }, 0.17 + stage * 0.001, 0.125 + stage * 0.0014, 9, -0.18);
  return closedPath(points);
}

function selectedMark(anchor, active = false) {
  if (blind || !anchor) return '';
  const radius = active ? 0.092 : 0.078;
  return `<circle class="selection-ring ${active ? 'selection-ring--active' : ''}" cx="${px(anchor.center.x)}" cy="${py(anchor.center.y)}" r="${px(radius)}"/>`;
}

function render(frame, state = 'sequence', selected = selectedIndex) {
  const selectedAnchor = selected === null ? null : frame.anchors[selected];
  const stateLabel = state === 'relayed'
    ? 'TWO POINTS / WRONG RETURN'
    : state === 'lifted'
      ? 'LATEST RETURN LIFTED / LOOP RESTORED'
      : state === 'armed'
        ? 'FIRST POINT HELD / CHOOSE ANOTHER'
        : state === 'refused'
          ? 'SAME POINT REFUSED / LOOP UNCHANGED'
          : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const visibleBaseLinks = frame.links.filter((link) => link.visible && link.role === 'base').map((link) => (
    `<path class="loop-link loop-link--base" data-link="${link.id}" d="${linkPath(link)}"/>`
  )).join('');
  const bridges = frame.links.filter((link) => link.visible && link.role === 'wrong-return').map((link) => (
    `<path class="loop-link loop-link--wrong" data-link="${link.id}" d="${linkPath(link)}"/>`
  )).join('');
  const cuts = frame.links.filter((link) => !link.visible && link.role === 'cut').map((link) => {
    const anchor = frame.anchors[link.from];
    return `<path class="cut-mark" d="M ${pointAt(anchor.center)} l 13 -10 M ${pointAt(anchor.center)} l 13 10"/>`;
  }).join('');
  const anchors = frame.anchors.map((anchor, index) => (
    `<path class="seal seal--${anchor.role}" data-anchor="${index}" data-role="${anchor.role}" fill-rule="evenodd" d="${sealPath(anchor, index)}"/>`
  )).join('');
  const bridgeDots = frame.links.filter((link) => link.visible && link.role === 'wrong-return').map((link) => (
    `<circle class="bridge-node" cx="${px(link.toPoint.x)}" cy="${py(link.toPoint.y)}" r="${px(0.019)}"/>`
  )).join('');
  const center = blind ? '' : `<text class="center-label" x="500" y="385" text-anchor="middle">${frame.cutCount ? `${frame.cutCount} CUT / ${frame.bridgeCount} RETURN` : 'SEALED LOOP'}</text>`;
  const footer = blind ? '' : `<g class="svg-labels"><text x="42" y="708">${stateLabel}</text><text x="958" y="708" text-anchor="end">${PRIMITIVE_BUDGET} PARTS / ${frame.cutCount} CUTS / ${frame.bridgeCount} WRONG RETURNS</text></g>`;

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="50%" cy="44%" r="80%"><stop offset="0" stop-color="${palette.blue}"/><stop offset=".55" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="seal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".45" stop-color="${palette.violet}"/><stop offset="1" stop-color="${palette.smoke}"/></linearGradient>
    <linearGradient id="wrong-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${palette.orange}"/><stop offset=".52" stop-color="${palette.red}"/><stop offset="1" stop-color="${palette.cyan}"/></linearGradient>
    <filter id="soft-shadow" x="-30%" y="-40%" width="170%" height="190%"><feGaussianBlur stdDeviation="16"/></filter>
    <pattern id="ticks" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 0 21 L 42 21 M 21 0 L 21 42" fill="none" stroke="${palette.violet}" stroke-opacity=".08" stroke-width="1"/><circle cx="21" cy="21" r="1" fill="${palette.cyan}" fill-opacity=".18"/></pattern>
  </defs>
  <rect class="art-ground" x="0" y="0" width="1000" height="760"/>
  <rect x="24" y="22" width="952" height="668" fill="url(#ticks)" opacity=".72"/>
  <path class="core-shadow" d="${centralVoid(frame.stage)}" transform="translate(0 16)"/>
  <path class="core-void" d="${centralVoid(frame.stage)}"/>
  <path class="core-rim" d="${centralVoid(frame.stage)}"/>
  <g class="link-shadow">${visibleBaseLinks}${bridges}</g>
  <g class="loop-links">${visibleBaseLinks}${bridges}</g>
  <g class="cut-layer">${cuts}</g>
  <g class="seal-layer">${anchors}</g>
  <g class="bridge-layer">${bridgeDots}</g>
  ${selectedMark(selectedAnchor, state === 'armed')}
  ${center}
  ${footer}`;

  stageReadout.textContent = state === 'relayed'
    ? 'two points relayed / wrong return'
    : state === 'lifted'
      ? 'latest return lifted / loop restored'
      : state === 'armed'
        ? 'first point held / choose another'
        : state === 'refused'
          ? 'same point refused / unchanged'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} relays · ${frame.cutCount} cuts · ${frame.bridgeCount} returns`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.cuts = String(frame.cutCount);
  field.dataset.bridges = String(frame.bridgeCount);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.selected = selected === null ? '' : String(selected);
  field.dataset.notice = notice;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'relayed', selectedIndex);
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 'sequence', null);
    return;
  }
  const frame = frameAt(now);
  if (frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = frame.stage;
    lastPaint = now;
    render(frame, 'sequence', null);
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
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, 0.08, 0.92),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, 0.08, 0.92)
  };
}

function nearestAnchor(point, frame) {
  return frame.anchors.reduce((best, anchor, index) => {
    const bestAnchor = frame.anchors[best];
    const bestDistance = Math.hypot(point.x - bestAnchor.center.x, point.y - bestAnchor.center.y);
    const distance = Math.hypot(point.x - anchor.center.x, point.y - anchor.center.y);
    return distance < bestDistance ? index : best;
  }, 0);
}

function interactionBase() {
  return interactionFrame ?? timeline[currentStage];
}

function choosePoint(index) {
  const base = interactionBase();
  interactionFrame = { ...base, interaction: 'armed' };
  selectedIndex = index;
  notice = 'first-point-selected';
  render(interactionFrame, 'armed', selectedIndex);
  updateButtons();
}

function relayPoints(sourceIndex, targetIndex) {
  const base = interactionBase();
  if (sourceIndex === targetIndex) {
    interactionFrame = { ...base, interaction: 'refused' };
    notice = 'same-point-refused';
    render(interactionFrame, 'refused', sourceIndex);
    return;
  }
  interactionFrame = applyRelay(base, { source: sourceIndex, target: targetIndex });
  interactionFrame.interaction = 'relayed';
  selectedIndex = null;
  notice = 'relay-committed';
  render(interactionFrame, 'relayed', null);
  updateButtons();
}

function chooseOrRelay(index) {
  if (selectedIndex === null) choosePoint(index);
  else relayPoints(selectedIndex, index);
}

function keyboardRelay() {
  const base = interactionBase();
  const source = base.memory.length % ANCHOR_COUNT;
  const target = (source + 4) % ANCHOR_COUNT;
  relayPoints(source, target);
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...removeLatestRelay(base), interaction: 'lifted' };
  selectedIndex = null;
  notice = 'latest-relay-lifted';
  render(interactionFrame, 'lifted', null);
  updateButtons();
}

function releaseLoop() {
  interactionFrame = null;
  selectedIndex = null;
  hoverIndex = null;
  notice = 'loop-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(timeline[0], 'sequence', null) : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  relayControl.disabled = staticMode;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v017-misremembered-loop.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  const point = pointerPoint(event);
  const frame = interactionBase();
  hoverIndex = nearestAnchor(point, frame);
  if (selectedIndex === null) field.dataset.hover = String(hoverIndex);
});

field.addEventListener('pointerleave', () => {
  hoverIndex = null;
  field.dataset.hover = '';
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  pointerDownPoint = pointerPoint(event);
  field.setPointerCapture?.(event.pointerId);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerDownPoint || staticMode || blind) return;
  const point = pointerPoint(event);
  const travel = Math.hypot(point.x - pointerDownPoint.x, point.y - pointerDownPoint.y);
  field.releasePointerCapture?.(event.pointerId);
  pointerDownPoint = null;
  if (travel > 0.045) {
    notice = 'drag-refused-use-two-points';
    render(interactionBase(), selectedIndex === null ? 'sequence' : 'armed', selectedIndex);
    return;
  }
  chooseOrRelay(nearestAnchor(point, interactionBase()));
});

field.addEventListener('pointercancel', () => {
  pointerDownPoint = null;
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    keyboardRelay();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseLoop();
  }
});

relayControl.addEventListener('click', keyboardRelay);
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseLoop);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
