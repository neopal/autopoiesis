import {
  STAGES,
  buildFrame,
  buildTimeline,
  armChoice,
  chooseBranch,
  defaultChoice,
  geometrySignature,
  liftLatestChoice,
  releaseChoices
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 2700;

const field = document.querySelector('#decision-field');
const atlas = document.querySelector('.decision-atlas');
const cards = [...document.querySelectorAll('[data-node]')];
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const choiceButtons = [...document.querySelectorAll('[data-choice]')];
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let pointerState = null;

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function choiceFromX(clientX) {
  const rect = field.getBoundingClientRect();
  return clientX - rect.left < rect.width / 2 ? 'left' : 'right';
}

function renderFrame(frame, interaction = frame.interaction || 'sequence') {
  currentFrame = frame;
  const activeIndex = frame.memory.at(-1)?.nodeIndex ?? frame.cursor;
  cards.forEach((card, index) => {
    const node = frame.nodes[index];
    const x = 50 + node.x * 100;
    const y = 50 + node.y * 100;
    card.style.setProperty('--x', x.toFixed(3));
    card.style.setProperty('--y', y.toFixed(3));
    card.style.setProperty('--w', (node.width * 100).toFixed(3));
    card.style.setProperty('--h', (node.height * 170).toFixed(3));
    card.style.setProperty('--angle', (node.angle * 57.2958).toFixed(3));
    card.style.setProperty('--skew', ((node.pressure - node.counter) * 7).toFixed(3));
    card.style.setProperty('--notch', node.notch.toFixed(3));
    card.style.setProperty('--counter', node.counter.toFixed(3));
    card.style.setProperty('--line-angle', (node.angle * -38).toFixed(3));
    card.style.setProperty('--edge-angle', (node.counter * 8).toFixed(3));
    card.style.setProperty('--void-angle', (node.notch * 70 - 26).toFixed(3));
    card.dataset.state = node.state;
    card.dataset.armed = String(Boolean(frame.armedChoice && index === activeIndex));
    card.style.zIndex = String(10 + index + Math.round(node.counter * 8) + (node.state === 'kept' ? 30 : 0));
  });

  const kept = frame.nodes.filter((node) => node.state === 'kept').length;
  const refused = frame.nodes.filter((node) => node.state === 'refused').length;
  const counters = frame.nodes.filter((node) => node.state === 'counter').length;
  if (stageReadout) {
    stageReadout.textContent = interaction === 'choice-committed'
      ? 'branch kept / refusal stored'
      : interaction === 'choice-lifted'
        ? 'latest refusal lifted'
        : interaction === 'choice-armed'
          ? `${frame.armedChoice} side armed / commit to write`
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} refusal${frame.memory.length === 1 ? '' : 's'} held · ${kept} keep · ${refused} refuse · ${counters} reply`;
  if (stateReadout) {
    stateReadout.textContent = interaction === 'choice-committed'
      ? 'The kept branch opens; the refusal has moved the next answer elsewhere.'
      : interaction === 'choice-lifted'
        ? 'The latest refusal is gone. The prior atlas is exact again.'
        : interaction === 'choice-armed'
          ? `The ${frame.armedChoice} possibility is armed. Commit to let the portrait contradict itself.`
          : interaction === 'pointer-choice'
            ? 'A side was chosen. The portrait keeps the other possibility as a condition.'
            : 'The atlas is holding two incompatible beginnings.';
  }
  if (hint) hint.textContent = frame.armedChoice ? `commit ${frame.armedChoice}` : 'choose a side; the other becomes a condition';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.cursor = String(frame.cursor);
    field.dataset.interaction = interaction;
    field.dataset.signature = geometrySignature(frame);
    field.dataset.choice = frame.armedChoice ?? '';
  }
}

function arm(choice) {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = armChoice(base, choice);
  renderFrame(interactionFrame, 'choice-armed');
}

function commit(choice = null, interaction = 'choice-committed') {
  const base = interactionFrame ?? activeFrameAt();
  const safeChoice = choice ?? base.armedChoice ?? defaultChoice(base.memory.length);
  interactionFrame = chooseBranch(base, safeChoice);
  renderFrame(interactionFrame, interaction);
}

function lift() {
  const base = interactionFrame ?? activeFrameAt();
  if (!base.memory.length) return;
  interactionFrame = liftLatestChoice(base);
  renderFrame(interactionFrame, 'choice-lifted');
}

function release() {
  interactionFrame = frozen ? releaseChoices(0) : null;
  startedAt = performance.now();
  renderFrame(interactionFrame ?? timeline[0], 'choices-released');
}

function saveState() {
  const payload = JSON.stringify({ version: 'v022', signature: geometrySignature(currentFrame), frame: currentFrame }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-self-portrait-v022-state.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function isControlEvent(event) {
  return event.target instanceof Element && Boolean(event.target.closest('.choice-controls'));
}

function attachInteractions() {
  if (!field || staticPreview) return;
  field.addEventListener('pointermove', (event) => {
    if (isControlEvent(event)) return;
    arm(choiceFromX(event.clientX));
  });
  field.addEventListener('pointerdown', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    field.setPointerCapture?.(event.pointerId);
    pointerState = { x: event.clientX, y: event.clientY };
    arm(choiceFromX(event.clientX));
  });
  field.addEventListener('pointerup', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    const choice = choiceFromX(event.clientX);
    pointerState = null;
    commit(choice, 'pointer-choice');
  });
  field.addEventListener('pointercancel', () => { pointerState = null; });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      arm('left');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      arm('right');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      release();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveState();
    }
  });
  choiceButtons.forEach((button) => button.addEventListener('click', () => commit(button.dataset.choice)));
  liftButton?.addEventListener('click', lift);
  releaseButton?.addEventListener('click', release);
}

window.__mutinePortraitV022 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    choice: currentFrame.memory.at(-1)?.choice ?? null,
    kept: currentFrame.nodes.filter((node) => node.state === 'kept').length,
    refused: currentFrame.nodes.filter((node) => node.state === 'refused').length,
    counters: currentFrame.nodes.filter((node) => node.state === 'counter').length,
    interaction: currentFrame.interaction || 'sequence',
    interactive: interactivePreview || !staticPreview,
    blind: blindMode,
    signature: geometrySignature(currentFrame)
  }),
  getFrame: () => currentFrame,
  arm,
  choose: (choice) => commit(choice),
  lift,
  release,
  save: saveState,
  requestRender: () => renderFrame(currentFrame, currentFrame.interaction || 'sequence')
};

renderFrame(frozen ? timeline.at(-1) : currentFrame);
attachInteractions();
window._p5Ready = true;

function tick(now) {
  if (!frozen && !interactionFrame) renderFrame(activeFrameAt(now));
  window.requestAnimationFrame(tick);
}
window.requestAnimationFrame(tick);
