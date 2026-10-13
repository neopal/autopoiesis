import {
  GATE_COUNT,
  MEMORY_WINDOW,
  applyReply,
  armGate,
  buildFrame,
  geometrySignature,
  liftLatestReply,
  releaseContour,
  replyPath
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const crossControl = document.querySelector('#cross-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
let frame = buildFrame(0, []);
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fixed = (value) => Number(value).toFixed(2);

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Number(clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1).toFixed(4)),
    y: Number(clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1).toFixed(4))
  };
}

function stateLabel(current) {
  if (current.interaction === 'crossing-armed') return 'CROSSING HELD / WAITING FOR A FAR REPLY';
  if (current.interaction === 'remote-reply') return 'REMOTE REPLY / THREE CAVITIES RE-FORMED';
  if (current.interaction === 'reply-refused-same-gate') return 'SAME GATE REFUSED / CROSSING REMAINS OPEN';
  if (current.interaction === 'reply-lifted') return 'LATEST REPLY LIFTED / PRIOR CONTOUR RESTORED';
  if (current.interaction === 'reply-memory-full') return 'FOUR REPLIES RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'released') return 'CONTOUR RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 12`;
}

function render(current = frame) {
  const latest = current.event?.committed ? current.event : null;
  const gates = current.gates.map((gate, index) => {
    const classes = ['gate'];
    if (current.armedGate === index) classes.push('gate--armed');
    if (latest?.source === index) classes.push('gate--source');
    if (latest?.target === index) classes.push('gate--target');
    if (latest?.relay === index) classes.push('gate--relay');
    return `<path class="gate ${classes.join(' ')}" data-gate="${index}" d="${gate.pathSignature}"/>`;
  }).join('');
  const replies = current.memory.map((event) => `<path class="reply-trace" d="${replyPath(current, event)}"/>`).join('');
  const labels = blind ? '' : `<g class="field-labels"><text x="46" y="54">${stateLabel(current)}</text><text x="954" y="628" text-anchor="end">${GATE_COUNT} CAVITIES / ${current.memory.length} REPLIES / ${latest ? `RELAY ${latest.relay + 1}` : 'NO REPLY YET'}</text></g>`;
  const armedMark = !blind && current.armedGate !== null && current.armedGate !== undefined
    ? `<circle class="armed-mark" cx="${fixed(current.gates[current.armedGate].x * 1000)}" cy="${fixed(current.gates[current.armedGate].y * 680)}" r="38"/>`
    : '';
  const latestTrace = latest ? `<path class="reply-current" d="${replyPath(current, latest)}"/>` : '';

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="48%" cy="44%" r="80%"><stop offset="0" stop-color="#273126"/><stop offset=".54" stop-color="#151c18"/><stop offset="1" stop-color="#090c0b"/></radialGradient>
    <linearGradient id="contour" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4c39b"/><stop offset=".45" stop-color="#b6c6a4"/><stop offset="1" stop-color="#cf9e78"/></linearGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".021" numOctaves="2" seed="30" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .1"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <path class="field-veil" d="M 92 354 C 204 92 728 38 904 312 C 1002 468 810 654 476 602 C 200 646 42 510 92 354 Z" filter="url(#grain)"/>
  <path class="contour-shadow" d="${current.contourPath}" transform="translate(10 13)"/>
  <path class="field-contour" d="${current.contourPath}" fill-rule="evenodd"/>
  <path class="central-glint" d="M 402 342 C 450 296 550 296 598 342 C 550 386 450 386 402 342 Z"/>
  <g class="reply-traces" aria-hidden="true">${replies}${latestTrace}</g>
  <g class="cavities">${gates}${armedMark}</g>${labels}`;

  stageReadout.textContent = current.interaction === 'crossing-armed'
    ? 'local crossing held · geometry unchanged'
    : current.interaction === 'remote-reply'
      ? 'far gate replied · three cavities re-formed'
      : current.interaction === 'reply-refused-same-gate'
        ? 'same gate refused · no geometry written'
        : current.interaction === 'reply-lifted'
          ? 'latest reply lifted · prior contour restored'
          : current.interaction === 'reply-memory-full'
            ? 'four replies retained · lift or release'
            : current.interaction === 'released'
              ? 'contour released · seed geometry restored'
              : `stage ${String(current.stage).padStart(2, '0')} / 12`;
  memoryReadout.textContent = `${current.memory.length} replies · ${latest ? `cavity ${latest.source + 1} ⇄ ${latest.target + 1} ⇢ ${latest.relay + 1}` : 'the contour is waiting'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.gateCount = String(current.gates.length);
  field.dataset.pathCount = String(current.gates.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.source = latest ? String(latest.source) : '';
  field.dataset.target = latest ? String(latest.target) : '';
  field.dataset.relay = latest ? String(latest.relay) : '';
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  crossControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  crossControl.textContent = current.armedGate === null ? 'cross a near gate' : 'let the far gate reply';
}

function arm(point) {
  if (staticMode || blind) return;
  frame = armGate(frame, point);
  notice = 'crossing-armed-no-write';
  render(frame);
}

function reply(point) {
  if (staticMode || blind) return;
  frame = applyReply(frame, point);
  notice = frame.event?.committed ? 'remote-reply' : frame.interaction;
  render(frame);
}

function cross(point = { x: 0.19, y: 0.26 }) {
  if (frame.armedGate === null || frame.armedGate === undefined) arm(point);
  else reply({ x: 0.81, y: 0.73 });
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestReply(frame);
  notice = 'latest-reply-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseContour();
  notice = 'contour-released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId };
  arm(normalizedPoint(event.clientX, event.clientY));
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  pointerSession = null;
  reply(normalizedPoint(event.clientX, event.clientY));
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    cross();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

crossControl.addEventListener('click', () => cross());
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
