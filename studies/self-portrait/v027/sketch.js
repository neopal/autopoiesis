import {
  REGISTER_COUNT,
  STAGES,
  buildTimeline,
  selectRegister,
  commitPair,
  liftLatest,
  releaseRegisters,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3600;
const stage = document.querySelector('[data-counterportrait]');
const mount = document.querySelector('#counterportrait-canvas');
const hotspots = [...document.querySelectorAll('[data-register]')];
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let lastFrameSignature = '';
let p5Sketch = null;

const palette = {
  ground: '#090b12',
  groundWarm: '#181724',
  paper: '#e7dfca',
  paperWarm: '#cdbfa7',
  coral: '#e28a73',
  cyan: '#83cbc1',
  acid: '#d8d48b',
  violet: '#aaa0dc',
  ink: '#171821',
  deep: '#05060a'
};

const registerPositions = [
  [-0.63, -0.46], [0.36, -0.54], [-0.78, 0.12], [0.57, 0.08], [-0.28, 0.62], [0.74, 0.58]
];

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function positionHotspots() {
  hotspots.forEach((button, index) => {
    const [x, y] = registerPositions[index];
    button.style.setProperty('--x', `${(50 + x * 37).toFixed(3)}%`);
    button.style.setProperty('--y', `${(50 + y * 35).toFixed(3)}%`);
  });
}

function colorFor(register) {
  if (register.state === 'counter') return palette.cyan;
  if (register.state === 'residue') return palette.acid;
  if (register.state === 'selected') return palette.coral;
  if (register.state === 'trace') return palette.violet;
  return register.index % 2 ? palette.paperWarm : palette.paper;
}

function hexRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

function lerpColor(a, b, amount) {
  const ar = hexRgb(a);
  const br = hexRgb(b);
  const mix = ar.map((channel, index) => Math.round(channel + (br[index] - channel) * amount));
  return `rgb(${mix.join(',')})`;
}

function drawCounterportrait(p, frame, now) {
  const width = p.width;
  const height = p.height;
  const unit = Math.min(width, height);
  const seconds = now * 0.001;

  p.background(palette.ground);
  const ctx = p.drawingContext;
  const atmosphere = ctx.createRadialGradient(width * .22, height * .08, 0, width * .22, height * .08, unit * .84);
  atmosphere.addColorStop(0, 'rgba(170,160,220,.20)');
  atmosphere.addColorStop(.42, 'rgba(37,37,58,.12)');
  atmosphere.addColorStop(1, 'rgba(5,6,10,0)');
  ctx.fillStyle = atmosphere;
  ctx.fillRect(0, 0, width, height);

  p.push();
  p.translate(width / 2, height / 2);
  p.rotate(-0.055 + Math.sin(seconds * .13) * .004);
  p.noStroke();
  p.fill('rgba(238,233,223,.032)');
  p.rectMode(p.CENTER);
  p.rect(0, 0, unit * .98, unit * .72, unit * .014);
  p.pop();

  p.push();
  p.translate(width / 2, height / 2);
  p.rotate(-0.055);
  p.strokeWeight(Math.max(1, unit * .002));
  p.stroke('rgba(216,212,139,.18)');
  p.line(-unit * .37, -unit * .49, unit * .43, unit * .46);
  p.stroke('rgba(131,203,193,.12)');
  p.line(-unit * .48, unit * .3, unit * .46, -unit * .34);
  p.pop();

  frame.registers.forEach((register) => drawRegister(p, register, frame, unit, seconds));
  drawGrain(p, width, height, frame, seconds);

  const seam = frame.counterweight * unit * .06;
  p.push();
  p.translate(width / 2 + seam, height / 2);
  p.rotate(-0.055);
  p.stroke('rgba(5,6,10,.75)');
  p.strokeWeight(Math.max(2, unit * .009));
  p.line(-unit * .02, -unit * .45, unit * .025, unit * .43);
  p.stroke('rgba(238,233,223,.19)');
  p.strokeWeight(Math.max(1, unit * .0015));
  p.line(-unit * .03, -unit * .43, unit * .018, unit * .4);
  p.pop();

  p.push();
  p.noStroke();
  p.fill('rgba(238,233,223,.48)');
  for (let index = 0; index < 14; index += 1) {
    const x = (index * 83 + frame.checksum * 1.7) % width;
    const y = (index * 37 + frame.stage * 29) % height;
    p.rect(x, y, index % 3 === 0 ? 2 : 1, 1);
  }
  p.pop();
}

function drawRegister(p, register, frame, unit, seconds) {
  const x = register.x * unit * .41;
  const y = register.y * unit * .41;
  const w = register.width * unit * .54;
  const h = register.height * unit * .40;
  const pulse = Math.sin(seconds * (.18 + register.index * .025) + register.phase * 9) * unit * .004;
  const body = colorFor(register);
  const bodyDim = lerpColor(body, palette.ink, .38 + register.veil * .24);

  p.push();
  p.translate(x + pulse, y);
  p.rotate(register.angle);
  p.rectMode(p.CENTER);
  p.noStroke();
  p.fill('rgba(0,0,0,.38)');
  p.rect(unit * .018, unit * .022, w * 1.04, h * 1.06, unit * .008);
  p.fill(bodyDim);
  p.beginShape();
  p.vertex(-w * .48, -h * .36);
  p.vertex(-w * .12, -h * .5);
  p.vertex(w * .5, -h * .37);
  p.vertex(w * .43, h * .31);
  p.vertex(w * .1, h * .49);
  p.vertex(-w * .5, h * .35);
  p.endShape(p.CLOSE);
  p.fill(body);
  p.beginShape();
  p.vertex(-w * .44, -h * .39);
  p.vertex(-w * .08, -h * .46);
  p.vertex(w * .44, -h * .31);
  p.vertex(w * .36, h * .28);
  p.vertex(w * .07, h * .41);
  p.vertex(-w * .44, h * .3);
  p.endShape(p.CLOSE);

  p.stroke('rgba(23,24,33,.56)');
  p.strokeWeight(Math.max(1, unit * .0017));
  for (let lineIndex = 0; lineIndex < 7; lineIndex += 1) {
    const fraction = (lineIndex + 1) / 8;
    const wobble = Math.sin(register.phase * 13 + lineIndex * 1.7) * w * .035;
    p.line(-w * .33 + wobble, -h * .28 + h * fraction * .62, w * (.18 + register.density * .18), -h * .28 + h * fraction * .62);
  }

  const opening = Math.min(w, h) * (.1 + register.aperture * .24);
  p.noStroke();
  p.fill(palette.deep);
  p.ellipse(w * (.08 + register.veil * .11), h * (-.02 + register.scar * .04), opening * 1.35, opening * (1.7 + register.aperture));
  p.fill('rgba(238,233,223,.2)');
  p.rect(-w * .21, h * .16, w * (.07 + register.signal * .015), h * .06);
  p.fill('rgba(5,6,10,.76)');
  p.rect(w * .26, -h * .12, w * (.05 + register.scar * .08), h * .32);

  if (register.state === 'counter') {
    p.noFill();
    p.stroke(palette.cyan);
    p.strokeWeight(Math.max(1, unit * .003));
    p.arc(-w * .03, 0, opening * 2.8, opening * 2.8, -1.3, 1.8);
  }
  if (register.state === 'residue') {
    p.stroke(palette.acid);
    p.strokeWeight(Math.max(1, unit * .002));
    for (let mark = 0; mark < 5; mark += 1) {
      p.line(-w * .35 + mark * w * .13, -h * .38, -w * .17 + mark * w * .13, h * .32);
    }
  }
  p.pop();
}

function drawGrain(p, width, height, frame, seconds) {
  p.push();
  p.strokeWeight(1);
  for (let index = 0; index < 480; index += 1) {
    const x = (index * 47 + frame.stage * 11) % width;
    const y = (index * 91 + frame.checksum * 3) % height;
    const alpha = 10 + ((index * 17) % 22);
    p.stroke(`rgba(238,233,223,${alpha / 255})`);
    p.point(x, y + Math.sin(seconds * .08 + index) * .3);
  }
  p.pop();
}

function paint(frame, now = performance.now()) {
  currentFrame = frame;
  updateInterface(frame);
  if (p5Sketch) drawCounterportrait(p5Sketch, frame, now);
}

function updateInterface(frame) {
  const pending = frame.pendingRegisters;
  hotspots.forEach((button, index) => button.classList.toggle('is-offered', pending.includes(index)));
  if (stageReadout) stageReadout.textContent = frame.interaction === 'counter-reading' ? 'counter-reading opened' : frame.interaction === 'pair-refused' ? 'one register is not enough' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} counter-reading${frame.memory.length === 1 ? '' : 's'} held`;
  if (hint) hint.textContent = pending.length === 0 ? 'offer two registers; the third decides' : pending.length === 1 ? 'one offered; add a different register' : 'pair offered; ask the portrait';
  if (stateReadout) stateReadout.textContent = frame.interaction === 'counter-reading'
    ? `The pair was refused as an answer. Register ${frame.memory.at(-1).counterIndex + 1} opened instead.`
    : frame.interaction === 'pair-refused'
      ? 'A solitary register cannot make the portrait answer.'
      : pending.length === 0
        ? 'The portrait is waiting for two registers.'
        : pending.length === 1
          ? `Register ${pending[0] + 1} is offered. Add one more.`
          : 'Two registers are offered. Ask the portrait to answer elsewhere.';
  if (stage) {
    stage.dataset.stage = String(frame.stage);
    stage.dataset.memory = String(frame.memory.length);
    stage.dataset.interaction = frame.interaction;
    stage.dataset.signature = geometrySignature(frame);
  }
}

function baseForInteraction() { return interactionFrame ?? activeFrameAt(); }

function offer(index) {
  if (staticPreview || blindMode) return;
  interactionFrame = selectRegister(baseForInteraction(), index);
  paint(interactionFrame);
  hotspots[index]?.focus();
}

function commit() {
  if (staticPreview || blindMode) return;
  interactionFrame = commitPair(baseForInteraction());
  paint(interactionFrame);
}

function lift() {
  if (staticPreview || blindMode) return;
  interactionFrame = liftLatest(baseForInteraction());
  paint(interactionFrame);
}

function release() {
  if (staticPreview || blindMode) return;
  interactionFrame = frozen ? releaseRegisters(0) : null;
  startedAt = performance.now();
  paint(interactionFrame ?? timeline[0]);
}

function saveState() {
  const payload = JSON.stringify({ version: 'v027', signature: geometrySignature(currentFrame), frame: currentFrame }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = 'mutine-self-portrait-v027-state.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function attachInteractions() {
  if (!stage || staticPreview || blindMode) return;
  hotspots.forEach((button) => button.addEventListener('click', () => offer(Number(button.dataset.register))));
  actionButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'commit') commit();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  }));
  stage.addEventListener('keydown', (event) => {
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= REGISTER_COUNT) {
      event.preventDefault();
      offer(digit - 1);
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
}

window.__mutinePortraitV027 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    interaction: currentFrame.interaction,
    pendingRegisters: currentFrame.pendingRegisters.slice(),
    pair: currentFrame.memory.at(-1)?.pair ?? null,
    counterIndex: currentFrame.memory.at(-1)?.counterIndex ?? null,
    residueIndex: currentFrame.memory.at(-1)?.residueIndex ?? null,
    signature: geometrySignature(currentFrame),
    registerStates: currentFrame.registers.map((register) => register.state),
    checksum: currentFrame.checksum,
    interactive: interactivePreview || !staticPreview,
    blind: blindMode
  }),
  getFrame: () => currentFrame,
  offer,
  submit: commit,
  commit,
  lift,
  release,
  save: saveState,
  requestRender: () => paint(currentFrame)
};

positionHotspots();
attachInteractions();

if (window.p5) {
  new window.p5((p) => {
    p5Sketch = p;
    p.setup = () => {
      const rect = mount.getBoundingClientRect();
      p.pixelDensity(1);
      p.createCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
      p.noStroke();
      p5Sketch = p;
      window._p5Ready = true;
      paint(frozen ? timeline.at(-1) : currentFrame);
    };
    p.draw = () => {
      const frame = activeFrameAt(performance.now());
      if (!interactionFrame) paint(frame, performance.now());
      else drawCounterportrait(p, interactionFrame, performance.now());
    };
    p.windowResized = () => {
      const rect = mount.getBoundingClientRect();
      p.resizeCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
      paint(currentFrame);
    };
  }, mount);
} else {
  stage?.setAttribute('data-renderer-error', 'p5-unavailable');
  window._p5Ready = true;
}
