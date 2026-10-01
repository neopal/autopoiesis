import {
  MEMORY_WINDOW,
  SLOTS,
  STAGES,
  buildFrame,
  buildTimeline,
  commitMisread,
  geometrySignature,
  liftLatestMisread,
  releaseMisread
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3300;

const field = document.querySelector('#misfile-field');
const body = document.querySelector('#ledger-body');
const pieceLayer = document.querySelector('.piece-layer');
const pieces = [...document.querySelectorAll('.piece')];
const slots = [...document.querySelectorAll('.slot')];
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const misfileControl = document.querySelector('#misfile-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');

let startedAt = performance.now();
let currentFrame = timeline[0];
let interactionFrame = null;
let armedSource = null;
let armedTarget = null;
let drag = null;

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : currentFrame);
}

function setSlotGeometry(slot, index) {
  const data = SLOTS[index];
  slot.style.setProperty('--slot-x', data.x);
  slot.style.setProperty('--slot-y', data.y);
  slot.style.setProperty('--slot-w', data.w);
  slot.style.setProperty('--slot-h', data.h);
  slot.style.setProperty('--slot-tilt', `${(index % 2 ? -1 : 1) * (index % 3 + 1) * 1.1}deg`);
}

function setArmedSource(index) {
  armedSource = Number.isInteger(index) ? index : null;
  field.dataset.armedSource = armedSource === null ? '' : String(armedSource);
  pieces.forEach((piece) => piece.classList.toggle('is-armed', piece.dataset.slotIndex === String(armedSource)));
}

function setArmedTarget(index) {
  armedTarget = Number.isInteger(index) ? index : null;
  field.dataset.armedTarget = armedTarget === null ? '' : String(armedTarget);
  slots.forEach((slot, slotIndex) => slot.classList.toggle('is-target', slotIndex === armedTarget));
}

function pieceSourceIndex(pieceId, frame) {
  return frame.scene.pieces.find((piece) => piece.id === pieceId)?.slotIndex ?? null;
}

function positionPiece(element, model) {
  const slot = model.slotIndex === null ? null : SLOTS[model.slotIndex];
  const isRail = model.railIndex !== null;
  const x = isRail ? 0.11 + model.railIndex * 0.19 : slot.x;
  const y = isRail ? 0.802 + (model.railIndex % 2) * 0.008 : slot.y;
  const w = isRail ? 0.145 : slot.w;
  const h = isRail ? 0.085 : slot.h;
  const tilt = isRail ? -8 + model.railIndex * 5 : model.tilt;
  element.style.setProperty('--piece-x', x);
  element.style.setProperty('--piece-y', y);
  element.style.setProperty('--piece-w', w);
  element.style.setProperty('--piece-h', h);
  element.style.setProperty('--piece-tone', model.tone);
  element.style.setProperty('--piece-tilt', `${tilt}deg`);
  element.style.setProperty('--piece-scale', isRail ? '.92' : '1');
  element.dataset.slotIndex = model.slotIndex === null ? '' : String(model.slotIndex);
  element.dataset.railIndex = model.railIndex === null ? '' : String(model.railIndex);
  element.classList.toggle('is-rail', isRail);
  element.classList.toggle('is-misfiled', model.slotIndex !== null && model.slotIndex !== Number(element.dataset.originalSlot));
}

