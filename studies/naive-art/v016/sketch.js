import {
  FORM_LAYOUT,
  STAGES,
  applyDeparture,
  buildTimeline,
  deleteLatestDeparture,
  departureSignature,
  layoutForViewport
} from './engine.mjs';

const svg = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const departControl = document.querySelector('#depart-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3800;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
const palette = {
  paper: '#eee7d7',
  paperLight: '#fffaf0',
  ink: '#173247',
  coral: '#d85d4c',
  lemon: '#e6b949',
  green: '#6f8f80',
  lilac: '#a58ab0',
  sky: '#77aeb0',
  shadow: 'rgba(23,50,71,.18)'
};
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let pendingPoint = null;
let cssWidth = 1000;
let cssHeight = 760;
let viewHeight = 760;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fixed = (value) => Number(value).toFixed(4);

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage]);
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.scene.departureRecords.length,
    engineMemory: frame.memory.length,
    departureChanges: frame.scene.materialTrace.departureChanges,
    presenceChanges: frame.scene.materialTrace.presenceChanges,
    sourceNotches: frame.scene.materialTrace.sourceNotchCount,
    wrongFragments: frame.scene.materialTrace.wrongFragmentCount,
    hollows: frame.scene.materialTrace.hollowCount,
    interaction: interactionFrame?.interaction ?? 'sequence',
    pending: Boolean(pendingPoint),
    departureSignature: departureSignature(frame)
  };
}

window.__mutineNaiveV016 = { getState: stateSnapshot };
svg.dataset.witness = 'departure-inversion';
if (staticPreview) {
  svg.tabIndex = -1;
  svg.removeAttribute('aria-keyshortcuts');
}

function pathForKind(kind) {
  const paths = {
    loop: 'M-0.86-0.08C-0.7-0.74 0.5-0.82 0.76-0.22C0.96 0.3 0.28 0.86-0.4 0.68C-0.93 0.54-1-0.02-0.86-0.08Z',
    kite: 'M0-0.98L0.78-0.08L0.16 0.9L-0.72 0.22Z',
    pool: 'M-0.9-0.12C-0.58-0.76 0.72-0.72 0.9-0.05C0.98 0.5 0.24 0.88-0.56 0.66C-0.94 0.54-1 0.14-0.9-0.12Z',
    bowl: 'M-0.92-0.38C-0.38-0.52 0.36-0.5 0.92-0.34L0.62 0.56C0.2 0.98-0.36 0.92-0.7 0.46Z',
    knot: 'M-0.76-0.26C-0.58-0.8 0.18-0.9 0.52-0.46C0.88-0.02 0.46 0.22 0.78 0.52C0.22 0.94-0.62 0.78-0.7 0.26C-0.76-0.04-0.92-0.02-0.76-0.26Z',
    step: 'M-0.82-0.72H-0.1V-0.2H0.7V0.72H-0.82Z',
    crumb: 'M-0.8-0.38L-0.14-0.86L0.82-0.4L0.48 0.7L-0.66 0.84Z'
  };
  return paths[kind] ?? paths.pool;
}

function markForKind(kind, offset) {
  const shift = fixed(offset);
  const marks = {
    loop: `<path d="M-0.58 0.04C-0.22-0.44 0.34-0.36 0.5 0.12" transform="translate(${shift} 0)"/>`,
    kite: `<path d="M-0.38 0.26L0.18-0.36L0.42 0.28" transform="translate(${shift} 0)"/>`,
    pool: `<path d="M-0.54 0.18C-0.08-0.18 0.18 0.42 0.58 0.02" transform="translate(${shift} 0)"/>`,
    bowl: `<path d="M-0.46-0.18Q0 0.36 0.46-0.18" transform="translate(${shift} 0)"/>`,
    knot: `<path d="M-0.38-0.22L0.3 0.32M0.34-0.3L-0.28 0.34" transform="translate(${shift} 0)"/>`,
    step: `<path d="M-0.5-0.42H-0.04V0.16H0.48" transform="translate(${shift} 0)"/>`,
    crumb: `<path d="M-0.48 0.24L0.02-0.36L0.44 0.24" transform="translate(${shift} 0)"/>`
  };
  return marks[kind] ?? marks.pool;
}

function hollowMarkup(hollow) {
  if (hollow.kind === 'diamond') return `<path class="hollow" d="M0-0.78L0.78 0L0 0.78L-0.78 0Z" transform="translate(${fixed(hollow.x)} ${fixed(hollow.y)}) scale(${fixed(hollow.radius)})"/>`;
  return `<circle class="hollow" cx="${fixed(hollow.x)}" cy="${fixed(hollow.y)}" r="${fixed(hollow.radius)}"/>`;
}

