import {
  PANEL_COUNT,
  commitAttention,
  liftLatest,
  previewAttention,
  release
} from './engine.mjs';

const field = document.querySelector('#fugue-field');
const panelLayer = document.querySelector('#panel-layer');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateText = document.querySelector('#interaction-state');
const interactionState = document.querySelector('[data-interaction-state]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const PANEL_TEXT = [
  ['a', 'sentence'], ['learns', 'to'], ['wait'], ['at', 'the edge'], ['of', 'another'],
  ['line'], ['without'], ['looking'], ['back']
];
let frame = release();
let dwellTimer = null;
let hoveredPanel = null;
let keyboardCursor = 0;

function panelFromEvent(event) {
  const target = event.target.closest?.('[data-panel-id]');
  return target ? Number(target.dataset.panelId) : null;
}

function makePanel(panel) {
  const node = document.createElement('div');
  node.className = `text-panel text-panel--${panel.writing} text-panel--${panel.role}`;
  node.dataset.panelId = panel.id;
  node.dataset.panelLabel = `voice ${String(panel.id + 1).padStart(2, '0')}`;
  node.dataset.order = panel.order;
  node.style.setProperty('--x', panel.x);
  node.style.setProperty('--y', panel.y);
  node.style.setProperty('--width', panel.width);
  node.style.setProperty('--height', panel.height);
  node.style.setProperty('--angle', panel.angle);
  node.style.setProperty('--scale', panel.scale);
  node.style.setProperty('--leading', panel.leading);
  node.style.setProperty('--tracking', `${panel.tracking}em`);
  const tokens = document.createElement('div');
  tokens.className = 'panel-tokens';
  for (const token of PANEL_TEXT[panel.id]) {
    const span = document.createElement('span');
    span.className = 'panel-token';
    span.textContent = token;
    tokens.append(span);
  }
  node.append(tokens);
  if (frame.pending.includes(panel.id)) node.classList.add('is-pending');
  if (frame.changedPanelIds.includes(panel.id)) node.classList.add('is-changed');
  return node;
}

function render() {
  panelLayer.replaceChildren(...frame.field.panels.map(makePanel));
  const count = frame.memory.length;
  stage.textContent = frame.pending.length ? 'attention held / listening' : frame.lastEvent;
  memoryReadout.textContent = `${count} replies · ${PANEL_COUNT} panels`;
  const accessible = frame.pending.length
    ? `Voice ${frame.pending[0] + 1} is being attended. Hold or commit to let another room answer.`
    : count ? `${count} remote layout replies remain.` : 'The room is quiet. Nine voices are holding.';
  stateText.textContent = accessible;
  interactionState.textContent = accessible;
}

function clearDwell() {
  if (dwellTimer !== null) window.clearTimeout(dwellTimer);
  dwellTimer = null;
}

function holdAttention(panelId, immediate = false) {
  if (!Number.isInteger(panelId) || panelId < 0 || panelId >= PANEL_COUNT) return;
  clearDwell();
  hoveredPanel = panelId;
  frame = previewAttention(frame, panelId);
  render();
  if (immediate) {
    frame = commitAttention(frame);
    render();
    return;
  }
  dwellTimer = window.setTimeout(() => {
    if (hoveredPanel === panelId && frame.pending[0] === panelId) {
      frame = commitAttention(frame);
      render();
    }
  }, 520);
}

function releaseAttention() {
  clearDwell();
  hoveredPanel = null;
  if (frame.pending.length) {
    frame = { ...frame, pending: [], changedPanelIds: [], lastEvent: 'attention released' };
    render();
  }
}

function attendDeterministic() {
  holdAttention(4, true);
}

function handleAction(action) {
  if (action === 'attend') attendDeterministic();
  if (action === 'lift') { frame = liftLatest(frame); render(); }
  if (action === 'release') { frame = release(); releaseAttention(); render(); }
}

field.addEventListener('pointermove', (event) => {
  const panelId = panelFromEvent(event);
  if (panelId === null) return;
  if (event.pointerType === 'touch') return;
  if (panelId !== hoveredPanel || !frame.pending.length) holdAttention(panelId);
});
field.addEventListener('pointerdown', (event) => {
  const panelId = panelFromEvent(event);
  if (panelId === null) return;
  if (event.pointerType === 'touch') holdAttention(panelId, true);
  else holdAttention(panelId);
});
field.addEventListener('pointerleave', releaseAttention);
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardCursor = (keyboardCursor + 1) % PANEL_COUNT;
    holdAttention(keyboardCursor);
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending.length) {
      clearDwell();
      frame = commitAttention(frame);
      render();
    } else attendDeterministic();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); frame = liftLatest(frame); render(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); frame = release(); releaseAttention(); render(); }
});
for (const button of actionButtons) button.addEventListener('click', () => handleAction(button.dataset.action));

render();
window.__mutineHandwritingV043 = {
  getState: () => frame,
  attendDeterministic,
  focusPanel: (id) => holdAttention(Number(id), true),
  lift: () => { frame = liftLatest(frame); render(); },
  release: () => { frame = release(); render(); }
};
window._mutineReady = true;
