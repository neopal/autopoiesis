import {
  AGENT_COUNT,
  buildField,
  buildTimeline,
  structureSignature,
  poseSignature,
  gazeAt,
  departGaze,
  liftLatest,
  releaseField
} from './engine.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';

let field;
let stageNode;
let layerNode;
let stageNodeLabel;
let memoryNode;
let stateNode;
let hintNode;
let interactionNode;
let cursor = 6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function bodyPath(agent) {
  const w = agent.width / 2;
  const h = agent.height / 2;
  const bend = agent.bend * w;
  const top = -h * (0.78 + agent.aperture * 0.12);
  const bottom = h * (0.82 - agent.aperture * 0.08);
  return [
    `M ${-w * 0.54} ${top * 0.12}`,
    `L ${-w * 0.18 + bend} ${-h * 0.52}`,
    `Q ${w * 0.16 + bend} ${-h * 0.7} ${w * 0.52} ${-h * 0.2}`,
    `L ${w * 0.34 - bend * 0.3} ${bottom * 0.78}`,
    `Q ${w * 0.06 - bend} ${bottom} ${-w * 0.48} ${h * 0.27}`,
    `Z`
  ].join(' ');
}

function aperturePath(agent) {
  const w = agent.width / 2;
  const h = agent.height / 2;
  const aperture = agent.aperture;
  const slit = Math.max(8, w * (0.16 + aperture * 0.46));
  const rise = h * (0.1 + aperture * 0.22);
  return `M ${-slit} ${-rise} Q 0 ${h * (0.08 + aperture * 0.34)} ${slit} ${rise * 0.56}`;
}

function spinePath(agent) {
  const w = agent.width / 2;
  const h = agent.height / 2;
  const bend = agent.bend * w * 0.7;
  return `M ${-w * 0.31 + bend} ${-h * 0.3} Q ${bend} 0 ${w * 0.28 - bend} ${h * 0.31}`;
}

function toneClass(agent) {
  return `syntax-agent--${agent.tone}`;
}

function agentLabel(agent) {
  const state = {
    quiet: 'quiet clause',
    gazing: 'clause turning toward the visitor',
    closed: 'remote clause closed after departure',
    opened: 'remote clause opened after departure',
    echoed: 'remote clause echoing the departure'
  }[agent.state] ?? 'syntax clause';
  return `clause ${agent.index + 1}: ${state}`;
}

function setup() {
  stageNode = document.querySelector('[data-syntax-stage]');
  layerNode = document.querySelector('[data-agent-layer]');
  stageNodeLabel = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  interactionNode = document.querySelector('[data-interaction-state]');
  field = staticMode ? buildTimeline().at(-1) : buildField();
  bindControls();
  render('quiet');
  window.__mutinePortraitV038 = {
    getState: () => structuredClone(field),
    gaze: (index, intensity = 0.72) => gazeAtIndex(index, intensity),
    depart: () => departRevision(),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    structureSignature: () => structureSignature(field),
    poseSignature: () => poseSignature(field)
  };
  window.dispatchEvent(new CustomEvent('mutine:ready', { detail: 'portrait-v038' }));
}

function bindControls() {
  stageNode.addEventListener('keydown', handleKeydown);
  stageNode.addEventListener('pointerleave', () => {
    if (field.lastGaze) departRevision();
  });
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'depart') departRevision();
      if (button.dataset.action === 'lift') liftRevision();
      if (button.dataset.action === 'release') releaseRevision();
    });
  });
}

function gazeAtIndex(index, intensity = 0.72) {
  if (staticMode) return field;
  cursor = clamp(Math.floor(Number(index) || 0), 0, AGENT_COUNT - 1);
  field = gazeAt(field, { index: cursor, intensity });
  stageNode.focus({ preventScroll: true });
  render('gazing');
  return field;
}

function departRevision() {
  if (staticMode) return { accepted: false, field };
  if (!field.lastGaze) gazeAtIndex(cursor, 0.66);
  const result = departGaze(field);
  field = result.field;
  render(result.accepted ? 'departed / remembered' : 'quiet');
  return result;
}

function liftRevision() {
  if (staticMode) return field;
  field = liftLatest(field);
  render('lifted / exact');
  return field;
}

function releaseRevision() {
  if (staticMode) return field;
  field = releaseField();
  cursor = 6;
  render('released');
  return field;
}

function moveCursor(delta) {
  if (field.lastGaze && field.lastGaze.index !== cursor) departRevision();
  cursor = (cursor + delta + AGENT_COUNT) % AGENT_COUNT;
  gazeAtIndex(cursor, 0.58);
}

function handleKeydown(event) {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    moveCursor(1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveCursor(-1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    departRevision();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftRevision();
  } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
    event.preventDefault();
    releaseRevision();
  }
}

function handleAgentEnter(index) {
  if (staticMode) return;
  if (field.lastGaze && field.lastGaze.index !== index) departRevision();
  gazeAtIndex(index, 0.72);
}

function handleAgentClick(index) {
  if (staticMode) return;
  gazeAtIndex(index, 0.84);
  departRevision();
}

function render(stage) {
  layerNode.replaceChildren();
  field.agents.forEach((agent) => {
    const group = svgElement('g', {
      class: `syntax-agent ${toneClass(agent)}`,
      'data-agent-index': agent.index,
      'data-state': agent.state,
      'data-gaze': agent.gaze > 0 ? 'true' : 'false',
      tabindex: '0',
      role: 'button',
      'aria-label': agentLabel(agent),
      'aria-pressed': agent.gaze > 0 ? 'true' : 'false',
      transform: `translate(${agent.x} ${agent.y}) rotate(${agent.angle + agent.pose})`
    });
    group.append(
      svgElement('path', { class: 'syntax-shadow', d: bodyPath({ ...agent, x: agent.x + 12, y: agent.y + 16 }) }),
      svgElement('path', { class: 'syntax-body', d: bodyPath(agent) }),
      svgElement('path', { class: 'syntax-aperture', d: aperturePath(agent) }),
      svgElement('path', { class: 'syntax-spine', d: spinePath(agent) })
    );
    group.addEventListener('pointerenter', () => handleAgentEnter(agent.index));
    group.addEventListener('focus', () => gazeAtIndex(agent.index, 0.72));
    group.addEventListener('click', () => handleAgentClick(agent.index));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleAgentClick(agent.index);
      }
    });
    layerNode.append(group);
  });

  const text = {
    quiet: 'the portrait is waiting to be seen',
    gazing: 'the clause turns toward you; structure holds',
    'departed / remembered': 'departure moved the answer elsewhere',
    'lifted / exact': 'the last remote answer was lifted exactly',
    released: 'the syntax is quiet again'
  }[stage] ?? 'the syntax is waiting';
  stageNodeLabel.textContent = `${stage} syntax / ${String(field.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${field.memory.length} departure${field.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.lastGaze ? 'leave the clause · let the sentence answer elsewhere' : 'move onto a clause · leave to let it answer elsewhere';
}

setup();
