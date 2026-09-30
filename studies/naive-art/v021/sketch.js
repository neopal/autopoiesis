import {
  MAX_MEMORY,
  ROOMS,
  STAGES,
  buildFrame,
  buildTimeline,
  commitAttention,
  geometrySignature,
  liftLatestAttention,
  releaseAttention,
  roomPolygon
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3600;

const mapWrap = document.querySelector('#attention-map');
const mapField = document.querySelector('#map-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attentionControl = document.querySelector('#attention-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const roomGroups = [...document.querySelectorAll('[data-room]')];

const palette = {
  paper: '#f1e7d1',
  ink: '#27263a',
  shadow: '#82796c',
  thread: '#947f67',
  reply: '#493f58',
  void: '#c4b9a7'
};

let startedAt = performance.now();
let currentFrame = timeline[0];
let interactionFrame = null;
let armedRoom = null;

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : currentFrame);
}

function pathFromPoints(points, dx = 0, dy = 0) {
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${(point.x + dx).toFixed(2)} ${(point.y + dy).toFixed(2)}`).join(' ')} Z`;
}

function sidePath(room, side, depth = 42, spread = 0.18) {
  const x = room.x;
  const y = room.y;
  const right = room.x + room.w;
  const bottom = room.y + room.h;
  const center = {
    north: x + room.w * 0.5,
    east: y + room.h * 0.5,
    south: x + room.w * 0.5,
    west: y + room.h * 0.5
  }[side];
  if (side === 'north') return `M ${(center - room.w * spread).toFixed(2)} ${(y - 4).toFixed(2)} H ${(center + room.w * spread).toFixed(2)} V ${(y + depth).toFixed(2)} H ${(center - room.w * spread).toFixed(2)} Z`;
  if (side === 'east') return `M ${(right + 4).toFixed(2)} ${(center - room.h * spread).toFixed(2)} V ${(center + room.h * spread).toFixed(2)} H ${(right - depth).toFixed(2)} V ${(center - room.h * spread).toFixed(2)} Z`;
  if (side === 'south') return `M ${(center + room.w * spread).toFixed(2)} ${(bottom + 4).toFixed(2)} H ${(center - room.w * spread).toFixed(2)} V ${(bottom - depth).toFixed(2)} H ${(center + room.w * spread).toFixed(2)} Z`;
  return `M ${(x - 4).toFixed(2)} ${(center + room.h * spread).toFixed(2)} V ${(center - room.h * spread).toFixed(2)} H ${(x + depth).toFixed(2)} V ${(center + room.h * spread).toFixed(2)} Z`;
}

function combinedSidePaths(room, sides, depth, spread) {
  return sides.map((side) => sidePath(room, side, depth, spread)).join(' ');
}

