import {
  STAGES,
  CLAUSE_COUNT,
  buildTimeline,
  defaultCue,
  armClause,
  commitAttention,
  liftLatestAttention,
  releaseAttention,
  geometrySignature,
  pathForClause
} from './engine.mjs';

const seal = document.querySelector('#syntax-seal');
const clausesGroup = document.querySelector('#clauses');
const armedMark = document.querySelector('#armed-mark');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attendControl = document.querySelector('#attend-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 2900;
const POINTER_REFUSAL = 'pointer-attention-refused';

let startedAt = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastInteraction = 'sequence';
let armedClause = 1;

if (interactivePreview) seal.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  seal.tabIndex = -1;
  seal.removeAttribute('aria-keyshortcuts');
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

const clauseNodes = Array.from({ length: CLAUSE_COUNT }, (_, index) => {
  const glow = svgElement('path', { class: 'clause-glow' });
  const path = svgElement('path', { class: 'syntax-clause', 'data-index': index });
  clausesGroup.append(glow, path);
  return { glow, path };
});

function renderClause(node, clause, index) {
  const transform = `translate(${clause.x * 1000} ${clause.y * 760}) rotate(${clause.angle * 57.2958})`;
  const path = pathForClause(clause, index);
  node.path.setAttribute('d', path);
  node.glow.setAttribute('d', path);
  node.path.setAttribute('transform', transform);
  node.glow.setAttribute('transform', transform);
  node.path.dataset.status = clause.status;
  node.path.dataset.armed = String(index === armedClause);
  node.glow.style.opacity = clause.status === 'quiet' ? '0.2' : '0.55';
}

function render(frame, interaction = lastInteraction) {
  frame.clauses.forEach((clause, index) => renderClause(clauseNodes[index], clause, index));
  const armed = frame.clauses[armedClause];
  if (armedMark && armed) armedMark.setAttribute('transform', `translate(${armed.x * 1000} ${armed.y * 760})`);
  if (stageReadout) {
    stageReadout.textContent = interaction === 'attention-committed'
      ? 'reply written / syntax altered'
      : interaction === 'attention-lifted'
        ? 'latest reply lifted'
        : interaction === POINTER_REFUSAL
          ? 'pointer attention refused / use keys'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} repl${frame.memory.length === 1 ? 'y' : 'ies'} held · ${frame.clauses.filter((clause) => clause.split > 0).length} clauses split`;
  seal.dataset.stage = String(frame.stage);
  seal.dataset.memory = String(frame.memory.length);
  seal.dataset.replies = String(frame.replies.length);
  seal.dataset.armed = String(armedClause);
  seal.dataset.interaction = interaction;
  seal.dataset.signature = geometrySignature(frame);
  lastInteraction = interaction;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, lastInteraction);
    return;
  }
  render(frozen ? timeline.at(-1) : frameAt(now), 'sequence');
  if (!frozen) requestAnimationFrame(renderCurrent);
}

function arm(index) {
  armedClause = (index + CLAUSE_COUNT) % CLAUSE_COUNT;
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = armClause(baseline, armedClause);
  render(interactionFrame, 'attention-armed');
}

function commit() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = commitAttention(baseline, { clauseIndex: armedClause });
  render(interactionFrame, 'attention-committed');
}

function lift() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  if (!baseline.memory.length) return;
  interactionFrame = liftLatestAttention(baseline);
  render(interactionFrame, 'attention-lifted');
}

function release() {
  interactionFrame = frozen ? releaseAttention(0) : null;
  currentStage = 0;
  armedClause = 1;
  startedAt = performance.now();
  lastInteraction = 'sequence';
  renderCurrent();
}

seal.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  render(interactionFrame ?? timeline[currentStage] ?? timeline.at(-1), POINTER_REFUSAL);
});
seal.addEventListener('pointerup', (event) => event.preventDefault());

seal.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    arm(armedClause + 1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    arm(armedClause - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attendControl?.addEventListener('click', commit);
liftControl?.addEventListener('click', lift);
releaseControl?.addEventListener('click', release);
window.addEventListener('resize', () => renderCurrent());

window.__mutinePortraitV019 = {
  getState() {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      replies: frame.replies.length,
      armedClause,
      interaction: lastInteraction,
      signature: geometrySignature(frame)
    };
  },
  getFrame() { return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1); },
  getDiagnostics() { return { seed: '0x53504639', clauses: CLAUSE_COUNT, pointerRule: POINTER_REFUSAL }; },
  arm,
  commit,
  lift,
  release
};

renderCurrent();
