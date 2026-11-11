import {
  TOKEN_COUNT,
  buildFrame,
  buildTimeline,
  attend,
  fieldSignature,
  liftLatest,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('[data-attention-field]');
const tokenLayer = document.querySelector('[data-token-layer]');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
let state = staticMode ? buildTimeline().at(-1) : buildFrame();
let focusIndex = 0;
let nearIndex = null;
let pointerActive = false;
const deterministicTrios = [[1, 4, 7], [2, 6, 0], [8, 3, 5], [4, 0, 6]];

const statusText = () => ({
  idle: 'approach three different words',
  'attention-staged': 'the model is watching the wrong place',
  'attention-refused-repeat': 'the model refuses a repeated witness',
  'attention-refused-invalid': 'there is no answer at that coordinate',
  'attention-refused-full': 'the memory is already full',
  'misattributed-consensus': 'the unseen room has answered',
  'lifted / exact': 'the last answer was lifted exactly',
  'memory-released': 'the sentence has forgotten the visits'
}[state.interaction] || state.interaction);

function setState(next) {
  state = next;
  render();
}

function renderReadout() {
  if (!stageEl || !memoryEl || !statusEl) return;
  stageEl.textContent = `attention ${String(state.pending.length).padStart(2, '0')} / 03`;
  memoryEl.textContent = `${state.memory.length} remembered`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.pendingCount = String(state.pending.length);
  field.dataset.falseAnswerCount = String(state.body.tokens.filter((token) => token.falseAnswer).length);
}

function renderTokens() {
  if (!tokenLayer) return;
  const nodes = state.body.tokens.map((token) => {
    const node = document.createElement('span');
    node.className = `attention-token${token.falseAnswer ? ' false-answer' : ''}${state.pending.includes(token.id) ? ' is-pending' : ''}${token.id === nearIndex ? ' is-near' : ''}${token.id === focusIndex ? ' is-focus' : ''}`;
    node.dataset.tokenId = String(token.id);
    node.textContent = token.word;
    node.style.setProperty('--x', `${token.x}%`);
    node.style.setProperty('--y', `${token.y}%`);
    node.style.setProperty('--r', `${token.rotation}deg`);
    node.style.setProperty('--s', token.scale);
    node.style.setProperty('--weight', token.weight);
    return node;
  });
  tokenLayer.replaceChildren(...nodes);
}

function render() {
  renderTokens();
  renderReadout();
}

function nearestToken(clientX, clientY) {
  const nodes = [...tokenLayer.querySelectorAll('[data-token-id]')];
  let nearest = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const candidateDistance = Math.hypot(dx, dy);
    if (candidateDistance < distance) {
      distance = candidateDistance;
      nearest = Number(node.dataset.tokenId);
    }
  }
  return nearest;
}

function stagePointer(clientX, clientY) {
  if (!field || staticMode) return;
  const candidate = nearestToken(clientX, clientY);
  if (candidate === null || candidate === nearIndex) return;
  nearIndex = candidate;
  focusIndex = candidate;
  renderTokens();
}

function releasePointer() {
  if (!field || staticMode || nearIndex === null) return;
  setState(attend(state, nearIndex).field);
}

function completeDeterministicAttention() {
  if (staticMode || state.memory.length >= 4) return;
  let current = state;
  const trio = deterministicTrios[state.memory.length];
  for (const tokenIndex of trio) current = attend(current, tokenIndex).field;
  setState(current);
}

field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointerActive = true;
  field.setPointerCapture?.(event.pointerId);
  stagePointer(event.clientX, event.clientY);
}, { passive: false });

field?.addEventListener('pointermove', (event) => {
  if (staticMode || !pointerActive) return;
  event.preventDefault();
  stagePointer(event.clientX, event.clientY);
}, { passive: false });

field?.addEventListener('pointerup', (event) => {
  if (staticMode || !pointerActive) return;
  event.preventDefault();
  pointerActive = false;
  field.releasePointerCapture?.(event.pointerId);
  releasePointer();
}, { passive: false });

field?.addEventListener('pointercancel', () => {
  pointerActive = false;
  nearIndex = null;
  renderTokens();
});

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % TOKEN_COUNT;
    nearIndex = focusIndex;
    renderTokens();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + TOKEN_COUNT - 1) % TOKEN_COUNT;
    nearIndex = focusIndex;
    renderTokens();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    setState(attend(state, focusIndex).field);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    setState(liftLatest(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    setState(releaseMemory());
  }
});

document.querySelector('[data-action="attend"]')?.addEventListener('click', completeDeterministicAttention);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => { if (!staticMode) setState(liftLatest(state)); });
document.querySelector('[data-action="release"]')?.addEventListener('click', () => { if (!staticMode) setState(releaseMemory()); });

render();
window.__mutineNaiveV050 = {
  getState: () => state,
  attend: (index) => { if (!staticMode) setState(attend(state, index).field); },
  buildFrame,
  buildTimeline,
  fieldSignature: () => fieldSignature(state),
  liftLatest,
  releaseMemory,
  renderSignature: () => fieldSignature(state)
};
