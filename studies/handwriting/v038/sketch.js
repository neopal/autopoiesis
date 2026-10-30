import {
  appendToken,
  beginToken,
  buildFrame,
  commitToken,
  geometrySignature,
  liftLatest,
  release,
  stateSignature
} from './engine.mjs';

const field = document.querySelector('#lexicon-field');
const slotsRoot = document.querySelector('#lexicon-slots');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const tokenReadout = document.querySelector('[data-token]');
const interactionState = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');

let frame = buildFrame();
if (staticMode) {
  for (const token of ['INK', 'ECO', 'VOW', 'KEY']) frame = commitToken(frame, token);
}

const messages = {
  quiet: 'The lexicon is quiet. No token has been offered.',
  'token armed': 'The first letter is pending. The field has not moved.',
  'token listening': 'The offer is listening. Two letters are present; the words remain exact.',
  'ratified remotely': 'Ratified elsewhere. The offered source stayed quiet while three remote slots answered.',
  'lifted latest': 'The latest remote ratification was lifted. The previous lexicon is exact again.',
  'refused token length': 'Refused. A ratification needs exactly three letters.',
  'nothing to lift': 'Nothing to lift. The lexicon has no retained ratification.',
  'release': 'Released. The lexicon is back at its quiet seed.'
};

const makeGlyph = (character, index) => {
  const glyph = document.createElement('span');
  glyph.className = 'lexicon-glyph';
  glyph.dataset.glyphIndex = String(index);
  glyph.textContent = character;
  if (character === '·') glyph.classList.add('is-hole');
  return glyph;
};

const renderSlots = () => {
  slotsRoot.replaceChildren();
  frame.field.slots.forEach((slot, slotIndex) => {
    const article = document.createElement('span');
    article.className = `lexicon-slot${slot.remote ? ' is-remote' : ''}`;
    article.dataset.slotId = slot.id;
    article.dataset.remote = String(slot.remote);
    article.style.setProperty('--slot-index', slotIndex);
    article.style.setProperty('--slot-x', slot.x);
    article.style.setProperty('--slot-y', slot.y);
    article.style.setProperty('--slot-rotate', slot.rotate);
    article.style.setProperty('--slot-scale', slot.scale);
    article.style.setProperty('--slot-tracking', slot.tracking);
    article.style.setProperty('--slot-notch', slot.notch);
    article.setAttribute('aria-label', `${slot.id}: ${slot.text}`);

    const word = document.createElement('span');
    word.className = 'lexicon-word';
    [...slot.text].forEach((character, index) => word.append(makeGlyph(character, index)));
    article.append(word);
    slotsRoot.append(article);
  });
};

const render = () => {
  renderSlots();
  const pending = frame.pending.join('');
  tokenReadout.textContent = pending ? `${pending}${'·'.repeat(3 - pending.length)}` : '· · ·';
  stage.textContent = `${frame.lastEvent} / ${frame.pending.length ? `${frame.pending.length} letters pending` : 'no token offered'}`;
  memoryReadout.textContent = `${frame.memory.length} remote ratification${frame.memory.length === 1 ? '' : 's'} · 7 slots`;
  interactionState.textContent = messages[frame.lastEvent] ?? `The lexicon reports: ${frame.lastEvent}.`;
};

const announce = (next) => {
  frame = next;
  render();
};

field.addEventListener('keydown', (event) => {
  if (/^[a-z]$/i.test(event.key)) {
    event.preventDefault();
    frame = frame.pending.length ? appendToken(frame, event.key) : beginToken(frame, event.key);
    render();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    announce(commitToken(frame));
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    announce(liftLatest(frame));
    return;
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    frame = release();
    frame = { ...frame, lastEvent: 'release' };
    render();
  }
});

field.addEventListener('pointerdown', () => field.focus());

document.querySelector('[data-action="ratify"]').addEventListener('click', () => {
  field.focus();
  announce(commitToken(frame, frame.pending.length === 3 ? undefined : 'KEY'));
});
document.querySelector('[data-action="lift"]').addEventListener('click', () => {
  field.focus();
  announce(liftLatest(frame));
});
document.querySelector('[data-action="release"]').addEventListener('click', () => {
  field.focus();
  frame = release();
  frame = { ...frame, lastEvent: 'release' };
  render();
});

window.__mutineHandwritingV038 = {
  getFrame: () => frame,
  getState: () => ({
    memory: frame.memory.length,
    pending: frame.pending.join(''),
    lastEvent: frame.lastEvent,
    changedSlotIds: [...frame.changedSlotIds],
    reducedMotion
  }),
  getSignature: () => geometrySignature(frame),
  getStateSignature: () => stateSignature(frame),
  getSlots: () => frame.field.slots.map((slot) => ({ ...slot }))
};

render();
window.__mutineReady = true;