function renderFrame(frame) {
  const scene = frame.scene;
  stageReadout.textContent = `stage ${String(frame.stage).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} misfile${frame.memory.length === 1 ? '' : 's'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.vacancies = String(scene.trace.vacancyCount);
  field.dataset.railCount = String(scene.trace.railCount);
  field.dataset.geometrySignature = geometrySignature(frame);

  slots.forEach((slot, index) => {
    setSlotGeometry(slot, index);
    const empty = scene.slots[index] === null;
    slot.classList.toggle('is-empty', empty);
    slot.dataset.occupant = scene.slots[index] ?? '';
  });
  scene.pieces.forEach((model) => {
    const element = pieces.find((candidate) => candidate.dataset.piece === model.id);
    if (element) positionPiece(element, model);
  });
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.memory.length,
    memoryWindow: MEMORY_WINDOW,
    vacancies: frame.scene.trace.vacancyCount,
    railCount: frame.scene.trace.railCount,
    layoutChanges: frame.scene.trace.layoutChanges,
    pointerOnlyChanges: frame.scene.trace.pointerOnlyChanges,
    armedSource,
    armedTarget,
    interaction: interactionFrame?.interaction ?? 'sequence',
    geometrySignature: geometrySignature(frame)
  };
}

window.__mutineNaiveV022 = { getState: stateSnapshot };
field.dataset.witness = 'wrong-slot';

if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}
if (blindMode) body.setAttribute('aria-label', 'A cut-paper picture with a vacant slot and a wrongly filed margin');

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function commit(sourceIndex = armedSource, targetIndex = armedTarget) {
  interactionFrame = commitMisread(activeFrame(), { sourceIndex, targetIndex });
  renderFrame(interactionFrame);
  setArmedSource(null);
  setArmedTarget(null);
}

function refuse(reason = 'drag-refused') {
  interactionFrame = { ...activeFrame(), interaction: reason };
  renderFrame(interactionFrame);
}

function undo() {
  interactionFrame = liftLatestMisread(activeFrame());
  renderFrame(interactionFrame);
  setArmedSource(null);
  setArmedTarget(null);
}

function release() {
  interactionFrame = releaseMisread();
  currentFrame = timeline[0];
  startedAt = performance.now();
  setArmedSource(null);
  setArmedTarget(null);
  renderFrame(interactionFrame);
}

function saveSnapshot() {
  const blob = new Blob([JSON.stringify(stateSnapshot(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-naive-v022-wrong-slot.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function slotFromPointer(event) {
  const rect = body.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  let best = null;
  let bestDistance = Infinity;
  SLOTS.forEach((slot, index) => {
    const dx = x - (slot.x + slot.w / 2);
    const dy = y - (slot.y + slot.h / 2);
    const distance = Math.hypot(dx / slot.w, dy / slot.h);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return bestDistance < 1.35 ? best : null;
}

function pointerDistance(event) {
  return Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
}

function updateDrag(event) {
  if (!drag) return;
  const target = slotFromPointer(event);
  setArmedTarget(target);
  const rect = body.getBoundingClientRect();
  const dx = (event.clientX - drag.startX) / rect.width * 100;
  const dy = (event.clientY - drag.startY) / rect.height * 100;
  drag.element.style.setProperty('--drag-x', `${dx}%`);
  drag.element.style.setProperty('--drag-y', `${dy}%`);
}

function finishDrag(event) {
  if (!drag) return;
  const finished = drag;
  const travelled = pointerDistance(event);
  drag.element.classList.remove('is-dragging');
  drag.element.style.removeProperty('--drag-x');
  drag.element.style.removeProperty('--drag-y');
  drag = null;
  const target = slotFromPointer(event);
  setArmedTarget(null);
  if (travelled >= 28 && target !== null && target !== finished.sourceIndex) {
    commit(finished.sourceIndex, target);
  } else {
    refuse('drag-refused');
    setArmedSource(null);
  }
}

pieces.forEach((element) => {
  element.dataset.originalSlot = String(pieces.indexOf(element));
  element.addEventListener('pointerdown', (event) => {
    const frame = activeFrame();
    const sourceIndex = pieceSourceIndex(element.dataset.piece, frame);
    if (!Number.isInteger(sourceIndex)) return;
    drag = { element, sourceIndex, startX: event.clientX, startY: event.clientY };
    field.focus({ preventScroll: true });
    element.classList.add('is-dragging');
    setArmedSource(sourceIndex);
    element.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  element.addEventListener('pointermove', updateDrag);
  element.addEventListener('pointerup', finishDrag);
  element.addEventListener('pointercancel', (event) => finishDrag(event));
});

field.addEventListener('pointermove', (event) => {
  if (drag) return;
  const target = slotFromPointer(event);
  setArmedTarget(target);
});
field.addEventListener('pointerleave', () => { if (!drag) setArmedTarget(null); });
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(armedSource, armedTarget);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    undo();
  } else if (event.key.toLowerCase() === 'r') {
    release();
  } else if (event.key.toLowerCase() === 's') {
    saveSnapshot();
  }
});
misfileControl.addEventListener('click', () => commit());
undoControl.addEventListener('click', undo);
releaseControl.addEventListener('click', release);

function animate(now) {
  if (!frozen && !interactionFrame) {
    currentFrame = frameAt(now);
    renderFrame(currentFrame);
  }
  requestAnimationFrame(animate);
}

renderFrame(activeFrame());
requestAnimationFrame(animate);
