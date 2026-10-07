import {
  CLAUSE_COUNT,
  buildFrame,
  commitCharacter,
  geometrySignature,
  liftLatestCharacter
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = staticPreview || reducedMotion;
const plate = document.querySelector('#refusal-plate');
const field = document.querySelector('#plate-field');
const input = document.querySelector('#letter-input');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const commitControl = document.querySelector('#commit-letter');
const liftControl = document.querySelector('#lift-letter');
const releaseControl = document.querySelector('#release-letters');

let currentFrame = buildFrame(0, []);
let selectedClause = 5;
let lastState = 'sequence';

function setState(frame, state = 'sequence') {
  currentFrame = frame;
  lastState = state;
  const grammar = frame.material.grammar || '—';
  if (stageReadout) stageReadout.textContent = state === 'character-committed' ? `plate / refusal ${String(frame.material.refusalCount).padStart(2, '0')}` : state === 'character-lifted' ? 'plate / latest lifted' : 'plate / quiet';
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} refusal${frame.memory.length === 1 ? '' : 's'} · grammar ${grammar || '—'}`;
  if (interactionState) interactionState.textContent = state === 'character-committed'
    ? 'The offer was refused here; another clause answered.'
    : state === 'character-lifted'
      ? 'The latest refusal is gone; the preceding plate is exact again.'
      : 'The plate is quiet.';
  plate.dataset.stage = String(frame.stage);
  plate.dataset.memory = String(frame.memory.length);
  plate.dataset.grammar = grammar;
  plate.dataset.interaction = state;
  if (liftControl) liftControl.disabled = staticPreview || frame.memory.length === 0;
  if (commitControl) commitControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
  render(frame);
}

function setSelectedClause(index) {
  selectedClause = Math.max(0, Math.min(CLAUSE_COUNT - 1, Number(index) || 0));
  plate.dataset.selectedClause = String(selectedClause);
  field.querySelectorAll('.clause-block').forEach((node, index) => node.classList.toggle('is-selected', index === selectedClause));
}

function clauseForPoint(event) {
  const target = event.target.closest('.clause-block');
  if (target) return Number(target.dataset.index);
  const rect = field.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  return Math.round((Math.min(3, Math.floor(x * 4)) + Math.min(2, Math.floor(y * 3)) * 4));
}

function letterValue() {
  const value = String(input?.value ?? '').trim().toLowerCase();
  return /^[a-z]$/.test(value) ? value : 'e';
}

function commit(letter = letterValue(), clause = selectedClause) {
  if (staticPreview) return false;
  const next = commitCharacter(currentFrame, { clause, letter });
  setState(next, 'character-committed');
  if (input) input.value = letter;
  return true;
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  setState(liftLatestCharacter(currentFrame), 'character-lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  setState(buildFrame(0, []), 'sequence');
  return true;
}

function render(frame) {
  field.replaceChildren(...frame.blocks.map((block, index) => {
    const node = document.createElement('article');
    node.className = 'clause-block';
    node.dataset.index = String(index);
    node.dataset.role = frame.memory.at(-1)?.clause === index ? 'local' : frame.memory.at(-1)?.replyIndex === index ? 'reply' : Math.abs((frame.memory.at(-1)?.clause ?? -9) - index) <= 2 ? 'nearby' : 'quiet';
    node.dataset.block = String(index + 1).padStart(2, '0');
    node.dataset.index = String(index);
    node.style.setProperty('--x', block.x);
    node.style.setProperty('--y', block.y);
    node.style.setProperty('--rotation', block.rotation);
    node.style.setProperty('--scale', block.scale);
    node.style.setProperty('--weight', block.weight);
    node.style.setProperty('--block-accent', index % 3 === 0 ? 'var(--plate-coral)' : index % 3 === 1 ? 'var(--plate-lime)' : 'var(--plate-blue)');
    node.textContent = block.text;
    return node;
  }));
  setSelectedClause(selectedClause);
}

function handleKey(event) {
  if (/^[a-z]$/i.test(event.key)) {
    event.preventDefault();
    if (input) input.value = event.key.toLowerCase();
    commit(event.key.toLowerCase());
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
}

field.addEventListener('pointermove', (event) => {
  if (event.target.closest('.clause-block')) setSelectedClause(clauseForPoint(event));
});
field.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  setSelectedClause(clauseForPoint(event));
  plate.focus({ preventScroll: true });
});
plate.addEventListener('keydown', handleKey);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  }
});
commitControl.addEventListener('click', () => commit());
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

setState(currentFrame, 'sequence');
window._p5Ready = true;
window.__mutineHandwritingV025 = {
  getState: () => ({ memory: currentFrame.memory.length, grammar: currentFrame.material.grammar, interaction: lastState, selectedClause }),
  getSignature: () => geometrySignature(currentFrame),
  commitDefault: () => commit(),
  commitCharacter: (letter, clause = selectedClause) => commit(letter, clause),
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
