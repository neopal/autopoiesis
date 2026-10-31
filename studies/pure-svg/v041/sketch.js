import {
  MEMORY_WINDOW,
  NODE_COUNT,
  armNode,
  buildFrame,
  buildTimeline,
  commitRoute,
  geometrySignature,
  liftLatestRoute,
  releaseRegister
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const verdictControl = document.querySelector('#verdict-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_ROUTES = [[0, 1, 4], [2, 3, 5], [6, 7, 8], [4, 5, 1]];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)))
  };
}

function nearestNode(point) {
  let candidate = null;
  let distance = Infinity;
  frame.nodes.forEach((node) => {
    const next = Math.hypot(point.x - node.x, point.y - node.y);
    if (next < distance) {
      candidate = node.id;
      distance = next;
    }
  });
  return distance < 0.105 ? candidate : null;
}

function stateLabel(current) {
  if (current.interaction === 'route-armed') return `ROUTE ${current.selection.length} / HINGES STAY EXACT`;
  if (current.interaction === 'route-ready') return 'ROUTE READY / THREE JOINTS HELD';
  if (current.interaction === 'route-committed') return 'VERDICT STORED / THE ROUTE WAS NOT THE ANSWER';
  if (current.interaction === 'route-refused-incomplete') return 'INCOMPLETE ROUTE / THREE HINGES REQUIRED';
  if (current.interaction === 'route-refused-memory-full') return 'FOUR VERDICTS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'route-lifted') return 'LATEST VERDICT LIFTED / PRIOR REGISTER RESTORED';
  if (current.interaction === 'released') return 'REGISTER RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function markerMarkup(current) {
  if (blind || staticMode) return '';
  return `<g class="field-markers" aria-hidden="true">${current.nodes.map((node) => {
    const selected = current.selection.includes(node.id);
    return `<circle class="field-marker${selected ? ' is-selected' : ''}" cx="${fixed(node.x * 1000)}" cy="${fixed(node.y * 760)}" r="${selected ? 34 : 27}" data-node-marker="${node.id}"/>`;
  }).join('')}</g>`;
}

function roleLabel(node) {
  if (node.role === 'turn') return 'turn';
  if (node.role === 'pin') return 'pin';
  if (node.role === 'register') return 'register';
  return 'quiet';
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels" aria-hidden="true"><text x="42" y="52">${stateLabel(current)}</text><text x="958" y="710" text-anchor="end">HINGE REGISTER / ${current.memory.length} VERDICTS / ${current.event?.committed ? 'REMOTE' : 'QUIET'}</text></g>`;
  const nodes = current.nodes.map((node) => `<g class="hinge-group" data-node-group="${node.id}">
    <path class="hinge-shadow" d="${node.signature}" data-shadow-node="${node.id}"/>
    <path class="hinge hinge-${roleLabel(node)}" data-node="${node.id}" data-role="${roleLabel(node)}" d="${node.signature}" aria-label="hinge ${node.id + 1}"/>
    <path class="hinge-edge" d="${node.signature}" data-edge-node="${node.id}"/>
  </g>`).join('');
  field.innerHTML = `<defs>
    <linearGradient id="field-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a2b34"/><stop offset=".46" stop-color="#101a23"/><stop offset="1" stop-color="#080d13"/></linearGradient>
    <linearGradient id="hinge-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0ead2"/><stop offset=".38" stop-color="#c9d9ca"/><stop offset=".7" stop-color="#a3c8c8"/><stop offset="1" stop-color="#e5a075"/></linearGradient>
    <linearGradient id="hinge-turn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3ffab"/><stop offset="1" stop-color="#a6d45f"/></linearGradient>
    <linearGradient id="hinge-pin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd2aa"/><stop offset="1" stop-color="#dc7c61"/></linearGradient>
    <linearGradient id="hinge-register" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cbf5e8"/><stop offset="1" stop-color="#70afb9"/></linearGradient>
    <radialGradient id="field-vignette" cx="50%" cy="45%" r="74%"><stop offset="0" stop-color="#8cc8c6" stop-opacity=".11"/><stop offset=".66" stop-color="#20343d" stop-opacity=".03"/><stop offset="1" stop-color="#020407" stop-opacity="0"/></radialGradient>
    <filter id="hinge-shadow" x="-20%" y="-20%" width="145%" height="160%"><feGaussianBlur stdDeviation="13"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="760"/>
  <path class="field-channel" d="M96 626 C226 502 308 542 416 436 S640 220 901 126"/>
  <path class="field-vignette" d="M0 0H1000V760H0Z"/>
  ${nodes}
  ${markerMarkup(current)}
  ${labels}`;

  if (current.interaction === 'route-committed') stageReadout.textContent = 'verdict stored · three remote hinges changed';
  else if (current.interaction === 'route-armed') stageReadout.textContent = `route ${current.selection.length}/3 held · geometry stayed exact`;
  else if (current.interaction === 'route-ready') stageReadout.textContent = 'three hinges held · commit the verdict';
  else if (current.interaction === 'route-refused-incomplete') stageReadout.textContent = 'incomplete route · choose three hinges';
  else if (current.interaction === 'route-refused-memory-full') stageReadout.textContent = 'four verdicts retained · lift or release';
  else if (current.interaction === 'route-lifted') stageReadout.textContent = 'latest verdict lifted · prior register restored';
  else if (current.interaction === 'released') stageReadout.textContent = 'register released · seed restored';
  else stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;

  memoryReadout.textContent = `${current.memory.length} verdicts · ${current.event?.committed ? 'the consequence is remote' : 'the register is quiet'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.nodeCount = String(NODE_COUNT);
  field.dataset.pathCount = String(field.querySelectorAll('path[data-node]').length);
  field.dataset.selected = current.selection.join(',');
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  verdictControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  verdictControl.textContent = current.selection.length === 3 ? 'commit verdict' : 'choose three hinges';
}

function select(index) {
  if (staticMode || blind || index === null) return;
  frame = armNode(frame, index);
  notice = frame.interaction;
  render(frame);
}

function selectNext() {
  if (staticMode || blind || frame.selection.length >= 3) return;
  const route = DEFAULT_ROUTES[frame.memory.length] ?? DEFAULT_ROUTES[0];
  const index = route.find((candidate) => !frame.selection.includes(candidate));
  if (index !== undefined) select(index);
}

function selectRoute(route) {
  for (const index of route) {
    if (frame.selection.includes(index)) continue;
    frame = armNode(frame, index);
  }
  render(frame);
}

function verdict() {
  if (staticMode || blind) return;
  frame = commitRoute(frame);
  notice = frame.interaction;
  render(frame);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestRoute(frame);
  notice = 'route-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseRegister();
  notice = 'released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  const index = nearestNode(normalizedPoint(event.clientX, event.clientY));
  pointerSession = { pointerId: event.pointerId, index };
  if (index !== null) select(index);
  else {
    notice = 'route-selection-refused';
    render(frame);
  }
}, true);

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  pointerSession = null;
  render(frame);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    selectNext();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.selection.length < 3) selectRoute(DEFAULT_ROUTES[frame.memory.length] ?? DEFAULT_ROUTES[0]);
    else verdict();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

verdictControl.addEventListener('click', verdict);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
