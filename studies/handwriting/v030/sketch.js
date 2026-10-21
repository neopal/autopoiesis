import {
  OFFER_LETTERS,
  buildFrame,
  geometrySignature,
  liftLatest,
  offerLetter,
  releaseFrame
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#type-field');
const sheet = document.querySelector('#type-sheet');
const letterButtons = document.querySelector('#letter-buttons');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const liftControl = document.querySelector('#lift-refusal');
const releaseControl = document.querySelector('#release-refusal');

let currentFrame = buildFrame();
let lastState = 'quiet';
let deterministicIndex = 0;

function renderFrame() {
  sheet.replaceChildren();
  currentFrame.glyphs.forEach((glyph) => {
    const element = document.createElement('span');
    const classes = ['glyph'];
    if (glyph.original === ' ') classes.push('glyph--space');
    if (glyph.removed) classes.push('glyph--void');
    element.className = classes.join(' ');
    element.dataset.index = String(glyph.index);
    element.dataset.original = glyph.original;
    element.textContent = glyph.char;
    if (glyph.removed) {
      element.setAttribute('aria-hidden', 'true');
      element.dataset.gap = 'true';
    } else if (glyph.original === ' ') {
      element.setAttribute('aria-hidden', 'true');
    }
    element.style.setProperty('--glyph-index', String(glyph.index));
    element.style.setProperty('--visible-index', String(glyph.visibleIndex ?? -1));
    sheet.appendChild(element);
  });

  letterButtons.querySelectorAll('button[data-letter]').forEach((button) => {
    const letter = button.dataset.letter;
    button.disabled = staticPreview || !currentFrame.material.text.includes(letter);
    button.classList.toggle('is-refused', currentFrame.material.refusedLetters.includes(letter));
  });
}

function updateUi(frame, state = 'quiet') {
  currentFrame = frame;
  lastState = state;
  const accepted = frame.material.acceptedCount;
  const refused = frame.material.refusedCount;
  const gaps = frame.material.removedCount;
  const stageLabel = state === 'accepted'
    ? `sheet / refusal ${String(accepted).padStart(2, '0')}`
    : state === 'refused'
      ? 'sheet / offer refused'
      : state === 'lifted'
        ? 'sheet / latest lifted'
        : 'sheet / intact';
  if (stageReadout) stageReadout.textContent = stageLabel;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} refusals · ${gaps} gaps`;
  if (interactionState) {
    interactionState.textContent = state === 'accepted'
      ? `The page refused ${frame.material.offeredLetter}. Every ${frame.material.offeredLetter} became a structural gap.`
      : state === 'refused'
        ? 'That letter is already absent, or the offer was not a letter. The sheet stayed exact.'
        : state === 'lifted'
          ? 'The latest refusal is gone. The preceding sentence is exact again.'
          : refused > 0
            ? `${refused} offer${refused === 1 ? '' : 's'} refused without changing the sentence.`
            : 'The sentence is intact. Nothing has been offered.';
  }
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = state;
  liftControl.disabled = staticPreview || frame.memory.length === 0;
  releaseControl.disabled = staticPreview;
  renderFrame();
}

function seedStaticSheet() {
  ['E', 'A', 'I', 'O'].forEach((letter) => {
    currentFrame = offerLetter(currentFrame, letter);
  });
}

function offer(letter) {
  if (staticPreview) return false;
  const before = geometrySignature(currentFrame);
  const next = offerLetter(currentFrame, letter);
  const accepted = next.material.lastEvent === 'accepted' && geometrySignature(next) !== before;
  updateUi(next, accepted ? 'accepted' : 'refused');
  return accepted;
}

function offerNext() {
  if (staticPreview) return false;
  for (let offset = 0; offset < OFFER_LETTERS.length; offset += 1) {
    const letter = OFFER_LETTERS[(deterministicIndex + offset) % OFFER_LETTERS.length];
    if (currentFrame.material.text.includes(letter)) {
      deterministicIndex = (deterministicIndex + offset + 1) % OFFER_LETTERS.length;
      return offer(letter);
    }
  }
  return offer(OFFER_LETTERS[deterministicIndex % OFFER_LETTERS.length]);
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  updateUi(liftLatest(currentFrame), 'lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  updateUi(releaseFrame(), 'quiet');
  return true;
}

function handleKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    offerNext();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  } else if (/^[a-z]$/i.test(event.key)) {
    event.preventDefault();
    offer(event.key);
  }
}

function ensureLetterButtons() {
  letterButtons.replaceChildren();
  OFFER_LETTERS.forEach((letter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.letter = letter;
    button.textContent = letter;
    button.setAttribute('aria-label', `Offer letter ${letter}`);
    button.addEventListener('click', () => offer(letter));
    letterButtons.appendChild(button);
  });
}

ensureLetterButtons();
if (staticPreview) seedStaticSheet();
updateUi(currentFrame, staticPreview ? 'accepted' : 'quiet');
document.addEventListener('keydown', handleKey);
field.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('button')) field.focus({ preventScroll: true });
});
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

window._p5Ready = true;
window.__mutineHandwritingV030 = {
  getState: () => ({
    memory: currentFrame.memory.length,
    acceptedCount: currentFrame.material.acceptedCount,
    refusedCount: currentFrame.material.refusedCount,
    removedCount: currentFrame.material.removedCount,
    text: currentFrame.material.text,
    lastEvent: currentFrame.material.lastEvent,
    interaction: lastState
  }),
  getSignature: () => geometrySignature(currentFrame),
  offerLetter: offer,
  commitDefault: offerNext,
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
