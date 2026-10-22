import {
  STAGES,
  buildFrame,
  buildTimeline,
  pulse,
  liftLatest,
  releaseField,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;

const stage = document.querySelector('[data-decision-population]');
const stack = document.querySelector('[data-decision-stack]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const hint = document.querySelector('[data-hint]');
const stateReadout = document.querySelector('[data-interaction-state]');
const timeline = buildTimeline();
const PULSE_MS = 4200;
let currentFrame = timeline[0];
let interactionFrame = null;
let startedAt = performance.now();
let lastSignature = '';
let pointerDown = null;

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (PULSE_MS * timeline.length)) / PULSE_MS)];
}

function rowMarkup(agent, rank, frame) {
  const width = 49 + agent.width * 39;
  const shift = 7 + ((rank * 17 + agent.index * 9) % 28) + (agent.state === 'minority' ? 8 : 0);
  const angle = (-2.7 + ((agent.index * 13 + rank * 5) % 19) * 0.31 + agent.lean * 18).toFixed(2);
  const charge = Math.round(agent.charge * 100);
  const stateLabel = agent.state === 'minority' ? ' second opinion' : agent.state === 'displaced' ? ' displaced' : '';
  return `<li class="decision-row state-${agent.state}" data-agent-index="${agent.index}" data-rank="${rank}" style="--row-width:${width.toFixed(2)}%;--row-shift:${shift.toFixed(2)}%;--row-angle:${angle}deg;--charge:${charge}%">
    <span class="row-index" aria-hidden="true">${String(rank + 1).padStart(2, '0')}</span>
    <span class="decision-lead">${agent.lead}</span>
    <span class="decision-tail">${agent.tail}</span>
    <span class="row-mark" aria-hidden="true"></span>
    <span class="sr-only">${agent.lead} ${agent.tail}${stateLabel}</span>
  </li>`;
}

function render(frame = activeFrameAt()) {
  const signature = geometrySignature(frame);
  if (signature !== lastSignature) {
    stack.innerHTML = frame.order.map((index, rank) => rowMarkup(frame.agents[index], rank, frame)).join('');
    lastSignature = signature;
  }
  stage.dataset.memory = String(frame.memory.length);
  stage.dataset.stage = String(frame.stage);
  stageReadout.textContent = frame.memory.length ? `revision ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}` : `quiet field / ${String(frame.stage).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} opinion${frame.memory.length === 1 ? '' : 's'} held`;
  if (frame.interaction === 'committed') hint.textContent = 'the second opinion crossed the field; the order remembers';
  else if (frame.interaction === 'lifted') hint.textContent = 'latest opinion lifted; the preceding order is exact';
  else hint.textContent = 'one pulse; the least-attended decision crosses the field';
}

function updateState(message) {
  if (stateReadout) stateReadout.textContent = message;
}

function setInteraction(next, message) {
  interactionFrame = next;
  currentFrame = next;
  render(next);
  updateState(message);
}

function commitPulse() {
  const source = interactionFrame ?? currentFrame;
  const next = pulse(source);
  const event = next.memory.at(-1);
  setInteraction(next, `Decision ${event.sourceIndex + 1} crossed to the second-opinion position; decision ${event.destinationIndex + 1} was displaced.`);
}

function lift() {
  const next = liftLatest(interactionFrame ?? currentFrame);
  setInteraction(next, next.interaction === 'lifted' ? 'Latest opinion lifted; the preceding DOM order is exact.' : 'Nothing to lift yet.');
}

function release() {
  setInteraction(releaseField(0), 'The population released its memory and returned to the quiet field.');
}

stage.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  pointerDown = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  stage.focus({ preventScroll: true });
});

stage.addEventListener('pointerup', (event) => {
  if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (distance < 18) commitPulse();
});

stage.addEventListener('pointercancel', () => { pointerDown = null; });

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'pulse') commitPulse();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  });
});

stage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitPulse();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

function tick(now) {
  if (!interactionFrame) {
    const next = activeFrameAt(now);
    if (next !== currentFrame) {
      currentFrame = next;
      lastSignature = '';
    }
    render(next);
  } else {
    render(interactionFrame);
  }
  if (!frozen) requestAnimationFrame(tick);
}

currentFrame = activeFrameAt();
render(currentFrame);
if (!frozen) requestAnimationFrame(tick);

window.__mutinePortraitV030 = {
  getState: () => ({ frame: currentFrame, geometry: geometrySignature(currentFrame) }),
  pulse: commitPulse,
  lift,
  release,
  buildFrame,
  geometrySignature,
  blindMode
};