function formMarkup(form, index) {
  const x = fixed(form.x * 1000);
  const y = fixed(form.y * viewHeight);
  const rotation = fixed(form.rotation * 57.2958);
  const scale = fixed(form.size * 1000 * form.scale);
  const shadow = index % 2 ? palette.shadow : 'rgba(216,93,76,.15)';
  const wrong = form.wrongFragments.map((fragment) => `<path class="wrong-fragment" d="${pathForKind(fragment.kind)}" fill="${fragment.color}" transform="translate(${fixed(fragment.x)} ${fixed(fragment.y)}) rotate(${fixed(fragment.rotation * 57.2958)}) scale(${fixed(fragment.scale)})"/>`).join('');
  const notches = form.notches.map((notch) => `<path class="notch" d="M-0.34-1.05L0.34-1.05L0 0.12Z" transform="rotate(${fixed(notch.angle * 57.2958)}) translate(0 0.67) scale(${fixed(notch.width)} ${fixed(notch.depth)})"/>`).join('');
  const hollows = form.hollows.map(hollowMarkup).join('');
  return `<g class="form" data-form="${form.id}" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" style="--form:${form.color};--shadow:${shadow}"><path class="form-shadow" d="${pathForKind(form.kind)}" transform="translate(.09 .12)"/><path class="form-body" d="${pathForKind(form.kind)}" fill="${form.color}"/><g class="form-mark">${form.marks.map((mark) => markForKind(mark.kind, mark.offset)).join('')}</g>${wrong}${notches}${hollows}</g>`;
}

function backgroundMarkup() {
  const threads = Array.from({ length: 15 }, (_, index) => {
    const x = 40 + index * 73;
    return `<path class="thread" d="M${x} 34 C${x + 38} 180 ${x - 20} 360 ${x + 30} ${viewHeight - 28}"/>`;
  }).join('');
  const crumbs = Array.from({ length: 96 }, (_, index) => {
    const x = (index * 97 + 43) % 1000;
    const y = (index * 149 + 37) % viewHeight;
    return `<rect class="crumb" x="${x}" y="${y}" width="${index % 5 === 0 ? 2 : 1}" height="1"/>`;
  }).join('');
  return `<defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset=".52" stop-color="#eee7d7"/><stop offset="1" stop-color="#d7e3dc"/></linearGradient></defs><rect class="paper" width="1000" height="${viewHeight}" fill="url(#paper)"/>${threads}${crumbs}`;
}

function render(frame, state = 'sequence') {
  const layout = layoutForViewport(cssWidth, cssHeight);
  viewHeight = layout.mode === 'portrait' ? 1000 : 760;
  svg.setAttribute('viewBox', `0 0 1000 ${viewHeight}`);
  svg.innerHTML = `${backgroundMarkup()}<g aria-hidden="true">${frame.scene.forms.map(formMarkup).join('')}</g>`;
  svg.dataset.stage = String(frame.stage);
  svg.dataset.memory = String(frame.scene.departureRecords.length);
  svg.dataset.presenceChanges = String(frame.scene.materialTrace.presenceChanges);
  svg.dataset.departureChanges = String(frame.scene.materialTrace.departureChanges);
  stageReadout.textContent = state === 'visitor-departure' ? 'departure kept / paused' : state === 'departure-lifted' ? 'latest departure undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.departureRecords.length} departure${frame.scene.departureRecords.length === 1 ? '' : 's'} remembered`;
  undoControl.disabled = frame.memory.length === 0;
}

function fitField() {
  cssWidth = Math.max(1, fieldWrap.clientWidth || 1000);
  cssHeight = Math.max(1, fieldWrap.clientHeight || Math.round(cssWidth * 0.76));
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    render(timeline.at(-1));
    return;
  }
  render(frameAt(now));
}

function pointerPoint(event) {
  const bounds = svg.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1)),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1))
  };
}

function makeDeparture(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-departure' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyDeparture(base, point);
  render(interactionFrame, 'visitor-departure');
}

function undoDeparture() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestDeparture(base);
  render(interactionFrame, 'departure-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  pendingPoint = null;
  started = performance.now();
  currentStage = 0;
  renderCurrent();
}

svg.addEventListener('pointerenter', (event) => {
  if (staticPreview) return;
  pendingPoint = pointerPoint(event);
});
svg.addEventListener('pointermove', (event) => {
  if (staticPreview) return;
  pendingPoint = pointerPoint(event);
});
svg.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  pendingPoint = pointerPoint(event);
});
svg.addEventListener('pointerleave', (event) => {
  if (staticPreview) return;
  const point = pendingPoint ?? pointerPoint(event);
  pendingPoint = null;
  makeDeparture(point);
});
svg.addEventListener('keydown', (event) => {
  if (staticPreview) return;
  if (event.key === 'Delete') {
    event.preventDefault();
    undoDeparture();
    return;
  }
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeDeparture({ x: 0.72, y: 0.46 });
});
departControl.addEventListener('click', () => makeDeparture({ x: 0.72, y: 0.46 }));
undoControl.addEventListener('click', undoDeparture);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitField(); renderCurrent(); });

fitField();
renderCurrent();

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);
