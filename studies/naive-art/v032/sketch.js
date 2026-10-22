import {
  buildFrame,
  buildTimeline,
  commitPath,
  geometrySignature,
  liftLatestPath,
  releaseMemory
} from './engine.mjs';

const field = document.querySelector('#family-tree');
const edgeLayer = document.querySelector('[data-edge-layer]');
const nodeLayer = document.querySelector('[data-node-layer]');
const stageNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const statusNode = document.querySelector('[data-status]');
const timeline = buildTimeline();
const staticMode = new URLSearchParams(location.search).get('static') === '1';

let state = buildFrame();
let pendingPath = [];
let statusOverride = '';

function nodePoint(node) {
  const rect = field.getBoundingClientRect();
  return {
    x: rect.width * (0.5 + node.x * 0.42),
    y: rect.height * (0.5 + node.y * 0.77)
  };
}

function addEdge(parent, child) {
  const from = nodePoint(parent);
  const to = nodePoint(child);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const edge = document.createElement('span');
  edge.className = 'family-edge';
  edge.style.left = `${from.x}px`;
  edge.style.top = `${from.y}px`;
  edge.style.width = `${length}px`;
  edge.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  edgeLayer.append(edge);
}

function nodeLabel(node) {
  const stateName = node.state === 'quiet' ? 'quiet' : node.state.replace('-', ' ');
  return `branch witness ${node.id + 1}, ${stateName}`;
}

function chooseNode(id) {
  if (pendingPath.includes(id)) {
    statusOverride = 'that witness is already in the path';
    updateReadout();
    return;
  }
  pendingPath = [...pendingPath, id];
  statusOverride = pendingPath.length === 3
    ? 'path complete · release the wrong parent'
    : `${pendingPath.length} of 3 witnesses chosen · selection never writes`;
  render();
  if (pendingPath.length === 3) commitPendingPath();
}

function commitPendingPath() {
  if (pendingPath.length !== 3) return;
  state = commitPath(state, { path: pendingPath });
  pendingPath = [];
  statusOverride = state.interaction === 'path-committed'
    ? 'the tree learned the wrong parent'
    : 'path refused';
  render();
}

function commitNextPath() {
  const path = timeline[state.memory.length % timeline.length];
  state = commitPath(state, { path });
  pendingPath = [];
  statusOverride = 'the deterministic path changed the family';
  render();
}

function liftLatest() {
  state = liftLatestPath(state);
  pendingPath = [];
  statusOverride = 'last wrong family lifted exactly';
  render();
}

function release() {
  state = releaseMemory(state);
  pendingPath = [];
  statusOverride = 'the tree released its remembered errors';
  render();
}

function updateReadout() {
  stageNode.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryNode.textContent = `${state.memory.length} retained`;
  statusNode.textContent = statusOverride || (pendingPath.length ? `${pendingPath.length} of 3 witnesses chosen · selection never writes` : 'choose three branch witnesses · selection never writes');
}

function render() {
  edgeLayer.replaceChildren();
  nodeLayer.replaceChildren();
  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
  state.nodes.forEach((node) => {
    if (node.parent !== null && nodeById.has(node.parent)) addEdge(nodeById.get(node.parent), node);
  });
  state.nodes.forEach((node) => {
    const element = document.createElement('div');
    element.className = 'family-node';
    element.dataset.nodeId = String(node.id);
    element.dataset.state = node.state;
    element.dataset.selected = String(pendingPath.includes(node.id));
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', nodeLabel(node));
    element.style.left = `${(0.5 + node.x * 0.42) * 100}%`;
    element.style.top = `${(0.5 + node.y * 0.77) * 100}%`;
    element.style.setProperty('--lean', `${node.lean}rad`);
    const accessible = document.createElement('span');
    accessible.textContent = nodeLabel(node);
    element.append(accessible);
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      chooseNode(node.id);
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        chooseNode(node.id);
      }
    });
    nodeLayer.append(element);
  });
  updateReadout();
}

field.addEventListener('keydown', (event) => {
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    chooseNode(Number(event.key) - 1);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (pendingPath.length === 3) commitPendingPath();
    else commitNextPath();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
    return;
  }
  if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

document.querySelector('[data-action="path"]').addEventListener('click', commitNextPath);
document.querySelector('[data-action="lift"]').addEventListener('click', liftLatest);
document.querySelector('[data-action="release"]').addEventListener('click', release);
window.addEventListener('resize', render);

render();
if (staticMode) {
  for (const path of timeline) state = commitPath(state, { path });
  statusOverride = 'four wrong families retained';
  pendingPath = [];
  render();
}

window.__mutineNaiveV032 = {
  getState: () => ({ ...state, pendingPath: [...pendingPath] }),
  chooseNode,
  commitPath: (path) => { state = commitPath(state, { path }); pendingPath = []; render(); return state; },
  liftLatest,
  release,
  geometrySignature: () => geometrySignature(state)
};
