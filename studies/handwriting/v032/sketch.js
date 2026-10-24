import {
  CADENCE_LENGTH,
  GLYPH_COUNT,
  buildFrame,
  commitCadence,
  geometrySignature,
  liftLatestCadence,
  nearestGlyph,
  recordBeat,
  releaseCadence
} from './engine.mjs';

const DEFAULT_CADENCES = [[1, 6, 10], [3, 8, 0], [5, 2, 11], [4, 9, 7]];
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#cadence-field');
const mount = document.querySelector('#canvas-mount');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const commitControl = document.querySelector('#commit-cadence');
const liftControl = document.querySelector('#lift-cadence');
const releaseControl = document.querySelector('#release-cadence');

let currentFrame = staticPreview ? buildFrame(DEFAULT_CADENCES) : buildFrame([]);
let lastState = staticPreview ? 'cadence' : 'quiet';
let deterministicIndex = 0;
let scoreCanvas;
let paperLayer;
let inkLayer;

function scorePoints(frame, width, height) {
  return frame.glyphs.map((glyph) => ({ id: glyph.id, x: glyph.x * width, y: glyph.y * height }));
}

function drawPaper(p, layer, width, height) {
  layer.clear();
  layer.noStroke();
  layer.fill(255, 250, 239, 80);
  layer.rect(0, 0, width, height);
  p.randomSeed(32032);
  for (let index = 0; index < 260; index += 1) {
    const x = p.random(width);
    const y = p.random(height);
    const size = p.random(.25, 1.6);
    const tone = index % 3 === 0 ? [173, 79, 62, 25] : [32, 40, 47, 18];
    layer.fill(...tone);
    layer.ellipse(x, y, size, size);
  }
  layer.stroke(32, 40, 47, 26);
  layer.strokeWeight(1);
  layer.line(width * .035, height * .055, width * .97, height * .025);
  layer.line(width * .04, height * .95, width * .96, height * .91);
  for (let index = 0; index < 3; index += 1) {
    const x = width * [.16, .5, .83][index];
    layer.stroke(53, 94, 114, 28);
    layer.line(x, height * .08, x + width * (index === 1 ? .008 : -.006), height * .9);
  }
}

function drawScore(p, layer, frame, width, height) {
  layer.clear();
  const unit = Math.min(width, height);
  const glyphSize = unit * .22;
  layer.textFont('Arial Narrow, Arial, sans-serif');
  layer.textAlign(p.CENTER, p.CENTER);
  layer.textStyle(p.NORMAL);

  layer.strokeWeight(Math.max(1, unit * .002));
  layer.stroke(32, 40, 47, 26);
  for (let index = 0; index < 12; index += 1) {
    const x = width * (.1 + index / 12 * .8);
    const tickHeight = index % 3 === 0 ? height * .032 : height * .016;
    layer.line(x, height * .93, x, height * .93 + tickHeight);
  }
  layer.stroke(173, 79, 62, 85);
  layer.line(width * .1, height * .93, width * .9, height * .93);

  frame.glyphs.forEach((glyph, index) => {
    const x = glyph.x * width;
    const y = glyph.y * height + glyph.baselineShift * unit * .018;
    const size = glyphSize * glyph.scale;
    const roleColor = glyph.role === 'echo' ? [173, 79, 62] : glyph.role === 'afterbeat' ? [53, 94, 114] : [32, 40, 47];
    const alpha = glyph.role === 'quiet' ? 220 : 242;
    layer.push();
    layer.translate(x, y);
    layer.rotate(glyph.rotation * Math.PI / 180);
    if (glyph.blank) {
      layer.noFill();
      layer.stroke(173, 79, 62, 190);
      layer.strokeWeight(Math.max(1.5, unit * .004));
      layer.rectMode(p.CENTER);
      layer.rect(0, 0, size * .55, size * .82);
      layer.stroke(53, 94, 114, 100);
      layer.strokeWeight(Math.max(1, unit * .0015));
      layer.line(-size * .25, size * .32, size * .25, -size * .32);
    } else {
      layer.textSize(size);
      layer.stroke(245, 240, 229, 160);
      layer.strokeWeight(Math.max(1, unit * .004 * glyph.weight));
      layer.fill(...roleColor, alpha);
      layer.text(glyph.glyph, 0, 0);
      if (glyph.role === 'echo') {
        layer.noFill();
        layer.stroke(173, 79, 62, 135);
        layer.strokeWeight(Math.max(1, unit * .0018));
        layer.text(glyph.glyph, size * .055, -size * .035);
      }
    }
    layer.pop();

    const labelX = x + Math.cos(glyph.rotation * Math.PI / 180) * size * .43;
    const labelY = y + Math.sin(glyph.rotation * Math.PI / 180) * size * .43 + unit * .055;
    layer.noStroke();
    layer.fill(109, 116, 111, glyph.role === 'quiet' ? 135 : 210);
    layer.textFont('ui-monospace, monospace');
    layer.textSize(Math.max(8, unit * .018));
    layer.text(String(index + 1).padStart(2, '0'), labelX, labelY);
  });

  frame.beats.forEach((glyphId, index) => {
    const glyph = frame.glyphs[glyphId];
    const x = glyph.x * width;
    const y = glyph.y * height;
    layer.noFill();
    layer.stroke(index === 0 ? [173, 79, 62] : index === 1 ? [179, 148, 75] : [53, 94, 114]);
    layer.strokeWeight(Math.max(1.5, unit * .003));
    layer.ellipse(x, y, unit * (.13 + index * .018), unit * (.13 + index * .018));
  });
}

