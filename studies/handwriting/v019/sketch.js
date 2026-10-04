import {
  DEFAULT_PHONEMES,
  applyAddress,
  buildInitialState,
  buildTimeline,
  removeLatestAddress,
  signature
} from './engine.mjs';

const field = document.querySelector('#field');
const glyphLayer = document.querySelector('#glyph-layer');
const holeLayer = document.querySelector('#hole-layer');
const stateNode = document.querySelector('#state');
const input = document.querySelector('#phoneme-input');
const liftButton = document.querySelector('#lift-address');
const releaseButton = document.querySelector('#release-address');
const addressButtons = [...document.querySelectorAll('[data-phoneme]')];
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const timeline = buildTimeline();

let frameState = staticPreview || reduced ? timeline.at(-1) : buildInitialState();
let lastPointerAt = 0;

function render() {
  const glyphFragment = document.createDocumentFragment();
  const holeFragment = document.createDocumentFragment();

  for (const hole of frameState.sourceHoles) {
    const holeNode = document.createElement('span');
    holeNode.className = 'source-hole';
    holeNode.style.setProperty('--x', hole.x);
    holeNode.style.setProperty('--y', hole.y);
    holeNode.dataset.sourceSlot = hole.sourceSlot;
    holeNode.dataset.char = hole.char;
    holeFragment.append(holeNode);
  }

  for (const glyph of frameState.glyphs) {
    const glyphNode = document.createElement('span');
    glyphNode.className = 'glyph';
    glyphNode.textContent = glyph.char;
    glyphNode.style.setProperty('--x', glyph.x);
    glyphNode.style.setProperty('--y', glyph.y);
    glyphNode.style.setProperty('--rotation', `${glyph.rotation}deg`);
    glyphNode.dataset.glyphId = glyph.id;
    glyphNode.dataset.char = glyph.char;
    glyphNode.dataset.sourceSlot = glyph.sourceSlot;
    glyphNode.dataset.slot = glyph.slot;
    glyphNode.dataset.reply = String(glyph.reply);
    glyphNode.dataset.vacant = String(glyph.vacant);
    glyphFragment.append(glyphNode);
  }

  glyphLayer.replaceChildren(glyphFragment);
  holeLayer.replaceChildren(holeFragment);
  field.dataset.stage = String(frameState.stage);
  field.dataset.memory = String(frameState.memory.length);
  field.dataset.replies = String(frameState.replyCount);
  field.dataset.vacancies = String(frameState.vacancyCount);
  field.dataset.activePhoneme = frameState.activePhoneme || '';
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  const locked = !interactive || staticPreview;
  addressButtons.forEach((button) => {
    button.disabled = locked || frameState.memory.length >= frameState.memoryWindow;
  });
  if (input) input.disabled = locked || frameState.memory.length >= frameState.memoryWindow;
  if (liftButton) liftButton.disabled = locked || frameState.memory.length === 0;
  if (releaseButton) releaseButton.disabled = locked;
}

function normalizeInput(value) {
  const letter = String(value || '').trim().slice(0, 1).toUpperCase();
  return DEFAULT_PHONEMES.includes(letter) ? letter : '';
}

function addressPhoneme(value, reason = 'typed') {
  if (!interactive || staticPreview) return false;
  const phoneme = normalizeInput(value);
  if (!phoneme || frameState.memory.length >= frameState.memoryWindow) return false;
  frameState = applyAddress(frameState, phoneme);
  if (input) input.value = '';
  updateState(`Address ${phoneme} answered: matching letters left ${frameState.replyCount} source slots vacant.`);
  updateButtons();
  render();
  return reason !== 'pointer';
}

function liftLatest() {
  if (!interactive || staticPreview || frameState.memory.length === 0) return false;
  frameState = removeLatestAddress(frameState);
  updateState('The latest address lifted; the preceding source-and-reply field is exact again.');
  updateButtons();
  render();
  return true;
}

function releaseSequence() {
  if (!interactive || staticPreview) return false;
  frameState = buildInitialState();
  updateState('The field is closed; no letter has been addressed.');
  updateButtons();
  render();
  return true;
}

field.addEventListener('pointerdown', () => {
  lastPointerAt = performance.now();
});
field.addEventListener('pointerup', () => {
  if (!interactive || staticPreview) return;
  const heldFor = performance.now() - lastPointerAt;
  updateState(`Pointer address refused after ${Math.round(heldFor)}ms; type a phoneme or choose an address.`);
});
field.addEventListener('keydown', (event) => {
  const key = event.key.toUpperCase();
  if (DEFAULT_PHONEMES.includes(key)) {
    event.preventDefault();
    addressPhoneme(key, 'keyboard');
  } else if (event.key === 'Enter') {
    event.preventDefault();
    addressPhoneme(input?.value || DEFAULT_PHONEMES[frameState.memory.length % DEFAULT_PHONEMES.length], 'keyboard');
  } else if (event.key === 'Delete' || key === 'U') {
    event.preventDefault();
    liftLatest();
  } else if (key === 'R') {
    event.preventDefault();
    releaseSequence();
  }
});
input?.addEventListener('input', () => {
  input.value = input.value.toUpperCase().replace(/[^AEIO]/g, '').slice(0, 1);
});
input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addressPhoneme(input.value || DEFAULT_PHONEMES[frameState.memory.length % DEFAULT_PHONEMES.length], 'input');
  }
});
addressButtons.forEach((button) => button.addEventListener('click', () => addressPhoneme(button.dataset.phoneme, 'button')));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', render);

window.__mutineHandwritingV019 = {
  getState: () => ({
    stage: frameState.stage,
    memory: [...frameState.memory],
    activePhoneme: frameState.activePhoneme,
    replyCount: frameState.replyCount,
    vacancyCount: frameState.vacancyCount,
    interactive,
    blind: params.get('blind') === '1'
  }),
  address: addressPhoneme,
  liftLatest,
  releaseSequence,
  getSignature: () => signature(frameState),
  getField: () => field
};

updateButtons();
render();
