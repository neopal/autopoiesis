import {
  MEMORY_WINDOW,
  TOKEN_COUNT,
  advanceBeat,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestBeat,
  releaseScore
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const beatControl = document.querySelector('#beat-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_INTERVALS = [320, 540, 760, 420];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pendingBeatAt = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function stateLabel(current) {
  if (current.interaction === 'beat-delayed') return 'SECOND BEAT / SCORE REWRITTEN ELSEWHERE';
  if (current.interaction === 'beat-refused-stutter') return 'STUTTER / FIRST MARK KEPT WAITING';
  if (current.interaction === 'beat-refused-late') return 'LATE ANSWER / APPOINTMENT MISSED';
  if (current.interaction === 'score-memory-full') return 'FOUR BEATS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'beat-lifted') return 'LATEST BEAT LIFTED / PRIOR SCORE RESTORED';
  if (current.interaction === 'released') return 'SCORE RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function tokenClasses(token, current) {
  const remembered = new Set(current.memory.flatMap((event) => [event.sourceToken, event.counterToken, event.witnessToken]));
  const latest = current.event?.committed ? current.event : null;
  const classes = ['token', `token--${token.role}`];
  if (remembered.has(token.id)) classes.push('token--remembered');
  if (latest?.sourceToken === token.id) classes.push('token--source');
  if (latest?.counterToken === token.id) classes.push('token--echo');
  if (latest?.witnessToken === token.id) classes.push('token--witness');
  return classes.join(' ');
}

function memoryMarks(current) {
  return current.memory.map((event, index) => {
    const source = current.tokens[event.sourceToken];
    const witness = current.tokens[event.witnessToken];
    const y = 94 + index * 23;
    return `<path class="beat-mark" d="M ${fixed(source.x * 1000)} ${y} L ${fixed(witness.x * 1000)} ${y}"/><circle class="beat-dot" cx="${fixed(source.x * 1000)}" cy="${y}" r="${3 + index * .7}"/>`;
  }).join('');
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels"><text x="44" y="46">${stateLabel(current)}</text><text x="956" y="628" text-anchor="end">${TOKEN_COUNT} MARKS / ${current.memory.length} BEATS / ${current.event?.committed ? `${current.event.band.toUpperCase()} INTERVAL` : 'WAITING'}</text></g>`;
  const tokens = current.tokens.map((token) => `<path class="${tokenClasses(token, current)}" data-token="${token.id}" d="${token.pathSignature}"/>`).join('');
  const roleStems = current.tokens.map((token) => `<path class="token-stem token-stem--${token.role}" d="M ${fixed(token.x * 1000)} 302 L ${fixed(token.x * 1000 + token.shift * 16)} 482"/>`).join('');
  field.innerHTML = `<defs>
    <linearGradient id="score-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#191d27"/><stop offset=".46" stop-color="#11151e"/><stop offset="1" stop-color="#080a10"/></linearGradient>
    <linearGradient id="score-ink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d8a8"/><stop offset=".45" stop-color="#d6a778"/><stop offset="1" stop-color="#8cb2bd"/></linearGradient>
    <linearGradient id="score-echo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a9c8cf"/><stop offset="1" stop-color="#687d9c"/></linearGradient>
    <radialGradient id="score-glow" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#394154" stop-opacity=".65"/><stop offset="1" stop-color="#0a0c12" stop-opacity="0"/></radialGradient>
    <pattern id="registration" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 0 0 H 38 M 0 0 V 38" stroke="#d7c9ad" stroke-opacity=".055" stroke-width="1"/></pattern>
    <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <rect class="registration" width="1000" height="680"/>
  <ellipse class="score-glow" cx="500" cy="360" rx="390" ry="180" filter="url(#soft-glow)"/>
  <path class="score-rail-shadow" d="${current.railPath}" transform="translate(0 13)"/>
  <path class="score-rail" d="${current.railPath}"/>
  <g class="role-stems" aria-hidden="true">${roleStems}</g>
  <g class="tokens" aria-hidden="true">${tokens}</g>
  <g class="beat-memory" aria-hidden="true">${memoryMarks(current)}</g>
  ${labels}`;

  if (current.interaction === 'beat-delayed') {
    stageReadout.textContent = 'second beat absorbed · three distant marks rewrote';
  } else if (current.interaction === 'beat-refused-stutter') {
    stageReadout.textContent = 'stutter refused · the first mark kept waiting';
  } else if (current.interaction === 'beat-refused-late') {
    stageReadout.textContent = 'late answer refused · the score stayed exact';
  } else if (current.interaction === 'score-memory-full') {
    stageReadout.textContent = 'four beats retained · lift or release';
  } else if (current.interaction === 'beat-lifted') {
    stageReadout.textContent = 'latest beat lifted · prior score restored';
  } else if (current.interaction === 'released') {
    stageReadout.textContent = 'score released · seed geometry restored';
  } else if (pendingBeatAt !== null) {
    stageReadout.textContent = 'first beat heard · waiting for the second';
  } else {
    stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;
  }
  memoryReadout.textContent = `${current.memory.length} beats · ${current.event?.committed ? `${current.event.band} interval / source ${current.event.sourceToken + 1} / witness ${current.event.witnessToken + 1}` : 'the score is waiting'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.tokenCount = String(current.tokens.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  beatControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  beatControl.textContent = pendingBeatAt === null ? 'offer a second beat' : 'answer the first beat';
}

function commitBeat(interval) {
  if (staticMode || blind) return;
  frame = advanceBeat(frame, { interval });
  notice = frame.event?.committed ? 'beat-delayed' : frame.interaction;
  render(frame);
}

function deterministicBeat() {
  commitBeat(DEFAULT_INTERVALS[frame.memory.length % DEFAULT_INTERVALS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  pendingBeatAt = null;
  frame = liftLatestBeat(frame);
  notice = 'beat-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pendingBeatAt = null;
  frame = releaseScore();
  notice = 'released';
  render(frame);
}

field.addEventListener('pointerup', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  const now = performance.now();
  if (pendingBeatAt === null) {
    pendingBeatAt = now;
    notice = 'first-beat-heard';
    render(frame);
    return;
  }
  const interval = Math.round(now - pendingBeatAt);
  pendingBeatAt = null;
  commitBeat(interval);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicBeat();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

beatControl.addEventListener('click', deterministicBeat);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
