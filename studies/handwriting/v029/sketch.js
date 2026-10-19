import {
  buildFrame,
  geometrySignature,
  liftLatestCensus,
  observeTile,
  releaseCensus,
  takeCensus,
  TILE_COUNT
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#attention-field');
const archipelago = document.querySelector('#word-archipelago');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const censusControl = document.querySelector('#take-census');
const liftControl = document.querySelector('#lift-census');
const releaseControl = document.querySelector('#release-census');

let currentFrame = buildFrame(0, []);
let lastState = 'quiet';
let lastObservedIndex = null;

function nearestTile(event) {
  const rect = archipelago.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  [...archipelago.children].forEach((tile, index) => {
    const tileRect = tile.getBoundingClientRect();
    const centerX = tileRect.left - rect.left + tileRect.width / 2;
    const centerY = tileRect.top - rect.top + tileRect.height / 2;
    const nextDistance = ((x - centerX) ** 2) + ((y - centerY) ** 2);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  });
  return nearest;
}

function renderFrame() {
  currentFrame.tiles.forEach((tile, index) => {
    const element = archipelago.children[index];
    if (!element) return;
    element.textContent = tile.text;
    element.className = `word-tile word-tile--${tile.tone}${tile.silence ? ' is-silent' : ''}${currentFrame.material.attention[index] > 0 ? ' is-attended' : ''}`;
    element.style.left = `${50 + tile.x * 43}%`;
    element.style.top = `${50 + tile.y * 42}%`;
    element.style.fontWeight = String(tile.weight);
    element.style.setProperty('--cadence', String(tile.cadence));
    element.style.setProperty('--cadence-scale', String(Math.max(.18, Math.min(1, .38 + tile.cadence * .3))));
    element.style.transform = `translate(-50%, -50%) rotate(${tile.rotation}deg) scale(${tile.scale})`;
    element.dataset.attention = String(currentFrame.material.attention[index] || 0);
  });
}

function ensureTiles() {
  if (archipelago.children.length === TILE_COUNT) return;
  archipelago.replaceChildren();
  for (let index = 0; index < TILE_COUNT; index += 1) {
    const tile = document.createElement('span');
    tile.className = 'word-tile';
    tile.dataset.tileIndex = String(index);
    tile.setAttribute('aria-hidden', 'true');
    archipelago.appendChild(tile);
  }
}

function updateUi(frame, state = 'quiet') {
  currentFrame = frame;
  lastState = state;
  const attentionTotal = Math.round((frame.material.attention || []).reduce((sum, value) => sum + value, 0) * 10) / 10;
  const memoryLabel = `${frame.memory.length} census${frame.memory.length === 1 ? '' : 'es'} · attention ${attentionTotal}`;
  const stageLabel = state === 'observing'
    ? 'field / listening'
    : state === 'census'
      ? `field / census ${String(frame.material.censusCount).padStart(2, '0')}`
      : state === 'refused'
        ? 'field / census refused'
        : state === 'lifted'
          ? 'field / latest lifted'
          : 'field / uncounted';
  if (stageReadout) stageReadout.textContent = stageLabel;
  if (memoryReadout) memoryReadout.textContent = memoryLabel;
  if (interactionState) {
    interactionState.textContent = state === 'observing'
      ? 'Attention is accumulating; the words are still exact.'
      : state === 'census'
        ? 'The most-heard word went quiet; the quietest word carried it elsewhere.'
        : state === 'refused'
          ? 'Not enough separate words were visited. The census stayed silent.'
          : state === 'lifted'
            ? 'The latest census is gone; the preceding vocabulary is exact again.'
            : 'The words have not been counted.';
  }
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = state;
  if (liftControl) liftControl.disabled = staticPreview || frame.memory.length === 0;
  if (censusControl) censusControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
  renderFrame();
}

function observe(index, amount = .18) {
  if (staticPreview) return false;
  currentFrame = observeTile(currentFrame, { index, amount });
  lastObservedIndex = index;
  updateUi(currentFrame, 'observing');
  return true;
}

function seedDeterministicAttention() {
  [1, 4, 7, 10, 3].forEach((index) => {
    currentFrame = observeTile(currentFrame, { index, amount: .2 });
  });
}

function census() {
  if (staticPreview) return false;
  if (currentFrame.material.distinctObserved < 4) seedDeterministicAttention();
  const next = takeCensus(currentFrame);
  const changed = next.material.lastEvent === 'census';
  updateUi(next, changed ? 'census' : 'refused');
  return changed;
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  updateUi(liftLatestCensus(currentFrame), 'lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  lastObservedIndex = null;
  updateUi(releaseCensus(), 'quiet');
  return true;
}

function handlePointerDown(event) {
  if (staticPreview || event.target.closest('button')) return;
  field.focus({ preventScroll: true });
  observe(nearestTile(event), .12);
}

function handlePointerMove(event) {
  if (staticPreview || event.target.closest('button')) return;
  const index = nearestTile(event);
  if (index !== lastObservedIndex || currentFrame.material.observationCount === 0) observe(index, .08);
}

function handleKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    census();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
}

ensureTiles();
updateUi(currentFrame, 'quiet');
field.addEventListener('pointerdown', handlePointerDown);
field.addEventListener('pointermove', handlePointerMove);
field.addEventListener('keydown', handleKey);
censusControl.addEventListener('click', census);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

window._p5Ready = true;
window.__mutineHandwritingV029 = {
  getState: () => ({
    memory: currentFrame.memory.length,
    observationCount: currentFrame.material.observationCount,
    distinctObserved: currentFrame.material.distinctObserved,
    lastEvent: currentFrame.material.lastEvent,
    interaction: lastState,
    speakerIndex: currentFrame.material.speakerIndex,
    silenceIndex: currentFrame.material.silenceIndex,
    relayIndex: currentFrame.material.relayIndex
  }),
  getSignature: () => geometrySignature(currentFrame),
  observeTile: (index = 0) => observe(index),
  commitDefault: census,
  takeCensus: census,
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
