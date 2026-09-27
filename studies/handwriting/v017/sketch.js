import {
  STAGES,
  applyImpression,
  buildTimeline,
  removeLatestImpression
} from './engine.mjs';

const field = document.querySelector('#piece');
const shelfLayer = document.querySelector('#shelf-layer');
const glyphLayer = document.querySelector('#glyph-layer');
const vacancyLayer = document.querySelector('#vacancy-layer');
const stateNode = document.querySelector('#state');
const pressButton = document.querySelector('#press-type');
const liftButton = document.querySelector('#lift-impression');
const releaseButton = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 2200;
const timeline = buildTimeline(FINAL_STAGE);

let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let startedAt = performance.now();
let animationFrame = 0;
let latestImpressionId = null;
let lastTap = { x: 0.34, y: 0.28 };

function spanForTile(tile) {
  const node = document.createElement('span');
  node.className = 'glyph';
  node.textContent = tile.glyph;
  node.dataset.glyph = tile.glyph;
  node.dataset.slot = String(tile.slot);
  node.dataset.state = tile.state;
  node.style.setProperty('--x', tile.x.toFixed(4));
  node.style.setProperty('--y', tile.y.toFixed(4));
  node.style.setProperty('--rotation', tile.rotation.toFixed(4));
  node.style.setProperty('--scale', tile.scale.toFixed(4));
  node.style.setProperty('--stretch', tile.stretch.toFixed(4));
  node.style.fontWeight = String(tile.weight);
  return node;
}

function render() {
  shelfLayer.replaceChildren();
  glyphLayer.replaceChildren();
  vacancyLayer.replaceChildren();

  for (const shelf of frameState.shelves) {
    const line = document.createElement('div');
    line.className = 'shelf-line';
    line.dataset.locked = String(shelf.locked);
    line.style.setProperty('--y', shelf.y.toFixed(4));
    shelfLayer.append(line);
  }

  for (const tile of frameState.tiles) glyphLayer.append(spanForTile(tile));

  for (const vacancy of frameState.vacancies) {
    const node = document.createElement('div');
    node.className = 'vacancy';
    node.dataset.slot = String(vacancy.slot);
    node.style.setProperty('--x', vacancy.x.toFixed(4));
    node.style.setProperty('--y', vacancy.y.toFixed(4));
    vacancyLayer.append(node);
  }

  field.dataset.stage = String(frameState.stage);
  field.dataset.memory = String(frameState.memory.length);
  field.dataset.setCount = String(frameState.setCount);
  field.dataset.impressions = String(frameState.impressionCount);
  field.dataset.vacancies = String(frameState.vacancies.length);
  field.dataset.blind = String(blind);
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (pressButton) pressButton.disabled = !interactive || staticPreview;
  if (liftButton) liftButton.disabled = !interactive || staticPreview || frameState.memory.length === 0;
  if (releaseButton) releaseButton.disabled = !interactive || staticPreview;
}

function positionFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / Math.max(1, rect.width),
    y: (event.clientY - rect.top) / Math.max(1, rect.height)
  };
}

function placeImpression(point) {
  if (!interactive || staticPreview) return false;
  window.cancelAnimationFrame(animationFrame);
  const changed = applyImpression(frameState, point);
  lastTap = { x: point.x, y: point.y };
  frameState = changed;
  latestImpressionId = frameState.memory.at(-1)?.id ?? null;
  paused = true;
  updateState('The nearest letter took the weight; a neighbour slid, another left an impression, and a blank remained.');
  updateButtons();
  render();
  return true;
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = removeLatestImpression(frameState);
  latestImpressionId = frameState.memory.at(-1)?.id ?? null;
  paused = true;
  updateState('The latest setting lifted; the earlier type plate is exact again.');
  updateButtons();
  render();
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  latestImpressionId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The type is loose; no shelf has taken the weight.');
  updateButtons();
  render();
  animationFrame = window.requestAnimationFrame(drawFrame);
}

function saveStill() {
  const blob = new Blob([field.outerHTML], { type: 'text/html' });
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v017-setting.html';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function drawFrame(now) {
  render();
  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      latestImpressionId = frameState.memory.at(-1)?.id ?? null;
      updateButtons();
    }
    if (nextStage < FINAL_STAGE) animationFrame = window.requestAnimationFrame(drawFrame);
  }
}

field.addEventListener('pointerup', (event) => {
  if (!interactive || staticPreview) return;
  placeImpression(positionFromEvent(event));
});
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    placeImpression(lastTap);
  }
  if (event.key === 'Delete' || event.key.toLowerCase() === 'u') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
pressButton?.addEventListener('click', () => placeImpression(lastTap));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', render);

window.__mutineHandwritingV017 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((entry) => ({ ...entry })),
    setCount: frameState.setCount,
    impressionCount: frameState.impressionCount,
    vacancyCount: frameState.vacancies.length,
    paused,
    interactive,
    blind,
    latestImpressionId
  }),
  placeImpression,
  liftLatest,
  releaseSequence,
  getSignature: () => field.outerHTML,
  getField: () => field
};

updateButtons();
drawFrame(performance.now());
