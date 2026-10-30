import {
  GRID_SIZE,
  buildBoard,
  buildTimeline,
  geometrySignature,
  offerWitness,
  developNegative,
  liftLatest,
  releaseNegative
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = staticMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let board;
let boardNode;
let gridNode;
let stageNode;
let memoryNode;
let stateNode;
let hintNode;
let interactionNode;
let cursor = { row: 5, col: 5 };

function setup() {
  boardNode = document.querySelector('[data-negative-board]');
  gridNode = document.querySelector('[data-witness-grid]');
  stageNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  interactionNode = document.querySelector('[data-interaction-state]');
  board = staticMode ? buildTimeline().at(-1) : buildBoard();
  bindControls();
  render('quiet');
  window.__mutinePortraitV037 = {
    getState: () => structuredClone(board),
    offer: (row, col, pressure = 0.72) => offerAt(row, col, pressure),
    develop: () => developRevision(),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    geometrySignature: () => geometrySignature(board)
  };
  window.dispatchEvent(new CustomEvent('mutine:ready', { detail: 'portrait-v037' }));
}

function bindControls() {
  boardNode.addEventListener('keydown', handleKeydown);
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'develop') developRevision();
      if (button.dataset.action === 'lift') liftRevision();
      if (button.dataset.action === 'release') releaseRevision();
    });
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function offerAt(row, col, pressure = 0.72) {
  if (staticMode) return board;
  cursor = { row: clamp(Math.floor(row), 0, GRID_SIZE - 1), col: clamp(Math.floor(col), 0, GRID_SIZE - 1) };
  board = offerWitness(board, { row: cursor.row, col: cursor.col, pressure });
  boardNode.focus({ preventScroll: true });
  render('witnessed');
  return board;
}

function developRevision() {
  if (staticMode) return { accepted: false, board };
  if (!board.lastOffer) offerAt(cursor.row, cursor.col, 0.62);
  const result = developNegative(board);
  board = result.board;
  render(result.accepted ? 'developed' : 'quiet');
  return result;
}

function liftRevision() {
  if (staticMode) return board;
  board = liftLatest(board);
  render('lifted');
  return board;
}

function releaseRevision() {
  if (staticMode) return board;
  board = releaseNegative();
  cursor = { row: 5, col: 5 };
  render('released');
  return board;
}

function moveCursor(rowDelta, colDelta) {
  cursor = {
    row: clamp(cursor.row + rowDelta, 0, GRID_SIZE - 1),
    col: clamp(cursor.col + colDelta, 0, GRID_SIZE - 1)
  };
  offerAt(cursor.row, cursor.col, 0.56);
}

function handleKeydown(event) {
  if (staticMode) return;
  if (event.key === 'ArrowUp') { event.preventDefault(); moveCursor(-1, 0); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); moveCursor(0, 1); }
  else if (event.key === 'ArrowDown') { event.preventDefault(); moveCursor(1, 0); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); moveCursor(0, -1); }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); developRevision(); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); liftRevision(); }
  else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') { event.preventDefault(); releaseRevision(); }
}

function cellLabel(cell) {
  if (cell.state === 'developed') return `tile ${cell.row + 1}, ${cell.col + 1}: developed remote tile`;
  if (cell.state === 'erased') return `tile ${cell.row + 1}, ${cell.col + 1}: erased remote tile`;
  if (cell.state === 'registered') return `tile ${cell.row + 1}, ${cell.col + 1}: registered remote trace`;
  return `tile ${cell.row + 1}, ${cell.col + 1}: choose as witness`;
}

function render(stage) {
  gridNode.replaceChildren();
  const witnessIndex = board.lastOffer?.index;
  board.cells.forEach((cell) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'negative-cell';
    button.dataset.state = cell.state;
    button.dataset.tone = cell.tone;
    button.dataset.witness = String(cell.index === witnessIndex);
    button.setAttribute('aria-label', cellLabel(cell));
    button.setAttribute('aria-pressed', String(cell.index === witnessIndex));
    button.style.setProperty('--mass', String(cell.mass));
    button.style.setProperty('--scale', String(cell.scale));
    button.style.setProperty('--offset', `${cell.offset * 100}px`);
    button.style.setProperty('--cut', `${cell.cut * 100}%`);
    button.addEventListener('click', () => offerAt(cell.row, cell.col, 0.72));
    gridNode.append(button);
  });

  const stateText = {
    quiet: 'the plate is waiting for a witness',
    witnessed: 'witness loaded; geometry remains exact',
    developed: 'three remote tiles have answered',
    lifted: 'last development lifted exactly',
    released: 'the plate is quiet again'
  }[stage] ?? 'the plate is waiting for a witness';
  stageNode.textContent = `${stage} negative / ${String(board.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${board.memory.length} development${board.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = stateText;
  interactionNode.textContent = stateText;
  hintNode.textContent = board.lastOffer ? 'press Enter / Space · develop elsewhere' : 'choose a witness · develop elsewhere';
}

setup();
