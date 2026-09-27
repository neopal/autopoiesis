import {
  MEMORY_LIMIT,
  PLATE_COUNT,
  PRIMITIVE_BUDGET,
  STAGES,
  applyCountermark,
  buildTimeline,
  geometrySignature,
  releaseCountermark,
  removeLatestCountermark
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const countermarkControl = document.querySelector('#countermark-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2700;
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
  ground: '#17130f',
  groundDeep: '#0b0908',
  umber: '#493326',
  paper: '#eee5ce',
  cyan: '#5fd0b5',
  orange: '#f39a61',
  violet: '#b598ff',
  red: '#f36e67',
  smoke: '#a7937a'
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

function polygon(center, radiusX, radiusY, sides, rotation = 0, scale = 1) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radiusX * scale,
      y: center.y + Math.sin(angle) * radiusY * scale
    };
  });
}

function closedPath(points) {
  return `M ${points.map(pointAt).join(' ')} Z`;
}

function compoundPlatePath(plate) {
  const outer = polygon(plate.center, plate.radiusX, plate.radiusY, plate.sides, plate.rotation);
  const inner = polygon(plate.center, plate.radiusX, plate.radiusY, plate.sides, plate.rotation + 0.16, plate.innerScale);
  return `${closedPath(outer)} ${closedPath(inner)}`;
}

function notchPath(plate) {
  const angle = plate.rotation + Math.PI * 0.25;
  const outward = {
    x: plate.center.x + Math.cos(angle) * plate.radiusX * 1.08,
    y: plate.center.y + Math.sin(angle) * plate.radiusY * 1.08
  };
  const left = {
    x: plate.center.x + Math.cos(angle + 0.28) * plate.radiusX * 0.24,
    y: plate.center.y + Math.sin(angle + 0.28) * plate.radiusY * 0.24
  };
  const right = {
    x: plate.center.x + Math.cos(angle - 0.28) * plate.radiusX * 0.24,
    y: plate.center.y + Math.sin(angle - 0.28) * plate.radiusY * 0.24
  };
  return closedPath([left, outward, right]);
}

function markPath(plate) {
  const mark = polygon(plate.center, plate.radiusX * 0.58, plate.radiusY * 0.58, 3, plate.rotation + 0.55);
  return closedPath(mark);
}

function selectedMark(plate, active = false) {
  if (blind || !plate) return '';
  const radius = active ? 0.108 : 0.098;
  return `<circle class="selection-ring ${active ? 'selection-ring--active' : ''}" cx="${px(plate.center.x)}" cy="${py(plate.center.y)}" r="${px(radius)}"/>`;
}