function roomPoint(room) {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

function roomFromPointer(event) {
  const rect = mapField.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (event.clientX - rect.left) / rect.width * 1000;
  const y = (event.clientY - rect.top) / rect.height * 780;
  let nearest = null;
  let nearestDistance = Infinity;
  ROOMS.forEach((room, index) => {
    const point = roomPoint(room);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearestDistance < 220 ? nearest : null;
}

function setArmedRoom(roomIndex) {
  armedRoom = Number.isInteger(roomIndex) ? roomIndex : null;
  mapWrap.dataset.armedRoom = armedRoom === null ? '' : ROOMS[armedRoom].id;
  roomGroups.forEach((group, index) => group.classList.toggle('is-armed', index === armedRoom));
}

function renderFrame(frame) {
  const scene = frame.scene;
  stageReadout.textContent = `stage ${String(frame.stage).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} room${frame.memory.length === 1 ? '' : 's'} remembering`;
  mapWrap.dataset.stage = String(frame.stage);
  mapWrap.dataset.memory = String(frame.memory.length);
  mapField.dataset.geometrySignature = geometrySignature(frame);

  scene.rooms.forEach((room, index) => {
    const group = roomGroups[index];
    if (!group) return;
    const points = roomPolygon(room);
    const openingSides = room.openings.map((entry) => entry.side);
    const closureSides = room.closures.map((entry) => entry.side);
    const shadow = group.querySelector('.room-shadow');
    const fill = group.querySelector('.room-fill');
    const opening = group.querySelector('.room-opening');
    const closure = group.querySelector('.room-closure');
    const mark = group.querySelector('.room-mark');
    const fillPath = pathFromPoints(points);
    shadow.setAttribute('d', pathFromPoints(points, 8, 11));
    fill.setAttribute('d', fillPath);
    fill.style.setProperty('--room-color', room.color);
    opening.setAttribute('d', combinedSidePaths(room, openingSides, 44, 0.18));
    closure.setAttribute('d', combinedSidePaths(room, closureSides, 38, 0.14));
    const markPoint = points[(index + frame.stage) % points.length];
    mark.setAttribute('d', `M ${(markPoint.x - 12).toFixed(2)} ${(markPoint.y + 4).toFixed(2)} l 24 -8 M ${(markPoint.x - 4).toFixed(2)} ${(markPoint.y + 10).toFixed(2)} l 18 -6`);
    group.dataset.openings = openingSides.join('|');
    group.dataset.closures = closureSides.join('|');
    group.dataset.attention = String(room.attention);
    group.classList.toggle('has-opening', openingSides.length > 0);
    group.classList.toggle('has-closure', closureSides.length > 0);
    group.classList.toggle('is-replied', room.replies > 0);
  });
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.memory.length,
    engineMemory: frame.memory.length,
    armedRoom,
    openings: frame.scene.rooms.filter((room) => room.openings.length).length,
    closures: frame.scene.rooms.filter((room) => room.closures.length).length,
    topologyChanges: frame.scene.trace.topologyChanges,
    pointerOnlyChanges: frame.scene.trace.pointerOnlyChanges,
    interaction: interactionFrame?.interaction ?? 'sequence',
    geometrySignature: geometrySignature(frame)
  };
}

window.__mutineNaiveV021 = { getState: stateSnapshot };
mapWrap.dataset.witness = 'wrong-room';

if (staticPreview) {
  mapWrap.tabIndex = -1;
  mapWrap.removeAttribute('aria-keyshortcuts');
}
if (blindMode) mapField.setAttribute('aria-label', 'A field of irregular rooms with remembered openings and wrong closures');

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function commit(roomIndex = armedRoom) {
  const selected = Number.isInteger(roomIndex) ? roomIndex : null;
  interactionFrame = commitAttention(activeFrame(), { roomIndex: selected });
  renderFrame(interactionFrame);
  setArmedRoom(selected);
}

function undo() {
  interactionFrame = liftLatestAttention(activeFrame());
  renderFrame(interactionFrame);
}

function release() {
  interactionFrame = releaseAttention();
  currentFrame = timeline[0];
  startedAt = performance.now();
  setArmedRoom(null);
  renderFrame(interactionFrame);
}

function saveSvg() {
  const serialized = new XMLSerializer().serializeToString(mapField);
  const blob = new Blob([serialized], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-naive-v021-wrong-room.svg';
  link.click();
  URL.revokeObjectURL(link.href);
}

mapField.addEventListener('pointermove', (event) => {
  const roomIndex = roomFromPointer(event);
  if (roomIndex !== armedRoom) setArmedRoom(roomIndex);
});
mapField.addEventListener('pointerleave', () => setArmedRoom(null));
mapField.addEventListener('click', (event) => {
  const room = event.target.closest('[data-room]');
  if (room) commit(roomGroups.indexOf(room));
});
mapWrap.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    undo();
  } else if (event.key.toLowerCase() === 'r') {
    release();
  } else if (event.key.toLowerCase() === 's') {
    saveSvg();
  }
});
attentionControl.addEventListener('click', () => commit());
undoControl.addEventListener('click', undo);
releaseControl.addEventListener('click', release);

function tick(now) {
  if (!interactionFrame && !frozen) {
    currentFrame = frameAt(now);
    renderFrame(currentFrame);
  }
  requestAnimationFrame(tick);
}

renderFrame(activeFrame());
requestAnimationFrame(tick);
