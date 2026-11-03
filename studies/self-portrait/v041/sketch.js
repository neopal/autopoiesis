import {
  DWELL_THRESHOLD,
  buildField,
  buildTimeline,
  geometrySignature,
  attend,
  commitAttention,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field = staticMode ? buildTimeline().at(-1) : buildField();
let stageNode;
let planeNode;
let readoutNode;
let memoryNode;
let stateNode;
let hintNode;
let interactionNode;
let selectedSite = 0;
let pointerSession = null;
let demoTimer = 0;

const stateText = (stage) => ({
  quiet: 'the shutters are not yet watching back',
  'observing / 0': 'a brief look is still latent',
  'refused / too brief': 'the shutter refused a glance that ended too soon',
  'folded / local': 'the watched shutter edited its own rule',
  'lifted / exact': 'the last local edit was lifted exactly'
}[stage] ?? 'the field is deciding');

function setSelected(site, focus = false) {
  selectedSite = (site + field.plates.length) % field.plates.length;
  planeNode.querySelectorAll('[data-plate]').forEach((plate) => {
    plate.dataset.selected = String(Number(plate.dataset.site) === selectedSite);
  });
  if (focus) planeNode.querySelector(`[data-plate="${selectedSite}"]`)?.focus({ preventScroll: true });
}

function makeSegment(segment) {
  const node = document.createElement('span');
  node.className = 'plate-segment';
  node.dataset.tone = String(segment.tone);
  node.style.setProperty('--sx', segment.x);
  node.style.setProperty('--sy', segment.y);
  node.style.setProperty('--sw', segment.width);
  node.style.setProperty('--sh', segment.height);
  node.style.setProperty('--sa', `${segment.angle}deg`);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function renderField(stage = field.interaction) {
  planeNode.replaceChildren();
  for (const plate of field.plates) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'attention-plate';
    button.dataset.plate = String(plate.index);
    button.dataset.site = String(plate.index);
    button.dataset.state = plate.state;
    button.dataset.selected = String(plate.index === selectedSite);
    button.setAttribute('aria-label', `attention shutter ${plate.index + 1}`);
    button.style.setProperty('--x', plate.x);
    button.style.setProperty('--y', plate.y);
    button.style.setProperty('--w', plate.width);
    button.style.setProperty('--h', plate.height);
    button.style.setProperty('--angle', `${plate.angle}deg`);
    button.style.setProperty('--split', plate.split);
    button.style.setProperty('--offset', `${plate.offset}%`);

    const body = document.createElement('span');
    body.className = 'plate-body';
    body.setAttribute('aria-hidden', 'true');
    for (const segment of plate.segments) body.append(makeSegment(segment));
    button.append(body);
    planeNode.append(button);
  }
  setSelected(selectedSite);
  const pulse = field.attention ? ` · ${Math.round(field.attention.dwell * 1000)}ms` : '';
  readoutNode.textContent = `${stage} / ${String(field.revision).padStart(2, '0')}${pulse}`;
  memoryNode.textContent = `${field.memory.length} edit${field.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = stateText(stage);
  interactionNode.textContent = stateText(stage);
  hintNode.textContent = field.attention
    ? (field.attention.dwell >= DWELL_THRESHOLD ? 'release now · let the shutter decide' : 'stay with it · the threshold is not reached')
    : 'watch one shutter · stay past the threshold';
}

function apply(next, stage = next.interaction) {
  field = next;
  renderField(stage);
  return field;
}

function observe(site, dwell) {
  if (staticMode) return field;
  apply(attend(field, { site, dwell }), `observing / ${site}`);
  return field;
}

function finishObservation(site, dwell) {
  if (staticMode) return { accepted: false, field };
  const observing = attend(field, { site, dwell });
  const result = commitAttention(observing);
  apply(result.field, result.accepted ? 'folded / local' : 'refused / too brief');
  return result;
}

function watchSelected() {
  const dwell = DWELL_THRESHOLD + 0.18 + (selectedSite % 3) * 0.11;
  return finishObservation(selectedSite, dwell);
}

function lift() {
  if (staticMode) return field;
  return apply(liftLatest(field), 'lifted / exact');
}

function release() {
  if (staticMode) return field;
  return apply(releaseField(), 'quiet');
}

function beginPointer(event) {
  if (staticMode) return;
  const plate = event.currentTarget;
  const site = Number(plate.dataset.site);
  setSelected(site);
  pointerSession = { site, started: performance.now(), pointerId: event.pointerId };
  plate.setPointerCapture?.(event.pointerId);
  observe(site, 0);
}

function endPointer(event) {
  if (staticMode || !pointerSession) return;
  const session = pointerSession;
  pointerSession = null;
  const dwell = Math.max(0, (performance.now() - session.started) / 1000);
  finishObservation(session.site, dwell);
  event.currentTarget.releasePointerCapture?.(event.pointerId);
}

function cancelPointer() {
  pointerSession = null;
  if (!staticMode) renderField(field.interaction);
}

function cycle(direction) {
  selectedSite = (selectedSite + direction + field.plates.length) % field.plates.length;
  renderField(`selected / ${selectedSite}`);
  planeNode.querySelector(`[data-plate="${selectedSite}"]`)?.focus({ preventScroll: true });
}

stageNode = document.querySelector('[data-attention-stage]');
planeNode = document.querySelector('[data-attention-plane]');
readoutNode = document.querySelector('[data-stage]');
memoryNode = document.querySelector('[data-memory]');
stateNode = document.querySelector('[data-state]');
hintNode = document.querySelector('[data-hint]');
interactionNode = document.querySelector('[data-interaction-state]');

planeNode.addEventListener('pointerdown', (event) => {
  const plate = event.target.closest('[data-plate]');
  if (plate) beginPointer({ ...event, currentTarget: plate });
});
planeNode.addEventListener('pointerup', (event) => {
  const plate = event.target.closest('[data-plate]');
  if (plate) endPointer({ ...event, currentTarget: plate });
});
planeNode.addEventListener('pointercancel', cancelPointer);
planeNode.addEventListener('focusin', (event) => {
  const plate = event.target.closest('[data-plate]');
  if (plate) setSelected(Number(plate.dataset.site));
});

document.querySelector('[data-action="watch"]').addEventListener('click', watchSelected);
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', release);

stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); cycle(1); }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); cycle(-1); }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); watchSelected(); stageNode.focus({ preventScroll: true }); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); stageNode.focus({ preventScroll: true }); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); stageNode.focus({ preventScroll: true }); }
});

if (!staticMode && !reducedMotion) {
  demoTimer = window.setInterval(() => {
    const active = planeNode.querySelector('[data-state="folded"]');
    if (active) active.style.setProperty('--offset', `${Math.sin(performance.now() * 0.0007) * 1.2}%`);
  }, 120);
}

renderField();
window.addEventListener('beforeunload', () => window.clearInterval(demoTimer));

window.__mutinePortraitV041 = {
  DWELL_THRESHOLD,
  getState: () => JSON.parse(JSON.stringify(field)),
  geometrySignature: () => geometrySignature(field),
  attend,
  commitAttention,
  watchSelected,
  lift,
  release,
  getSelected: () => selectedSite,
  context: stageNode
};