function render(p) {
  if (!paperLayer || !inkLayer) return;
  drawPaper(p, paperLayer, p.width, p.height);
  drawScore(p, inkLayer, currentFrame, p.width, p.height);
  p.image(paperLayer, 0, 0);
  p.image(inkLayer, 0, 0);
}

function updateUi(frame, state = 'quiet', p) {
  currentFrame = frame;
  lastState = state;
  const stateLabel = state === 'beating'
    ? `cadence / ${frame.beats.length} of ${CADENCE_LENGTH}`
    : state === 'cadence'
      ? `score / committed ${String(frame.history.length).padStart(2, '0')}`
      : state === 'refused'
        ? 'cadence / refused'
        : state === 'lifted'
          ? 'score / latest lifted'
          : state === 'released'
            ? 'score / released'
            : 'score / quiet';
  if (stageReadout) stageReadout.textContent = stateLabel;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} cadences · ${GLYPH_COUNT} letters`;
  if (interactionState) {
    interactionState.textContent = state === 'beating'
      ? `${frame.beats.length} beat${frame.beats.length === 1 ? '' : 's'} heard. The letters remain exact.`
      : state === 'cadence'
        ? 'The cadence answered at a distance: an echo, a silence, and an afterbeat now carry it.'
        : state === 'refused'
          ? 'The score stayed inert. Three distinct beats must arrive inside one short rhythm.'
          : state === 'lifted'
            ? 'The latest cadence is gone. The preceding score is exact again.'
            : state === 'released'
              ? 'The cadence memory is released. Every letter is quiet again.'
              : 'The score is quiet. No beat has been heard.';
  }
  field.dataset.stage = state;
  field.dataset.beats = frame.beats.join(',');
  field.dataset.memory = String(frame.memory.length);
  field.dataset.signature = geometrySignature(frame);
  liftControl.disabled = staticPreview || frame.memory.length === 0;
  commitControl.disabled = staticPreview;
  releaseControl.disabled = staticPreview;
  render(p);
}

function beatAtPoint(p, clientX, clientY) {
  const rect = scoreCanvas.elt.getBoundingClientRect();
  const point = { x: clientX - rect.left, y: clientY - rect.top };
  return nearestGlyph(scorePoints(currentFrame, p.width, p.height), point, Math.max(22, Math.min(p.width, p.height) * .09));
}

function record(index, at, p) {
  if (staticPreview || index < 0) return false;
  const next = recordBeat(currentFrame, index, at);
  if (next.lastEvent === 'refused') {
    updateUi(next, 'refused', p);
    return false;
  }
  updateUi(next, 'beating', p);
  if (next.beats.length === CADENCE_LENGTH) finish(p);
  return true;
}

function finish(p) {
  if (staticPreview) return false;
  const next = commitCadence(currentFrame);
  const committed = next.lastEvent === 'cadence';
  updateUi(next, committed ? 'cadence' : 'refused', p);
  return committed;
}

function playDefault(p) {
  if (staticPreview) return false;
  const cadence = DEFAULT_CADENCES[deterministicIndex % DEFAULT_CADENCES.length];
  deterministicIndex += 1;
  const times = [0, 260, 560];
  let next = { ...currentFrame, beats: [], beatTimes: [] };
  cadence.forEach((id, index) => { next = recordBeat(next, id, times[index]); });
  updateUi(next, 'beating', p);
  return finish(p);
}

function lift(p) {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  updateUi(liftLatestCadence(currentFrame), 'lifted', p);
  return true;
}

function release(p) {
  if (staticPreview) return false;
  updateUi(releaseCadence(), 'released', p);
  return true;
}

function handleKey(event, p) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    playDefault(p);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift(p);
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release(p);
  }
}

const sketch = (p) => {
  p.setup = () => {
    const width = Math.max(260, mount.clientWidth);
    const height = Math.max(220, mount.clientHeight);
    p.pixelDensity(1);
    scoreCanvas = p.createCanvas(width, height, p.P2D);
    scoreCanvas.id('cadence-canvas');
    scoreCanvas.parent(mount);
    paperLayer = p.createGraphics(width, height);
    inkLayer = p.createGraphics(width, height);
    p.noLoop();
    p.textFont('Arial Narrow, Arial, sans-serif');
    updateUi(currentFrame, lastState, p);
    scoreCanvas.elt.addEventListener('pointerdown', (event) => {
      if (staticPreview) return;
      field.focus({ preventScroll: true });
      const index = beatAtPoint(p, event.clientX, event.clientY);
      if (index >= 0) record(index, p.millis(), p);
    });
    field.addEventListener('keydown', (event) => handleKey(event, p));
    commitControl.addEventListener('click', () => playDefault(p));
    liftControl.addEventListener('click', () => lift(p));
    releaseControl.addEventListener('click', () => release(p));
    window._p5Ready = true;
    window.__mutineHandwritingV032 = {
      getState: () => ({ memory: currentFrame.memory.length, beats: [...currentFrame.beats], changedGlyphIds: [...currentFrame.changedGlyphIds], lastEvent: currentFrame.lastEvent, interaction: lastState }),
      getSignature: () => geometrySignature(currentFrame),
      recordBeat: (glyphId, at) => record(glyphId, at ?? p.millis(), p),
      commitDefault: () => playDefault(p),
      liftLatest: () => lift(p),
      release: () => release(p),
      getFrame: () => currentFrame
    };
  };

  p.draw = () => render(p);

  p.windowResized = () => {
    if (!scoreCanvas) return;
    const width = Math.max(260, mount.clientWidth);
    const height = Math.max(220, mount.clientHeight);
    p.resizeCanvas(width, height);
    paperLayer = p.createGraphics(width, height);
    inkLayer = p.createGraphics(width, height);
    p.redraw();
  };
};

new p5(sketch, 'canvas-mount');
