import {
  FRAGMENT_COUNT,
  MEMORY_WINDOW,
  attend,
  buildFrame,
  geometrySignature,
  liftLatest,
  release,
  withdraw,
  withdrawPresence
} from './engine.mjs';

const DEFAULT_DEPARTURES = [2, 5, 1, 9];
const KEYBOARD_SOURCES = [2, 9, 4, 11];
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#register-field');
const stage = document.querySelector('#register-stage');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const withdrawControl = document.querySelector('#withdraw-control');
const liftControl = document.querySelector('#lift-register');
const releaseControl = document.querySelector('#release-register');

let currentFrame = staticPreview ? buildFrame(DEFAULT_DEPARTURES) : buildFrame([]);
let lastState = staticPreview ? 'withdrawal' : 'quiet';
let keyboardFocus = 2;

const roleLabel = (state) => {
  if (state === 'attending') return `register / witness ${String(currentFrame.active + 1).padStart(2, '0')}`;
  if (state === 'withdrawal') return `register / departure ${String(currentFrame.history.length).padStart(2, '0')}`;
  if (state === 'lifted') return 'register / latest lifted';
  if (state === 'released') return 'register / released';
  if (state === 'refused') return 'register / refused';
  return 'register / quiet';
};

function fragmentLabel(fragment) {
  const state = fragment.answer ? 'remote answer' : fragment.echo ? 'echo' : fragment.witness ? 'witnessed' : fragment.role;
  return `${fragment.token}, ${state}, register ${fragment.register + 1}`;
}

function renderFragments(frame) {
  stage.replaceChildren();
  for (const fragment of frame.fragments) {
    const node = document.createElement('span');
    node.className = 'fragment';
    node.dataset.fragmentId = String(fragment.id);
    node.dataset.register = String(fragment.register);
    node.dataset.role = fragment.answer ? 'answer' : fragment.echo ? 'echo' : fragment.witness ? 'witness' : fragment.role;
    node.style.setProperty('--x', fragment.x);
    node.style.setProperty('--y', fragment.y);
    node.style.setProperty('--scale', fragment.scale);
    node.style.setProperty('--rotation', fragment.rotation);
    node.style.setProperty('--skew', fragment.skew);
    node.style.opacity = String(fragment.opacity);
    node.style.fontWeight = String(Math.round(fragment.weight));
    node.textContent = fragment.token;
    node.setAttribute('aria-label', fragmentLabel(fragment));
    stage.append(node);
  }
}

function render(frame, state = lastState) {
  currentFrame = frame;
  lastState = state;
  renderFragments(frame);
  field.dataset.stage = state;
  field.dataset.memory = String(frame.memory.length);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.active = frame.active === null ? '' : String(frame.active);
  stageReadout.textContent = roleLabel(state);
  memoryReadout.textContent = `${frame.memory.length} departures · ${FRAGMENT_COUNT} fragments`;
  interactionState.textContent = state === 'attending'
    ? `Fragment ${frame.active + 1} is being witnessed. It has not moved.`
    : state === 'withdrawal'
      ? 'The witness is gone. A remote fragment has answered; the source stayed quiet.'
      : state === 'lifted'
        ? 'The latest departure is gone. The preceding register is exact again.'
        : state === 'released'
          ? 'The register is released. Every fragment has returned to its quiet position.'
          : state === 'refused'
            ? 'Nothing moved. A departure needs a witnessed fragment.'
            : 'The register is quiet. No fragment is being witnessed.';
  withdrawControl.disabled = staticPreview;
  liftControl.disabled = staticPreview || frame.history.length === 0;
  releaseControl.disabled = staticPreview;
}

function witness(id) {
  if (staticPreview || id === currentFrame.active) return false;
  render(attend(currentFrame, id), 'attending');
  keyboardFocus = id;
  return true;
}

function commitDeparture() {
  if (staticPreview) return false;
  let frame = currentFrame;
  if (!Number.isInteger(frame.active)) frame = attend(frame, KEYBOARD_SOURCES[frame.history.length % KEYBOARD_SOURCES.length]);
  const next = withdrawPresence(frame);
  render(next, next.lastEvent === 'withdrawal' ? 'withdrawal' : 'refused');
  return next.lastEvent === 'withdrawal';
}

function playDefault() {
  if (staticPreview) return false;
  const source = KEYBOARD_SOURCES[currentFrame.history.length % KEYBOARD_SOURCES.length];
  const next = withdraw(attend(currentFrame, source), source);
  render(next, next.lastEvent === 'withdrawal' ? 'withdrawal' : 'refused');
  return next.lastEvent === 'withdrawal';
}

function lift() {
  if (staticPreview) return false;
  const next = liftLatest(currentFrame);
  render(next, next.lastEvent === 'lifted' ? 'lifted' : 'refused');
  return next.lastEvent === 'lifted';
}

function reset() {
  if (staticPreview) return false;
  render(release(), 'released');
  return true;
}

function handleKey(event) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardFocus = (keyboardFocus + (event.key === 'ArrowRight' ? 1 : -1) + FRAGMENT_COUNT) % FRAGMENT_COUNT;
    witness(keyboardFocus);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeparture();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    reset();
  }
}

field.addEventListener('keydown', handleKey);
field.addEventListener('pointermove', (event) => {
  if (staticPreview) return;
  const node = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-fragment-id]');
  if (node && stage.contains(node)) witness(Number(node.dataset.fragmentId));
});
field.addEventListener('pointerleave', () => {
  if (staticPreview || currentFrame.active === null) return;
  commitDeparture();
});
stage.addEventListener('pointerdown', (event) => {
  const node = event.target.closest?.('[data-fragment-id]');
  if (!node || staticPreview) return;
  field.focus({ preventScroll: true });
  witness(Number(node.dataset.fragmentId));
});
withdrawControl.addEventListener('click', playDefault);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', reset);

render(currentFrame, lastState);
window._p5Ready = true;
window.__mutineHandwritingV034 = {
  getState: () => ({ memory: currentFrame.memory.length, active: currentFrame.active, history: currentFrame.history.map((event) => ({ ...event })), changedFragmentIds: [...currentFrame.changedFragmentIds], lastEvent: currentFrame.lastEvent, interaction: lastState }),
  getSignature: () => geometrySignature(currentFrame),
  witness,
  commitDeparture,
  playDefault,
  liftLatest: lift,
  release: reset,
  getFrame: () => currentFrame
};
