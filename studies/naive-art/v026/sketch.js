import {
  buildFrame,
  buildTimeline,
  commitMiscount,
  geometrySignature,
  liftLatestMiscount,
  releaseMemory,
  selectWitness
} from './engine.mjs';

const field = document.querySelector('#miscount-field');
const witnessLayer = document.querySelector('#miscount-witnesses');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const selectionReadout = document.querySelector('[data-selection]');
const buttons = [...document.querySelectorAll('[data-gesture]')];
let state = buildFrame(0, []);

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

function ensureWitnesses() {
  if (witnessLayer.children.length) return;
  state.scene.witnesses.forEach((witness) => {
    const group = svgElement('g', {
      class: 'miscount-witness',
      'data-witness-index': witness.id,
      tabindex: '0',
      role: 'button',
      'aria-label': `Focus witness ${witness.id + 1}`
    });
    const shadow = svgElement('path', { class: 'witness-shadow' });
    const body = svgElement('path', { class: 'witness-body', 'fill-rule': 'evenodd' });
    const scar = svgElement('path', { class: 'witness-scar', 'aria-hidden': 'true' });
    group.append(shadow, body, scar);
    group.addEventListener('focus', () => choose(witness.id));
    group.addEventListener('pointerdown', () => choose(witness.id));
    group.addEventListener('click', () => choose(witness.id));
    witnessLayer.append(group);
  });
}

function choose(index) {
  state = selectWitness(state, index);
  render();
}

function commit() {
  state = commitMiscount(state);
  render();
}

function lift() {
  state = liftLatestMiscount(state);
  render();
}

function release() {
  state = releaseMemory(state);
  render();
}

function render() {
  ensureWitnesses();
  stageReadout.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryReadout.textContent = `${state.memory.length} miscount${state.memory.length === 1 ? '' : 's'}`;
  selectionReadout.textContent = `focus witness ${state.selected + 1}`;
  state.scene.witnesses.forEach((witness) => {
    const group = witnessLayer.querySelector(`[data-witness-index="${witness.id}"]`);
    const shadow = group.querySelector('.witness-shadow');
    const body = group.querySelector('.witness-body');
    const scar = group.querySelector('.witness-scar');
    group.classList.toggle('is-selected', state.selected === witness.id);
    group.classList.toggle('is-attended', witness.role === 'attended');
    group.classList.toggle('is-miscounted', witness.role === 'miscounted');
    group.classList.toggle('is-echo', witness.role === 'echo');
    body.setAttribute('d', witness.path);
    body.setAttribute('fill', witness.fill);
    body.setAttribute('stroke', witness.ink);
    shadow.setAttribute('d', witness.path);
    scar.setAttribute('d', witness.path);
  });
  field.dataset.interaction = state.interaction;
}

field.addEventListener('keydown', (event) => {
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    choose(Number(event.key) - 1);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
    return;
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

buttons.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.gesture === 'commit') commit();
  if (button.dataset.gesture === 'undo') lift();
  if (button.dataset.gesture === 'release') release();
}));

window.__mutineNaiveV026 = {
  getState: () => ({ ...state, geometrySignature: geometrySignature(state) }),
  select: choose,
  commit,
  lift,
  release,
  buildTimeline
};

render();
