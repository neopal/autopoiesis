import {
  ZONE_COUNT,
  buildFrame,
  buildTimeline,
  geometrySignature,
  attend,
  withdraw,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = staticMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG_NS = 'http://www.w3.org/2000/svg';

let state = staticMode ? buildTimeline().at(-1) : buildFrame(0);
let selectedZone = 0;
let stage;
let svg;
let zonePaths;
let readoutStage;
let readoutMemory;
let readoutState;
let interactionState;
let hint;
let markerLayer;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function setup() {
  stage = document.querySelector('[data-reciprocal-absence]');
  svg = document.querySelector('#reciprocal-field');
  zonePaths = [...document.querySelectorAll('.zone[data-zone]')];
  readoutStage = document.querySelector('[data-stage]');
  readoutMemory = document.querySelector('[data-memory]');
  readoutState = document.querySelector('[data-state]');
  interactionState = document.querySelector('[data-interaction-state]');
  hint = document.querySelector('[data-hint]');
  markerLayer = document.querySelector('#event-markers');
  bindControls();
  renderState();
  window.__mutinePortraitV033 = {
    getState: () => structuredClone(state),
    attend: (zone) => attendZone(Number(zone)),
    withdraw: () => withdrawAttention(),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    geometrySignature: () => geometrySignature(state)
  };
}

function bindControls() {
  zonePaths.forEach((path) => {
    const zone = Number(path.dataset.zone);
    path.addEventListener('pointerenter', () => {
      selectedZone = zone;
      attendZone(zone);
    });
    path.addEventListener('pointerleave', () => {
      if (state.armedZone === zone) withdrawAttention();
    });
    path.addEventListener('focus', () => {
      selectedZone = zone;
      attendZone(zone);
    });
    path.addEventListener('blur', () => {
      if (state.armedZone === zone) withdrawAttention();
    });
  });
  document.querySelectorAll('[data-zone-control]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedZone = Number(button.dataset.zoneControl);
      attendZone(selectedZone);
    });
  });
  document.querySelector('[data-action="withdraw"]').addEventListener('click', withdrawAttention);
  document.querySelector('[data-action="lift"]').addEventListener('click', liftRevision);
  document.querySelector('[data-action="release"]').addEventListener('click', releaseRevision);
  stage.addEventListener('keydown', handleKeydown);
}

function handleKeydown(event) {
  const directions = { ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1 };
  if (Object.hasOwn(directions, event.key)) {
    event.preventDefault();
    const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
    selectedZone = (selectedZone + step + ZONE_COUNT) % ZONE_COUNT;
    attendZone(selectedZone);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (state.armedZone === null) attendZone(selectedZone);
    else withdrawAttention();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftRevision();
  } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
    event.preventDefault();
    releaseRevision();
  }
}

function attendZone(zone) {
  const result = attend(state, zone);
  state = result.frame;
  selectedZone = Number(zone);
  renderState(result.reason);
}

function withdrawAttention() {
  const result = withdraw(state);
  state = result.frame;
  renderState(result.reason || (result.accepted ? 'withdrawn' : 'refused'));
}

function liftRevision() {
  state = liftLatest(state);
  renderState('lifted');
}

function releaseRevision() {
  state = releaseField(0);
  renderState('released');
}

function renderState(reason = state.interaction) {
  zonePaths.forEach((path, index) => {
    const zone = state.zones[index];
    path.setAttribute('d', zonePath(zone));
    path.setAttribute('class', `zone zone-hit state-${zone.state}`);
    path.setAttribute('aria-label', `Attention zone ${index + 1}, ${zone.state}`);
    path.setAttribute('data-state', zone.state);
  });
  const seam = state.mirror.seam * 1000;
  const bow = state.mirror.tension * 90;
  const offset = state.mirror.offset * 140;
  document.querySelector('#seam').setAttribute('d', `M${seam} 111 C${seam - bow} 195 ${seam + bow} 277 ${seam} 358 C${seam + bow * .8} 442 ${seam - bow * .8} 526 ${seam + offset} 602`);
  document.querySelector('#seam-shadow').setAttribute('d', `M${seam + 8} 106 C${seam - bow - 10} 195 ${seam + bow + 10} 277 ${seam + 8} 358 C${seam + bow} 442 ${seam - bow} 526 ${seam + offset + 8} 610`);
  renderMarkers();
  const pending = state.armedZone !== null;
  readoutStage.textContent = `${pending ? 'attention held' : state.interaction === 'waiting' ? 'quiet field' : state.interaction} / ${String(state.revision).padStart(2, '0')}`;
  readoutMemory.textContent = `${state.memory.length} withdrawal${state.memory.length === 1 ? '' : 's'} held`;
  readoutState.textContent = pending ? `zone ${state.armedZone + 1} is being watched` : state.memory.length ? `the answer moved to a remote zone` : 'the portrait is waiting';
  interactionState.textContent = humanState(reason);
  hint.textContent = pending ? 'leave the zone to let it answer' : 'enter a zone, then leave it';
}

function humanState(reason) {
  const labels = {
    'attention-held': 'Attention is held. The body has not changed.',
    'attention-already-held': 'A second gaze is refused until the first one leaves.',
    'no-attention-held': 'Nothing is answered without a held attention.',
    withdrawn: 'The portrait answered somewhere else.',
    lifted: 'The latest answer was lifted from the body.',
    released: 'The field returned to its quiet seed.',
    refused: 'The field refused that gesture.'
  };
  return labels[reason] || labels[state.interaction] || 'The portrait is waiting for a witness.';
}

function zonePath(zone) {
  const y = zone.y * 720;
  const h = zone.height * 720;
  const w = zone.width * 720;
  const slant = zone.slant * 120;
  const drift = zone.drift * 130;
  const notch = zone.aperture * 145;
  const left = zone.side === 'left';
  const x = left ? 164 + drift : 836 - w - drift;
  const near = left ? x + w : x;
  const far = left ? x : x + w;
  const outerShift = left ? slant : -slant;
  const innerTop = y + h * .25;
  const innerBottom = y + h * .75;
  const innerMid = (innerTop + innerBottom) / 2;
  if (left) {
    return `M${far} ${y + 8} Q${far + outerShift * .25} ${y - 12} ${far + outerShift} ${y + 5} L${near} ${y + h * .18} L${near - notch} ${innerMid} L${near} ${y + h * .82} L${far + outerShift * .7} ${y + h - 3} Q${far - 16} ${y + h + 12} ${far} ${y + h - 8} Z`;
  }
  return `M${far} ${y + 8} Q${far + outerShift * .25} ${y - 12} ${far + outerShift} ${y + 5} L${near} ${y + h * .18} L${near + notch} ${innerMid} L${near} ${y + h * .82} L${far + outerShift * .7} ${y + h - 3} Q${far + 16} ${y + h + 12} ${far} ${y + h - 8} Z`;
}

function renderMarkers() {
  markerLayer.replaceChildren();
  const events = state.memory.slice(-4);
  events.forEach((event, index) => {
    const zone = state.zones[event.receiverIndex];
    const x = zone.side === 'left' ? 225 + index * 16 : 775 - index * 16;
    const y = zone.y * 720 + 18;
    const marker = document.createElementNS(SVG_NS, 'circle');
    marker.setAttribute('cx', String(x));
    marker.setAttribute('cy', String(y));
    marker.setAttribute('r', String(2 + index * .8));
    marker.setAttribute('class', 'event-marker');
    markerLayer.append(marker);
  });
}

setup();
