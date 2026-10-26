import {
  MIN_TURN_DISTANCE,
  beginTurn,
  buildFrame,
  buildTimeline,
  commitTurn,
  geometrySignature,
  liftLatestTurn,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#fold-field');
const paper = document.querySelector('#fold-paper');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
let state = buildFrame();
let foldElements = [];
let wheelBudget = 0;
let wheelDirection = 1;
let pointerStart = null;

function settledFrame() {
  let frame = buildFrame();
  for (const turn of timeline) frame = commitTurn(beginTurn(frame, turn), turn);
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'scroll to turn the page',
  'turn-armed': 'the page is listening to a turn',
  'turn-refused-invalid': 'the page keeps its fold',
  'turn-refused-shallow': 'the turn was too small',
  'turn-committed': 'the page invented the unread fold',
  'turn-lifted': 'the last mistake was lifted',
  'memory-released': 'the page is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!stageEl) return;
  stageEl.textContent = `turn ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field?.setAttribute('data-memory-count', String(state.memory.length));
}

function roleClass(role) {
  return role === 'quiet' ? 'fold--quiet' : `fold--${role}`;
}

function foldPath(index) {
  return `fold-shape-${(index % 5) + 1}`;
}

function createFoldElements() {
  if (!paper || foldElements.length) return;
  foldElements = state.scene.folds.map((fold) => {
    const element = document.createElement('div');
    element.className = `fold ${foldPath(fold.id)} ${roleClass(fold.role)}`;
    element.dataset.foldId = String(fold.id);
    paper.append(element);
    return element;
  });
}

function render() {
  createFoldElements();
  state.scene.folds.forEach((fold, index) => {
    const element = foldElements[index];
    element.className = `fold ${foldPath(index)} ${roleClass(fold.role)}`;
    element.style.setProperty('--fold-x', `${fold.x * 100}%`);
    element.style.setProperty('--fold-y', `${fold.y * 100}%`);
    element.style.setProperty('--fold-width', `${fold.width * 100}%`);
    element.style.setProperty('--fold-height', `${fold.height * 100}%`);
    element.style.setProperty('--fold-rotation', `${fold.rotation}deg`);
    element.style.setProperty('--fold-depth', String(Math.round(fold.depth * 100)));
    element.style.setProperty('--fold-crease', String(Math.min(1, fold.crease)));
  });
  updateReadout();
}

function updateState(next) {
  state = next;
  render();
  field?.focus({ preventScroll: true });
}

function turn(focus, direction, distance = 0.44) {
  const armed = beginTurn(state, { focus, direction });
  updateState(commitTurn(armed, { focus, direction, distance }));
}

function deterministicTurn() {
  const turnData = timeline[state.memory.length % timeline.length];
  turn(turnData.focus, turnData.direction, turnData.distance);
}

function lift() {
  updateState(liftLatestTurn(state));
}

function release() {
  updateState(releaseMemory(state));
}

function focusFromClientX(clientX) {
  const rect = field?.getBoundingClientRect();
  if (!rect || !rect.width) return 2;
  const normalised = Math.max(0, Math.min(0.999, (clientX - rect.left) / rect.width));
  return Math.floor(normalised * state.scene.folds.length);
}

function wheelTurn(event) {
  if (staticMode) return;
  event.preventDefault();
  const direction = Math.sign(event.deltaY) || 1;
  if (direction !== wheelDirection) wheelBudget = 0;
  wheelDirection = direction;
  wheelBudget += Math.abs(event.deltaY) / Math.max(1, field?.clientHeight || 600);
  if (wheelBudget < MIN_TURN_DISTANCE) return;
  const distance = Math.min(0.86, wheelBudget);
  wheelBudget = 0;
  turn(focusFromClientX(event.clientX), direction, distance);
}

field?.addEventListener('wheel', wheelTurn, { passive: false });
field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  pointerStart = { x: event.clientX, y: event.clientY, focus: focusFromClientX(event.clientX) };
  field.focus({ preventScroll: true });
  field.setPointerCapture?.(event.pointerId);
});
field?.addEventListener('pointerup', (event) => {
  if (staticMode || !pointerStart) return;
  const start = pointerStart;
  pointerStart = null;
  field.releasePointerCapture?.(event.pointerId);
  const rect = field.getBoundingClientRect();
  const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y) / Math.max(rect.width, rect.height);
  const direction = event.clientY - start.y >= 0 ? 1 : -1;
  if (distance >= MIN_TURN_DISTANCE) turn(start.focus, direction, Math.min(0.86, distance));
  else updateState(commitTurn(beginTurn(state, start), { ...start, distance }));
});
field?.addEventListener('pointercancel', () => { pointerStart = null; });
field?.addEventListener('keydown', (event) => {
  if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
    event.preventDefault();
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
    const turnData = timeline[state.memory.length % timeline.length];
    turn(turnData.focus, direction, turnData.distance);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicTurn();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

document.querySelector('[data-action="turn"]')?.addEventListener('click', deterministicTurn);
document.querySelector('[data-action="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-action="release"]')?.addEventListener('click', release);

render();

window.__mutineNaiveV036 = {
  getState: () => state,
  turn,
  lift,
  release,
  geometrySignature,
  settledFrame
};
