import {
  SLOT_COUNT,
  MEMORY_WINDOW,
  attend,
  buildFrame,
  commitSpeech,
  geometrySignature,
  liftLatest,
  release,
  speak
} from './engine.mjs';

const DEFAULT_SPEECHES = ['murmur', 'unmake', 'listen', 'margin'];
const KEYBOARD_ORDER = [2, 8, 5, 11, 14, 0];
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const field = document.querySelector('#phoneme-field');
const canvas = document.querySelector('#phoneme-canvas');
const input = document.querySelector('#speech-input');
const form = document.querySelector('#speech-form');
const speakControl = document.querySelector('#speak-control');
const liftControl = document.querySelector('#lift-speech');
const releaseControl = document.querySelector('#release-speech');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');

let frame = staticPreview ? buildFrame(DEFAULT_SPEECHES) : buildFrame([]);
let keyboardIndex = KEYBOARD_ORDER[0];
let context = null;
let logicalWidth = 0;
let logicalHeight = 0;
let animationFrame = 0;
let startedAt = performance.now();

const palette = {
  ground: '#17120f',
  paper: '#f1e5d5',
  copper: '#d57958',
  mint: '#9ec9b7',
  lilac: '#b4a1d6',
  rust: '#8c493e',
  dim: '#6e6056'
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  logicalWidth = Math.max(1, rect.width);
  logicalHeight = Math.max(1, rect.height);
  canvas.width = Math.round(logicalWidth * ratio);
  canvas.height = Math.round(logicalHeight * ratio);
  context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  render();
}

function slotPoint(slot) {
  return {
    x: logicalWidth * (0.5 + slot.x * 0.43),
    y: logicalHeight * (0.5 + slot.y * 0.42)
  };
}

function familyColor(family, opacity = 1) {
  const color = family === 'vowel' ? palette.lilac
    : family === 'fricative' ? palette.mint
      : family === 'plosive' ? palette.copper
        : family === 'liquid' ? palette.paper : palette.rust;
  return `${color}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
}

function drawTrackedText(ctx, text, x, y, tracking, method, size) {
  const characters = [...text];
  const spacing = tracking * size * .8;
  const widths = characters.map((character) => ctx.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, characters.length - 1) * spacing;
  let cursor = x - total * .5;
  characters.forEach((character, index) => {
    const width = widths[index];
    ctx[method](character, cursor + width * .5, y);
    cursor += width + spacing;
  });
}

function drawBackground(ctx, time) {
  const wash = ctx.createRadialGradient(logicalWidth * .45, logicalHeight * .42, 0, logicalWidth * .45, logicalHeight * .42, Math.max(logicalWidth, logicalHeight) * .72);
  wash.addColorStop(0, 'rgba(99, 74, 68, .34)');
  wash.addColorStop(.52, 'rgba(40, 31, 29, .2)');
  wash.addColorStop(1, 'rgba(10, 8, 7, .82)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  ctx.save();
  ctx.globalAlpha = .16;
  ctx.strokeStyle = palette.paper;
  ctx.lineWidth = 1;
  const drift = reducedMotion ? 0 : Math.sin(time * .00016) * 3;
  for (let index = 0; index < 7; index += 1) {
    const y = logicalHeight * (.16 + index * .115) + drift * (index - 3);
    ctx.beginPath();
    ctx.moveTo(logicalWidth * .07, y);
    ctx.lineTo(logicalWidth * (.92 - index * .018), y + logicalHeight * .018);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (let index = 0; index < 240; index += 1) {
    const x = (index * 97 + 31) % Math.max(1, Math.floor(logicalWidth));
    const y = (index * 53 + 17) % Math.max(1, Math.floor(logicalHeight));
    const alpha = .025 + ((index * 17) % 10) / 1000;
    ctx.fillStyle = `rgba(241,229,213,${alpha})`;
    ctx.fillRect(x, y, index % 3 === 0 ? 1.5 : 1, index % 7 === 0 ? 1.5 : 1);
  }
  ctx.restore();
}

function drawSlot(ctx, slot, time) {
  const point = slotPoint(slot);
  const minDimension = Math.min(logicalWidth, logicalHeight);
  const size = minDimension * .085 * slot.size;
  const breathing = reducedMotion ? 0 : Math.sin(time * .00055 + slot.id * .73) * minDimension * .0022;
  const color = familyColor(slot.family, slot.visible ? slot.opacity : .42);
  const active = frame.active === slot.id;
  const width = Math.max(24, size * (slot.text.length * .34 + 1.35));

  ctx.save();
  ctx.translate(point.x + breathing, point.y);
  ctx.rotate(slot.rotation);
  ctx.globalAlpha = slot.visible ? slot.opacity : .36;
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.fillRect(-width * .5 + minDimension * .012, -size * .43 + minDimension * .014, width, size * .74);

  if (!slot.visible) {
    ctx.globalAlpha = .42;
    ctx.strokeStyle = familyColor(slot.family, .55);
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 1;
    ctx.strokeRect(-width * .5, -size * .43, width, size * .74);
    ctx.setLineDash([]);
  } else {
    ctx.font = `${slot.family === 'vowel' ? 'italic ' : ''}600 ${size}px ${slot.family === 'liquid' ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, minDimension * .002);
    ctx.strokeStyle = `rgba(23,18,15,.92)`;
    drawTrackedText(ctx, slot.text, 0, -size * .05, slot.tracking, 'strokeText', size);
    ctx.fillStyle = color;
    drawTrackedText(ctx, slot.text, 0, -size * .05, slot.tracking, 'fillText', size);
    ctx.globalAlpha = .54;
    ctx.fillStyle = familyColor(slot.family, .7);
    ctx.font = `500 ${Math.max(9, size * .19)}px ui-monospace, monospace`;
    ctx.fillText(`${slot.family} / ${String(slot.id + 1).padStart(2, '0')}`, 0, size * .45);
  }

  ctx.globalAlpha = active ? .94 : .32;
  ctx.strokeStyle = active ? palette.paper : familyColor(slot.family, .5);
  ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(-width * .36, size * .57);
  ctx.lineTo(width * .36, size * .57);
  ctx.stroke();
  if (slot.family === 'pause') {
    ctx.beginPath();
    ctx.arc(width * .46, -size * .05, Math.max(2, size * .06), 0, Math.PI * 2);
    ctx.fillStyle = palette.copper;
    ctx.fill();
  }
  ctx.restore();
}

