import {
  beginWitness,
  buildFrame,
  buildTimeline,
  commitWitness,
  geometrySignature,
  liftLatestWitness,
  releaseMemory,
  tokenSignature,
  TOKEN_COUNT
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#misread-field');
const mount = document.querySelector('#sentence-mount');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
let state = buildFrame();
let pendingSource = null;

function settledFrame() {
  let frame = buildFrame();
  for (const pair of timeline) frame = commitWitness(beginWitness(frame, { token: pair.source }), pair);
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'touch one word, then another',
  'witness-armed': 'the first word is held; answer elsewhere',
  'witness-refused-invalid': 'that is not a word in the sentence',
  'witness-refused-self': 'a word cannot answer itself',
  'witness-refused-near': 'the reply is too close to count',
  'witness-committed': 'the sentence kept the wrong word elsewhere',
  'witness-lifted': 'the last inference was lifted',
  'memory-released': 'the sentence is released'
}[state.interaction] || state.interaction);

function renderToken(token) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `sentence-token sentence-token--${token.role}`;
  button.dataset.token = String(token.id);
  button.style.setProperty('--x', `${token.x * 100}%`);
  button.style.setProperty('--y', `${token.y * 100}%`);
  button.style.setProperty('--size', String(token.size));
  button.style.setProperty('--rotate', `${token.rotate}deg`);
  button.style.setProperty('--tracking', `${token.tracking}em`);
  button.style.setProperty('--weight', String(token.weight));
  button.style.setProperty('--tone', String(token.tone));
  button.style.setProperty('--opacity', String(token.opacity));
  button.setAttribute('aria-label', `word ${token.id + 1}: ${token.parts.join(' ')}`);
  for (const [index, part] of token.parts.entries()) {
    const span = document.createElement('span');
    span.className = `token-part token-part--${index}`;
    span.textContent = part;
    button.append(span);
  }
  if (token.echo) {
    const echo = document.createElement('span');
    echo.className = 'token-echo';
    echo.setAttribute('aria-hidden', 'true');
    echo.textContent = token.echo;
    button.append(echo);
  }
  if (pendingSource === token.id) button.classList.add('is-pending');
  return button;
}

function renderTokens() {
  if (!mount) return;
  const fragment = document.createDocumentFragment();
  for (const token of state.scene.tokens) fragment.append(renderToken(token));
  mount.replaceChildren(fragment);
}

function updateReadout() {
  if (!field || !stageEl) return;
  stageEl.textContent = `inference ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = pendingSource === null ? statusText() : `word ${pendingSource + 1} held; answer with another`;
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.pendingToken = pendingSource === null ? '' : String(pendingSource);
  field.dataset.changedTokenCount = String(state.scene.trace.changedTokenCount);
}

function updateState(next) {
  state = next;
  renderTokens();
  updateReadout();
}

function deterministicPair() {
  const pair = timeline[state.memory.length % timeline.length];
  if (pendingSource === null) return pair;
  if (pair.reply !== pendingSource) return { source: pendingSource, reply: pair.reply };
  return { source: pendingSource, reply: (pendingSource + 5) % TOKEN_COUNT };
}

function commitDeterministicWitness() {
  if (staticMode) return;
  const pair = deterministicPair();
  const next = commitWitness(state, pair);
  if (next.memory.length > state.memory.length) pendingSource = null;
  updateState(next);
}

mount?.addEventListener('click', (event) => {
  if (staticMode) return;
  const button = event.target.closest('[data-token]');
  if (!button) return;
  const token = Number(button.dataset.token);
  if (pendingSource === null) {
    pendingSource = token;
    updateState(beginWitness(state, { token }));
    return;
  }
  const next = commitWitness(state, { source: pendingSource, reply: token });
  if (next.memory.length > state.memory.length) pendingSource = null;
  updateState(next);
});

field?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeterministicWitness();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    pendingSource = null;
    updateState(liftLatestWitness(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pendingSource = null;
    updateState(releaseMemory());
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const current = pendingSource ?? deterministicPair().source;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextToken = (current + delta + TOKEN_COUNT) % TOKEN_COUNT;
    pendingSource = nextToken;
    updateState(beginWitness(state, { token: nextToken }));
  }
});

document.querySelector('[data-action="infer"]')?.addEventListener('click', commitDeterministicWitness);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => {
  pendingSource = null;
  updateState(liftLatestWitness(state));
});
document.querySelector('[data-action="release"]')?.addEventListener('click', () => {
  pendingSource = null;
  updateState(releaseMemory());
});

renderTokens();
updateReadout();
window._p5Ready = true;
window.__mutineNaiveV041 = {
  buildFrame,
  beginWitness,
  commitWitness,
  geometrySignature,
  tokenSignature,
  getState: () => state,
  renderSignature: () => geometrySignature(state),
  settledFrame
};
