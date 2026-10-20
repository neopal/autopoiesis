import {
  FACET_COUNT,
  MEMORY_WINDOW,
  applyLoop,
  buildFrame,
  buildTimeline,
  facetPoint,
  geometrySignature,
  liftLatestLoop,
  releaseConstellation
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const loopControl = document.querySelector('#loop-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_LOOPS = [
  [{ x: 0.25, y: 0.25 }, { x: 0.7, y: 0.27 }, { x: 0.7, y: 0.68 }, { x: 0.25, y: 0.68 }, { x: 0.25, y: 0.25 }],
  [{ x: 0.72, y: 0.22 }, { x: 0.82, y: 0.44 }, { x: 0.64, y: 0.62 }, { x: 0.56, y: 0.38 }, { x: 0.72, y: 0.22 }],
  [{ x: 0.18, y: 0.5 }, { x: 0.38, y: 0.26 }, { x: 0.54, y: 0.54 }, { x: 0.32, y: 0.76 }, { x: 0.18, y: 0.5 }]
];
let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame(0, []);
let pointerSession = null;
let trace = [];
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
  if (current.interaction === 'loop-enclosed') return 'ENCLOSED / FIVE FACETS ANSWER';
  if (current.interaction === 'loop-refused-short') return 'SHORT OFFER REFUSED / ROOM UNCHANGED';
  if (current.interaction === 'loop-refused-open') return 'OPEN OFFER REFUSED / CLOSE THE ROOM';
  if (current.interaction === 'loop-refused-thin') return 'THIN OFFER REFUSED / ENCLOSE A FIELD';
  if (current.interaction === 'loop-memory-full') return 'THREE ENCLOSURES RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'loop-lifted') return 'LATEST ENCLOSURE LIFTED / PRIOR ROOM RESTORED';
  if (current.interaction === 'released') return 'CONSTELLATION RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 12`;
}

function render(current = frame) {
  const latest = current.event?.committed ? current.event : null;
  const remembered = new Set(current.memory.flatMap((event) => [...event.affected, event.silent]));
  const facets = current.facets.map((facet, index) => {
    const classes = ['facet'];
    if (latest?.pivot === index) classes.push('facet--pivot');
    if (latest?.affected?.includes(index)) classes.push('facet--answer');
    if (latest?.silent === index) classes.push('facet--silent');
    if (remembered.has(index)) classes.push('facet--remembered');
    const hue = (index * 29 + 24) % 360;
    return `<path class="${classes.join(' ')}" data-facet="${index}" d="${facet.pathSignature}" style="--facet-hue:${hue}"/>`;
  }).join('');
  const traceMarkup = !blind && trace.length > 1
    ? `<path class="gesture-trace" d="${trace.map((point, index) => `${index ? 'L' : 'M'}${fixed(point.x * 1000)} ${fixed(point.y * 680)}`).join(' ')}"/><circle class="gesture-start" cx="${fixed(trace[0].x * 1000)}" cy="${fixed(trace[0].y * 680)}" r="8"/>`
    : '';
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="52">${stateLabel(current)}</text><text x="958" y="628" text-anchor="end">${FACET_COUNT} FACETS / ${current.memory.length} ENCLOSURES / ${latest ? latest.winding.toUpperCase() : 'WAITING'}</text></g>`;
  const memoryMarks = blind ? '' : current.memory.map((event, memoryIndex) => `<path class="memory-mark" d="M ${100 + memoryIndex * 26} 600 l 14 -10 l 14 10" opacity="${0.28 + memoryIndex * 0.14}"/>`).join('');
  const center = latest ? facetPoint(current, latest.silent) : { x: 0.5, y: 0.5 };

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="48%" cy="44%" r="82%"><stop offset="0" stop-color="#242531"/><stop offset=".58" stop-color="#11141d"/><stop offset="1" stop-color="#07090e"/></radialGradient>
    <linearGradient id="facet-warm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0bd88"/><stop offset=".48" stop-color="#d9d6b6"/><stop offset="1" stop-color="#8ea8c2"/></linearGradient>
    <linearGradient id="facet-cool" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#b6a7cf"/><stop offset=".52" stop-color="#cfbd91"/><stop offset="1" stop-color="#8eafac"/></linearGradient>
    <filter id="grain" x="-18%" y="-18%" width="136%" height="136%"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="32" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .1"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
    <filter id="soft-shadow" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <path class="field-halo" d="M 102 344 C 166 142 366 82 544 104 C 754 70 918 204 890 382 C 862 564 690 622 512 590 C 298 640 112 548 102 344 Z"/>
  <path class="field-grain" d="M 102 344 C 166 142 366 82 544 104 C 754 70 918 204 890 382 C 862 564 690 622 512 590 C 298 640 112 548 102 344 Z" filter="url(#grain)"/>
  <ellipse class="void-shadow" cx="500" cy="386" rx="136" ry="82" filter="url(#soft-shadow)"/>
  <g class="facets" aria-hidden="true">${facets}</g>
  <circle class="quiet-core" cx="${fixed(center.x * 1000)}" cy="${fixed(center.y * 680)}" r="${latest ? 18 : 9}"/>
  <g class="memory-marks" aria-hidden="true">${memoryMarks}</g>
  ${traceMarkup}${labels}`;

  stageReadout.textContent = current.interaction === 'loop-enclosed'
    ? 'closed winding held · five facets answered'
    : current.interaction === 'loop-refused-short'
      ? 'short offer refused · no geometry written'
      : current.interaction === 'loop-refused-open'
        ? 'open offer refused · closure required'
        : current.interaction === 'loop-refused-thin'
          ? 'thin offer refused · field too narrow'
          : current.interaction === 'loop-memory-full'
            ? 'three enclosures retained · lift or release'
            : current.interaction === 'loop-lifted'
              ? 'latest enclosure lifted · prior room restored'
              : current.interaction === 'released'
                ? 'constellation released · seed geometry restored'
                : `stage ${String(current.stage).padStart(2, '0')} / 12`;
  memoryReadout.textContent = `${current.memory.length} enclosures · ${latest ? `${latest.winding} / pivot ${latest.pivot + 1} / quiet ${latest.silent + 1}` : 'the facets are listening'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.facetCount = String(current.facets.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.pivot = latest ? String(latest.pivot) : '';
  field.dataset.silent = latest ? String(latest.silent) : '';
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  loopControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  loopControl.textContent = current.memory.length ? 'enclose again' : 'enclose the silence';
}

function commitLoop(points) {
  if (staticMode || blind) return;
  frame = applyLoop(frame, points);
  notice = frame.event?.committed ? 'loop-enclosed' : frame.interaction;
  trace = [];
  render(frame);
}

function gesture() {
  if (staticMode || blind) return;
  commitLoop(DEFAULT_LOOPS[frame.memory.length % DEFAULT_LOOPS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestLoop(frame);
  notice = 'loop-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  trace = [];
  frame = releaseConstellation();
  notice = 'constellation-released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  const point = normalizedPoint(event.clientX, event.clientY);
  pointerSession = { pointerId: event.pointerId };
  trace = [point];
  render(frame);
});

field.addEventListener('pointermove', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  const point = normalizedPoint(event.clientX, event.clientY);
  const previous = trace.at(-1);
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.012) {
    trace.push(point);
    render(frame);
  }
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  trace.push(normalizedPoint(event.clientX, event.clientY));
  const first = trace[0];
  commitLoop([...trace, first]);
  pointerSession = null;
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  trace = [];
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    gesture();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

loopControl.addEventListener('click', gesture);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
