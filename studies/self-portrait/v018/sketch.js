import {
  STAGES,
  buildTimeline,
  defaultCue,
  registerPressure,
  liftLatestPressure,
  releasePressures,
  geometrySignature
} from './engine.mjs';

const field = document.querySelector('#pressure-field');
const register = document.querySelector('#register');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressControl = document.querySelector('#press-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 2800;

let startedAt = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastInteraction = 'sequence';
let pointerDown = false;

if (interactivePreview) field.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

function createStrand(index) {
  const strand = document.createElement('div');
  strand.className = 'pressure-strand';
  strand.dataset.index = String(index);
  const left = document.createElement('span');
  left.className = 'pressure-strand__half pressure-strand__half--left';
  const right = document.createElement('span');
  right.className = 'pressure-strand__half pressure-strand__half--right';
  strand.append(left, right);
  register.append(strand);
  return strand;
}

const strandNodes = Array.from({ length: timeline[0].strands.length }, (_, index) => createStrand(index));

function renderStrand(node, strand) {
  node.dataset.status = strand.status;
  node.style.left = `${strand.x * 100}%`;
  node.style.top = `${strand.y * 100}%`;
  node.style.width = `${strand.length * 100}%`;
  node.style.height = `${Math.max(5, strand.thickness * 1000)}px`;
  node.style.transform = `translateY(-50%) rotate(${strand.angle}rad)`;
  const left = node.children[0];
  const right = node.children[1];
  const lengthPercent = strand.length * 100;
  const leftPercent = (strand.leftSpan / strand.length) * 100;
  const rightPercent = (strand.rightSpan / strand.length) * 100;
  left.style.left = '0';
  left.style.width = `${leftPercent}%`;
  right.style.left = `${leftPercent + (strand.gap / strand.length) * 100}%`;
  right.style.width = `${rightPercent}%`;
  node.style.setProperty('--length-percent', `${lengthPercent}%`);
  node.style.setProperty('--resistance', strand.resistance.toFixed(3));
}

function render(frame, interaction = lastInteraction) {
  frame.strands.forEach((strand, index) => renderStrand(strandNodes[index], strand));
  if (stageReadout) {
    stageReadout.textContent = interaction === 'pressure-committed'
      ? 'cut registered / load redistributed'
      : interaction === 'pressure-lifted'
        ? 'latest cut lifted'
        : interaction === 'pointer-tap-refused'
          ? 'pointer tap refused / use pressure command'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} cut${frame.memory.length === 1 ? '' : 's'} held · ${frame.strands.filter((strand) => strand.gap > 0).length} gaps in register`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.cuts = String(frame.cuts.length);
  field.dataset.replies = String(frame.replies.length);
  field.dataset.interaction = interaction;
  field.dataset.signature = geometrySignature(frame);
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

function commitPressure() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  const cue = defaultCue(baseline.memory.length);
  interactionFrame = registerPressure(baseline, cue);
  render(interactionFrame, 'pressure-committed');
}

function lift() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  if (!baseline.memory.length) return;
  interactionFrame = liftLatestPressure(baseline);
  render(interactionFrame, 'pressure-lifted');
}

function release() {
  interactionFrame = frozen ? releasePressures(0) : null;
  currentStage = 0;
  startedAt = performance.now();
  lastInteraction = 'sequence';
  renderCurrent();
}

field.addEventListener('pointerdown', () => {
  pointerDown = true;
});

field.addEventListener('pointerup', () => {
  if (!pointerDown) return;
  pointerDown = false;
  const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  render(frame, 'pointer-tap-refused');
});

field.addEventListener('pointercancel', () => { pointerDown = false; });

field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitPressure();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

pressControl?.addEventListener('click', commitPressure);
liftControl?.addEventListener('click', lift);
releaseControl?.addEventListener('click', release);
window.addEventListener('resize', () => renderCurrent());

window.__mutinePortraitV018 = {
  getState() {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      cuts: frame.cuts.length,
      replies: frame.replies.length,
      interaction: lastInteraction,
      signature: geometrySignature(frame)
    };
  },
  getFrame() { return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1); },
  getDiagnostics() { return { seed: '0x53504638', strands: timeline[0].strands.length, pointerDown }; },
  release
};

renderCurrent();
