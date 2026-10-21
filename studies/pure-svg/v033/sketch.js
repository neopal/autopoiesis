import {
  FAULT_COUNT,
  MEMORY_WINDOW,
  applyPressure,
  buildFrame,
  buildTimeline,
  faultPoint,
  geometrySignature,
  liftLatestPressure,
  releaseSheet
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressureControl = document.querySelector('#pressure-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_OFFERS = [
  { x: 0.21, y: 0.34, duration: 220 },
  { x: 0.73, y: 0.23, duration: 360 },
  { x: 0.62, y: 0.61, duration: 480 },
  { x: 0.36, y: 0.68, duration: 620 }
];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function stateLabel(current) {
  if (current.interaction === 'pressure-redistributed') return 'PRESSURE REDISTRIBUTED / SHEET ANSWERS ELSEWHERE';
  if (current.interaction === 'pressure-refused-weak') return 'WEAK OFFER REFUSED / NO LOCAL MARK';
  if (current.interaction === 'pressure-refused-held') return 'OVER-HELD OFFER REFUSED / RESISTANCE CLOSED';
  if (current.interaction === 'pressure-memory-full') return 'FOUR EVENTS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'pressure-lifted') return 'LATEST PRESSURE LIFTED / PRIOR SHEET RESTORED';
  if (current.interaction === 'released') return 'SHEET RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function seamPath(current) {
  const shift = current.sheet.riftShift * 1000;
  const bend = current.sheet.fold * 5;
  return `M ${210 + shift} 518 C 340 ${448 + bend} 510 ${530 - bend} 782 ${234 - shift * 0.3}`;
}

function render(current = frame) {
  const latest = current.event?.committed ? current.event : null;
  const remembered = new Set(current.memory.flatMap((event) => [event.sourceFault, event.counterFault, event.scarFault]));
  const faults = current.faults.map((fault, index) => {
    const classes = ['fault', `fault--${fault.role}`];
    if (remembered.has(index)) classes.push('fault--remembered');
    if (latest?.sourceFault === index) classes.push('fault--source');
    if (latest?.counterFault === index) classes.push('fault--counter');
    if (latest?.scarFault === index) classes.push('fault--scar');
    return `<path class="${classes.join(' ')}" data-fault="${index}" d="${fault.pathSignature}"/>`;
  }).join('');
  const marks = current.memory.map((event, index) => {
    const source = faultPoint(current, event.sourceFault);
    return `<circle class="memory-mark" cx="${fixed(source.x * 1000)}" cy="${fixed(source.y * 680)}" r="${5 + index * 2}"/>`;
  }).join('');
  const labels = blind ? '' : `<g class="field-labels"><text x="40" y="48">${stateLabel(current)}</text><text x="960" y="636" text-anchor="end">${FAULT_COUNT} FAULTS / ${current.memory.length} PRESSURE EVENTS / ${latest ? `SOURCE ${latest.sourceFault + 1} → COUNTER ${latest.counterFault + 1} → SCAR ${latest.scarFault + 1}` : 'WAITING'}</text></g>`;
  const seam = blind ? '' : `<path class="sheet-seam" d="${seamPath(current)}"/>`;

  field.innerHTML = `<defs>
    <linearGradient id="sheet-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d2b0"/><stop offset=".42" stop-color="#d6d8c7"/><stop offset="1" stop-color="#a2b4c6"/></linearGradient>
    <linearGradient id="sheet-edge" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#725263"/><stop offset=".58" stop-color="#9a7f86"/><stop offset="1" stop-color="#bba47f"/></linearGradient>
    <radialGradient id="paper-ground" cx="50%" cy="45%" r="80%"><stop offset="0" stop-color="#27252d"/><stop offset=".65" stop-color="#12141a"/><stop offset="1" stop-color="#08090d"/></radialGradient>
    <filter id="sheet-shadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence baseFrequency=".018" numOctaves="2" seed="33" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <path class="sheet-shadow" d="${current.sheetPath}" transform="translate(0 18)" filter="url(#sheet-shadow)"/>
  <path class="sheet" d="${current.sheetPath}" fill-rule="evenodd"/>
  <path class="sheet-edge" d="${current.sheetPath}" fill="none" fill-rule="evenodd"/>
  <path class="sheet-grain" d="${current.sheetPath}" fill="none" fill-rule="evenodd" filter="url(#grain)"/>
  ${seam}
  <g class="faults" aria-hidden="true">${faults}</g>
  <g class="memory-marks" aria-hidden="true">${marks}</g>
  ${labels}`;

  stageReadout.textContent = current.interaction === 'pressure-redistributed'
    ? 'bounded pressure absorbed · three remote roles changed'
    : current.interaction === 'pressure-refused-weak'
      ? 'weak offer refused · the sheet stayed exact'
      : current.interaction === 'pressure-refused-held'
        ? 'over-held offer refused · resistance closed'
        : current.interaction === 'pressure-memory-full'
          ? 'four pressure events retained · lift or release'
          : current.interaction === 'pressure-lifted'
            ? 'latest pressure lifted · prior sheet restored'
            : current.interaction === 'released'
              ? 'sheet released · seed geometry restored'
              : `stage ${String(current.stage).padStart(2, '0')} / 16`;
  memoryReadout.textContent = `${current.memory.length} pressure events · ${latest ? `source ${latest.sourceFault + 1} / counter ${latest.counterFault + 1} / scar ${latest.scarFault + 1}` : 'the sheet is quiet'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.faultCount = String(current.faults.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  pressureControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  pressureControl.textContent = current.memory.length ? 'hold again' : 'hold the sheet';
}

function commitPressure(offer) {
  if (staticMode || blind) return;
  frame = applyPressure(frame, offer);
  notice = frame.event?.committed ? 'pressure-redistributed' : frame.interaction;
  render(frame);
}

function deterministicPressure() {
  commitPressure(DEFAULT_OFFERS[frame.memory.length % DEFAULT_OFFERS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestPressure(frame);
  notice = 'pressure-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseSheet();
  notice = 'released';
  render(frame);
}

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)))
  };
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, startedAt: performance.now(), point: normalizedPoint(event.clientX, event.clientY) };
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  const duration = Math.round(performance.now() - pointerSession.startedAt);
  commitPressure({ point: pointerSession.point, duration });
  pointerSession = null;
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicPressure();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

pressureControl.addEventListener('click', deterministicPressure);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
