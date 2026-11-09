import {
  LETTER_COUNT,
  buildTimeline,
  attendLetter,
  commitAttention,
  geometrySignature,
  liftLatest,
  releaseArchive
} from './engine.mjs';

const field = document.querySelector('#attendance-field');
const canvas = document.querySelector('#attendance-canvas');
const context = canvas.getContext('2d');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateText = document.querySelector('#interaction-state');
const interactionState = document.querySelector('[data-interaction-state]');
const buttons = [...document.querySelectorAll('[data-action]')];
const staticMode = document.documentElement.classList.contains('static-mode');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let frame = staticMode ? buildTimeline().at(-1) : releaseArchive();
let width = 1;
let height = 1;
let density = 1;
let keyboardCursor = 0;
let animationFrame = 0;

const px = (value) => value * width;
const py = (value) => value * height;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function resizeCanvas() {
  const rect = field.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  density = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(density, 0, 0, density, 0, 0);
  draw(performance.now());
}

function drawBackground(time) {
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * .18, height * .2, 0, width * .18, height * .2, width * .64);
  glow.addColorStop(0, 'rgba(155,140,255,.16)');
  glow.addColorStop(1, 'rgba(155,140,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const warm = context.createRadialGradient(width * .83, height * .78, 0, width * .83, height * .78, width * .56);
  warm.addColorStop(0, 'rgba(240,116,99,.13)');
  warm.addColorStop(1, 'rgba(240,116,99,0)');
  context.fillStyle = warm;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = 'rgba(238,229,213,.055)';
  context.lineWidth = 1;
  for (let column = .08; column < 1; column += .08) {
    context.beginPath();
    context.moveTo(px(column), py(.11));
    context.lineTo(px(column), py(.87));
    context.stroke();
  }
  for (let row = .16; row < .9; row += .11) {
    context.beginPath();
    context.moveTo(px(.08), py(row));
    context.lineTo(px(.92), py(row));
    context.stroke();
  }

  const pulse = reducedMotion || staticMode ? 0 : Math.sin(time * .00038) * .006;
  context.strokeStyle = 'rgba(127,209,193,.2)';
  context.setLineDash([1, 10]);
  context.beginPath();
  context.moveTo(px(.08), py(.11 + pulse));
  context.lineTo(px(.92), py(.11 + pulse));
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = 'rgba(238,229,213,.28)';
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 0.173 + .04) % .92 + .04;
    const y = (index * 0.293 + .08) % .82 + .08;
    const radius = (index % 3 === 0 ? 1.4 : .7);
    context.beginPath();
    context.arc(px(x), py(y), radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawQuietMarkers() {
  context.save();
  context.strokeStyle = 'rgba(127,209,193,.43)';
  context.lineWidth = 1;
  for (const y of [.30, .52, .74]) {
    context.beginPath();
    context.moveTo(px(.115), py(y + .075));
    context.lineTo(px(.885), py(y + .075));
    context.stroke();
  }
  context.strokeStyle = 'rgba(240,116,99,.62)';
  context.setLineDash([2, 7]);
  context.beginPath();
  context.moveTo(px(.12), py(.14));
  context.lineTo(px(.12), py(.82));
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawReadingAxis() {
  const lettersById = new Map(frame.field.letters.map((letter) => [letter.id, letter]));
  const path = frame.field.readingPath.map((id) => lettersById.get(id));
  if (frame.field.layout !== 'collective-axis' || path.length < 2) return;
  context.save();
  context.strokeStyle = 'rgba(127,209,193,.35)';
  context.lineWidth = Math.max(1, width * .0012);
  context.setLineDash([2, 9]);
  context.beginPath();
  context.moveTo(px(path[0].x), py(path[0].y + .075));
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const middleX = (px(previous.x) + px(current.x)) / 2;
    const middleY = (py(previous.y + .075) + py(current.y + .075)) / 2;
    context.quadraticCurveTo(px(previous.x), py(previous.y + .075), middleX, middleY);
  }
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = 'rgba(240,116,99,.7)';
  for (const letter of path.slice(0, 3)) {
    context.beginPath();
    context.arc(px(letter.x), py(letter.y + .075), Math.max(2.5, width * .006), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function letterSize(letter) {
  const base = clamp(Math.min(width * .115, height * .18), 38, 148);
  return base * letter.scale;
}

function drawLetter(letter) {
  const pending = frame.pending.includes(letter.id);
  const changed = frame.changedLetterIds.includes(letter.id);
  const size = letterSize(letter);
  const weight = letter.weight === 'heavy' ? 800 : letter.weight === 'medium' ? 560 : 420;
  context.save();
  context.translate(px(letter.x), py(letter.y));
  context.rotate(letter.angle * Math.PI / 180);
  context.scale(letter.width, 1);

  if (pending) {
    context.strokeStyle = '#f07463';
    context.lineWidth = Math.max(2, width * .003);
    context.setLineDash([3, 5]);
    context.beginPath();
    context.arc(0, 0, size * .62, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  context.shadowColor = changed ? 'rgba(127,209,193,.5)' : 'rgba(0,0,0,.58)';
  context.shadowBlur = changed ? 19 : 13;
  context.fillStyle = changed ? '#f5ead8' : '#eee5d5';
  context.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(letter.glyph, 0, 0);
  context.shadowBlur = 0;
  context.strokeStyle = pending ? '#f07463' : changed ? 'rgba(127,209,193,.84)' : 'rgba(238,229,213,.28)';
  context.lineWidth = Math.max(1, width * .0012);
  context.strokeText(letter.glyph, 0, 0);

  context.strokeStyle = changed ? '#7fd1c1' : 'rgba(240,116,99,.54)';
  context.lineWidth = Math.max(1, width * .0018);
  context.beginPath();
  context.moveTo(-size * .32, size * .43);
  context.lineTo(size * .32, size * .43);
  context.stroke();
  context.restore();
}

function draw(time = 0) {
  drawBackground(time);
  if (frame.field.layout === 'stacked-phrase') drawQuietMarkers();
  drawReadingAxis();
  for (const letter of frame.field.letters) drawLetter(letter);
}

function describeState() {
  const assemblies = frame.memory.length;
  const pending = frame.pending.length;
  const pendingText = pending ? ` ${pending} of 3 letters are held.` : ' Look at three distinct letters.';
  const accessible = assemblies
    ? `${assemblies} reading-axis assemblies remain in the phrase.${pendingText}`
    : `The phrase is quiet.${pendingText}`;
  stage.textContent = frame.pending.length ? `${frame.lastEvent} / ${pending} of 3` : frame.lastEvent;
  memoryReadout.textContent = `${assemblies} assemblies · ${LETTER_COUNT} letters`;
  stateText.textContent = accessible;
  interactionState.textContent = accessible;
}

function render() {
  describeState();
  draw(animationFrame);
}

function pointFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

function nearestLetter(point) {
  let nearest = null;
  let distance = Infinity;
  for (const letter of frame.field.letters) {
    const dx = point.x - letter.x;
    const dy = (point.y - letter.y) * (width / Math.max(height, 1));
    const nextDistance = dx * dx + dy * dy;
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = letter.id;
    }
  }
  return distance < .085 ? nearest : null;
}

function attend(id) {
  if (id === null || id === undefined || staticMode) return;
  frame = attendLetter(frame, { id });
  if (frame.pending.length === 3) frame = commitAttention(frame);
  render();
}

function assembleDeterministic() {
  if (staticMode) return;
  frame = { ...frame, pending: [] };
  [0, 6, 15].forEach((id) => { frame = attendLetter(frame, { id }); });
  frame = commitAttention(frame);
  render();
}

function handlePointerDown(event) {
  if (staticMode) return;
  field.setPointerCapture?.(event.pointerId);
  attend(nearestLetter(pointFromEvent(event)));
}

field.addEventListener('pointerdown', handlePointerDown);
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    keyboardCursor = (keyboardCursor + offset + LETTER_COUNT) % LETTER_COUNT;
    attend(keyboardCursor);
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending.length === 3) {
      frame = commitAttention(frame);
      render();
    } else {
      assembleDeterministic();
    }
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    frame = liftLatest(frame);
    render();
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    frame = releaseArchive();
    render();
  }
});

for (const button of buttons) {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'assemble') assembleDeterministic();
    if (button.dataset.action === 'lift') { frame = liftLatest(frame); render(); }
    if (button.dataset.action === 'release') { frame = releaseArchive(); render(); }
  });
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
describeState();
window.__mutineHandwritingV045 = {
  getState: () => frame,
  geometrySignature: () => geometrySignature(frame),
  attend,
  assembleDeterministic,
  lift: () => { frame = liftLatest(frame); render(); },
  release: () => { frame = releaseArchive(); render(); }
};
window._mutineReady = true;

function animate(time) {
  animationFrame = time;
  draw(time);
  if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
}
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