function render() {
  if (!context || !logicalWidth || !logicalHeight) return;
  const time = performance.now() - startedAt;
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  drawBackground(context, time);
  [...frame.slots].sort((a, b) => a.y - b.y).forEach((slot) => drawSlot(context, slot, time));

  context.save();
  context.globalAlpha = .44;
  context.fillStyle = palette.paper;
  context.font = `500 ${Math.max(10, Math.min(14, logicalWidth * .009))}px ui-monospace, monospace`;
  context.fillText('MARGIN / 036', logicalWidth * .08, logicalHeight * .9);
  context.fillStyle = palette.copper;
  context.fillText('THE UNHEARD IS NOT EMPTY', logicalWidth * .58, logicalHeight * .9);
  context.restore();

  const event = frame.lastEvent === 'spoken' ? 'speech / redistributed' : frame.lastEvent === 'attending' ? 'attention / held' : frame.lastEvent === 'drafting' ? 'phrase / forming' : `ecology / ${frame.lastEvent}`;
  if (stageReadout) stageReadout.textContent = event;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} utterances · ${SLOT_COUNT} fragments`;
  if (interactionState) {
    interactionState.textContent = frame.lastEvent === 'spoken'
      ? `The phrase was redistributed. ${frame.memory.length} ${frame.memory.length === 1 ? 'utterance remains' : 'utterances remain'} in the sentence.`
      : frame.lastEvent === 'lifted'
        ? 'The latest utterance has been lifted. The previous ecology is exact.'
        : frame.lastEvent === 'refused'
          ? 'The ecology needs at least two alphabetic characters before it can answer.'
          : 'The field is listening. No phrase has entered the ecology.';
  }
}

function slotAtPointer(event) {
  const rect = field.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  let nearest = 0;
  let nearestDistance = Infinity;
  for (const slot of frame.slots) {
    const point = { x: .5 + slot.x * .43, y: .5 + slot.y * .42 };
    const distance = ((point.x - x) ** 2) + ((point.y - y) ** 2);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = slot.id;
    }
  }
  return nearest;
}

function setFrame(next) {
  frame = next;
  render();
}

function attendSlot(slot) {
  keyboardIndex = slot;
  setFrame(attend(frame, slot));
}

function currentPhrase() {
  return input?.value.trim() || DEFAULT_SPEECHES[frame.history.length % DEFAULT_SPEECHES.length];
}

function commitCurrentPhrase() {
  const phrase = currentPhrase();
  setFrame(commitSpeech(speak(frame, phrase)));
  if (input) input.value = '';
}

field.addEventListener('pointermove', (event) => {
  if (event.target === input || event.target instanceof HTMLButtonElement) return;
  attendSlot(slotAtPointer(event));
});
field.addEventListener('pointerdown', () => field.focus({ preventScroll: true }));
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    attendSlot(KEYBOARD_ORDER[(KEYBOARD_ORDER.indexOf(keyboardIndex) + 1) % KEYBOARD_ORDER.length]);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    attendSlot(KEYBOARD_ORDER[(KEYBOARD_ORDER.indexOf(keyboardIndex) - 1 + KEYBOARD_ORDER.length) % KEYBOARD_ORDER.length]);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitCurrentPhrase();
  } else if (event.key === 'Delete') {
    event.preventDefault();
    setFrame(liftLatest(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    setFrame(release());
    if (input) input.value = '';
  }
});
input.addEventListener('input', () => setFrame(speak(frame, input.value)));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  commitCurrentPhrase();
});
liftControl.addEventListener('click', () => setFrame(liftLatest(frame)));
releaseControl.addEventListener('click', () => {
  setFrame(release());
  input.value = '';
  field.focus({ preventScroll: true });
});
speakControl.addEventListener('click', () => field.focus({ preventScroll: true }));
window.addEventListener('resize', resizeCanvas);

window.__mutineHandwritingV036 = {
  getFrame: () => frame,
  getState: () => ({ lastEvent: frame.lastEvent, memory: frame.memory.length, active: frame.active, draft: frame.draft }),
  getSignature: () => geometrySignature(frame),
  attend: attendSlot,
  speak: (phrase) => setFrame(speak(frame, phrase)),
  commit: commitCurrentPhrase,
  lift: () => setFrame(liftLatest(frame)),
  reset: () => setFrame(release())
};

resizeCanvas();
window._p5Ready = true;
const animate = () => {
  render();
  animationFrame = window.requestAnimationFrame(animate);
};
animationFrame = window.requestAnimationFrame(animate);