function render(frame, state = 'sequence', selected = selectedIndex) {
  const selectedPlate = selected === null ? null : frame.plates[selected];
  const stateLabel = state === 'countermarked'
    ? 'COUNTERMARK / REMOTE CUT'
    : state === 'lifted'
      ? 'LATEST COUNTERMARK LIFTED / PLATES RESTORED'
      : state === 'armed'
        ? 'ONE PLATE ARMED / COMMIT ATTENTION'
        : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  const plates = frame.plates.map((plate, index) => {
    const fillRule = plate.innerCut ? 'evenodd' : 'nonzero';
    const notch = plate.notch ? `<path class="plate-notch" data-notch="true" d="${notchPath(plate)}"/>` : '';
    const imprint = plate.innerCut ? `<circle class="remote-hole-rim" cx="${px(plate.center.x)}" cy="${py(plate.center.y)}" r="${px(plate.radiusX * plate.innerScale * 0.84)}"/>` : '';
    return `<g class="plate-group plate-group--${plate.role}" data-plate="${index}" data-role="${plate.role}" data-notch="${plate.notch}" data-inner-cut="${plate.innerCut}">
      <path class="plate plate--${plate.role}" fill-rule="${fillRule}" d="${compoundPlatePath(plate)}"/>
      ${notch}
      ${imprint}
      <path class="plate-mark" d="${markPath(plate)}"/>
    </g>`;
  }).join('');

  const centerLabel = blind ? '' : `<text class="center-label" x="500" y="386" text-anchor="middle">${frame.memory.length ? `${frame.notchCount} NOTCH / ${frame.imprintCount} REMOTE CUT` : 'NEGATIVE ALPHABET'}</text>`;
  const footer = blind ? '' : `<g class="svg-labels"><text x="42" y="708">${stateLabel}</text><text x="958" y="708" text-anchor="end">${PRIMITIVE_BUDGET} PARTS / ${frame.notchCount} NOTCHES / ${frame.imprintCount} CUTS</text></g>`;

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="50%" cy="42%" r="82%"><stop offset="0" stop-color="${palette.umber}"/><stop offset=".56" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="plate-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".48" stop-color="${palette.violet}"/><stop offset="1" stop-color="${palette.smoke}"/></linearGradient>
    <linearGradient id="source-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${palette.orange}"/><stop offset=".56" stop-color="${palette.red}"/><stop offset="1" stop-color="${palette.paper}"/></linearGradient>
    <linearGradient id="remote-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.cyan}"/><stop offset=".5" stop-color="${palette.paper}"/><stop offset="1" stop-color="${palette.violet}"/></linearGradient>
    <pattern id="micro-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 0 19 L 38 19 M 19 0 L 19 38" fill="none" stroke="${palette.paper}" stroke-opacity=".045" stroke-width="1"/><circle cx="19" cy="19" r="1" fill="${palette.orange}" fill-opacity=".14"/></pattern>
  </defs>
  <rect class="art-ground" x="0" y="0" width="1000" height="760"/>
  <rect class="art-grid" x="24" y="22" width="952" height="668"/>
  <g class="plate-layer">${plates}</g>
  ${selectedMark(selectedPlate, state === 'armed')}
  ${centerLabel}
  ${footer}`;

  stageReadout.textContent = state === 'countermarked'
    ? 'countermark committed / remote cut'
    : state === 'lifted'
      ? 'latest countermark lifted / restored'
      : state === 'armed'
        ? 'one plate armed / commit attention'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} countermarks · ${frame.notchCount} notches · ${frame.imprintCount} imprints`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.notches = String(frame.notchCount);
  field.dataset.imprints = String(frame.imprintCount);
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
    render(interactionFrame, interactionFrame.interaction ?? 'countermarked', selectedIndex);
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

function nearestPlate(point, frame) {
  return frame.plates.reduce((best, plate, index) => {
    const bestDistance = Math.hypot(point.x - frame.plates[best].center.x, point.y - frame.plates[best].center.y);
    const distance = Math.hypot(point.x - plate.center.x, point.y - plate.center.y);
    return distance < bestDistance ? index : best;
  }, 0);
}

function interactionBase() {
  return interactionFrame ?? timeline[currentStage];
}

function armPlate(index) {
  selectedIndex = index;
  const base = interactionBase();
  render(base, 'armed', selectedIndex);
  updateButtons();
}

function commitCountermark(point) {
  const base = interactionBase();
  interactionFrame = applyCountermark(base, point);
  interactionFrame.interaction = 'countermarked';
  selectedIndex = null;
  notice = 'remote-winding-committed';
  render(interactionFrame, 'countermarked', null);
  updateButtons();
}

function keyboardCountermark() {
  const base = interactionBase();
  const index = (base.memory.length * 2 + 1) % PLATE_COUNT;
  commitCountermark(base.plates[index].center);
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...removeLatestCountermark(base), interaction: 'lifted' };
  selectedIndex = null;
  notice = 'latest-countermark-lifted';
  render(interactionFrame, 'lifted', null);
  updateButtons();
}

function releasePlates() {
  interactionFrame = null;
  selectedIndex = null;
  hoverIndex = null;
  notice = 'plates-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(releaseCountermark(), 'sequence', null) : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  countermarkControl.disabled = staticMode;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v018-negative-alphabet.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  const point = pointerPoint(event);
  const frame = interactionBase();
  hoverIndex = nearestPlate(point, frame);
  if (selectedIndex === null) {
    field.dataset.hover = String(hoverIndex);
    armPlate(hoverIndex);
  }
});

field.addEventListener('pointerleave', () => {
  hoverIndex = null;
  field.dataset.hover = '';
  if (!interactionFrame && !frozen) renderCurrent();
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
    notice = 'drag-refused-use-a-single-commit';
    render(interactionBase(), selectedIndex === null ? 'sequence' : 'armed', selectedIndex);
    return;
  }
  commitCountermark(point);
});

field.addEventListener('pointercancel', () => {
  pointerDownPoint = null;
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    keyboardCountermark();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releasePlates();
  }
});

countermarkControl.addEventListener('click', keyboardCountermark);
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releasePlates);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
