import {
  NODE_COUNT,
  buildFrame,
  buildTimeline,
  geometrySignature,
  observeField,
  auditVoid,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = staticMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SIGNAL_NAMES = ['north-east', 'east-south', 'south-west', 'west-north'];

let stage;
let nodeMount;
let statusNode;
let stageNode;
let memoryNode;
let stateNode;
let hintNode;
let state;
let selectedNode = 0;

function setup() {
  stage = document.querySelector('[data-attention-orbit]');
  nodeMount = document.querySelector('.orbit-nodes');
  statusNode = document.querySelector('[data-interaction-state]');
  stageNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  state = staticMode ? buildTimeline().at(-1) : buildFrame();
  bindControls();
  render('waiting');
  window.__mutinePortraitV035 = {
    getState: () => structuredClone(state),
    observe: (node, amount = .22) => observeNode(Number(node), amount),
    audit: () => auditRevision(),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    geometrySignature: () => geometrySignature(state)
  };
}

function bindControls() {
  stage.addEventListener('pointermove', handlePointerMove, { passive: true });
  stage.addEventListener('keydown', handleKeydown);
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'audit') auditRevision();
      if (action === 'lift') liftRevision();
      if (action === 'release') releaseRevision();
    });
  });
}

function handlePointerMove(event) {
  if (staticMode) return;
  const rect = stage.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width * .5);
  const y = event.clientY - (rect.top + rect.height * .5);
  const distance = Math.hypot(x / Math.max(1, rect.width), y / Math.max(1, rect.height));
  if (distance < .12) return;
  const angle = Math.atan2(y, x);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  selectedNode = Math.floor((normalized / (Math.PI * 2)) * NODE_COUNT) % NODE_COUNT;
  observeNode(selectedNode, .012);
}

function observeNode(node, amount = .22) {
  if (!Number.isInteger(node) || node < 0 || node >= NODE_COUNT) return state;
  state = observeField(state, { node, amount });
  render('observing');
  return state;
}

function auditRevision() {
  if (staticMode) return state;
  const result = auditVoid(state);
  state = result.frame;
  render('audited');
  return result;
}

function liftRevision() {
  state = liftLatest(state);
  render('lifted');
  return state;
}

function releaseRevision() {
  state = releaseField();
  render('released');
  return state;
}

function handleKeydown(event) {
  const directions = { ArrowUp: 0, ArrowRight: 3, ArrowDown: 6, ArrowLeft: 9 };
  if (Object.hasOwn(directions, event.key)) {
    event.preventDefault();
    selectedNode = directions[event.key];
    observeNode(selectedNode, .22);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    auditRevision();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftRevision();
  } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
    event.preventDefault();
    releaseRevision();
  }
}

function render(reason) {
  const nodes = Array.from(nodeMount.children);
  while (nodes.length < NODE_COUNT) {
    const node = document.createElement('div');
    node.className = 'orbit-node';
    node.setAttribute('aria-hidden', 'true');
    nodeMount.append(node);
    nodes.push(node);
  }
  state.nodes.forEach((data, index) => {
    const node = nodes[index];
    node.className = `orbit-node is-${data.state}`;
    node.style.setProperty('--node-angle', `${data.angle}rad`);
    node.style.setProperty('--node-distance', `${data.radius * Math.min(stage.clientWidth, stage.clientHeight) * .33}px`);
    node.style.setProperty('--node-width', `${32 + data.width * 74}px`);
    node.style.setProperty('--node-height', `${92 + data.depth * 210}px`);
    node.style.setProperty('--node-skew', `${data.skew}rad`);
    node.dataset.attention = state.attention[index] > .42 ? 'high' : 'quiet';
    node.style.zIndex = String(Math.round(data.depth * 10));
  });
  const pending = state.lastObserved === null ? 'no witness' : `witness ${SIGNAL_NAMES[state.lastObserved % SIGNAL_NAMES.length]}`;
  stageNode.textContent = `${state.revision ? 'audit orbit' : 'quiet orbit'} / ${String(state.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${state.memory.length} audit${state.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = state.memory.length ? `the portrait has redistributed attention · ${pending}` : 'the portrait is not looking yet';
  hintNode.textContent = state.lastObserved === null ? 'move through the rim · audit the empty centre' : 'the ledger is loaded · audit the empty centre';
  statusNode.textContent = humanState(reason);
}

function humanState(reason) {
  const labels = {
    waiting: 'The orbit is waiting for a first witness.',
    observing: 'Proximity was recorded without deforming the rim.',
    audited: 'The empty centre made three remote decisions.',
    lifted: 'The latest audit was lifted from the orbit.',
    released: 'The attention ledger returned to its quiet seed.'
  };
  return labels[reason] || labels.waiting;
}

window.addEventListener('resize', () => render('waiting'));
window.addEventListener('DOMContentLoaded', setup);
