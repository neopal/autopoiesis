import {
  GRID_COLS,
  GRID_ROWS,
  STAGES,
  applySqueeze,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestSqueeze,
  releaseSqueezes
} from './engine.mjs';

const FIELD_ID = 'threshold-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

let sketch;
let frame;
let interaction = 'baseline';

function setInteraction(nextFrame, label = nextFrame.interaction || 'baseline') {
  frame = nextFrame;
  interaction = label;
  const field = document.getElementById(FIELD_ID);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.squeezeCount = String(frame.events.length);
  field.dataset.stage = String(frame.stage);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} sample${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) {
    const messages = {
      baseline: 'The slab is holding its own threshold.',
      'squeeze-committed': 'The sample has recast the whole slab.',
      'squeeze-refused': 'The slab refuses the same sample twice.',
      'squeeze-lifted': 'The latest threshold has been lifted; the preceding slab returns.',
      'field-released': 'The slab has released its remembered threshold.'
    };
    stateNode.textContent = messages[label] || messages.baseline;
  }
}

function nextSample() {
  const count = frame.memory.length;
  return [0.18, 0.72, 0.34, 0.86][count % 4];
}

function commitSample(sample, source = 'keyboard-sample') {
  setInteraction(applySqueeze(frame, sample, source));
}

function lift() {
  setInteraction(liftLatestSqueeze(frame));
}

function release() {
  setInteraction(releaseSqueezes(frame));
}

function sampleFromPointer(p) {
  const x = clamp(p.mouseX / p.width);
  const y = clamp(p.mouseY / p.height);
  return clamp(x * 0.72 + (1 - y) * 0.28);
}

function drawAtmosphere(p, width, height) {
  p.noStroke();
  p.background(224, 20, 8);
  for (let index = 0; index < 13; index += 1) {
    const x = width * (0.08 + index * 0.071);
    const y = height * (0.14 + ((index * 37) % 67) / 100);
    const radius = width * (0.08 + (index % 4) * 0.025);
    p.fill(index % 3 === 0 ? 177 : 211, 30, 16, 6);
    p.ellipse(x, y, radius, radius * (0.55 + (index % 3) * 0.18));
  }
}

function panelMetrics(width, height) {
  const panelWidth = width * 0.78;
  const panelHeight = height * 0.66;
  return {
    x: (width - panelWidth) * 0.5,
    y: (height - panelHeight) * 0.5 + height * 0.015,
    width: panelWidth,
    height: panelHeight,
    cellWidth: panelWidth / GRID_COLS,
    cellHeight: panelHeight / GRID_ROWS
  };
}

function drawSlab(p, width, height) {
  const metrics = panelMetrics(width, height);
  const palette = [24, 31, 42, 186, 194, 205, 216];
  p.push();
  p.noStroke();
  p.fill(223, 24, 12, 70);
  p.rect(metrics.x - 12, metrics.y - 12, metrics.width + 24, metrics.height + 24, 7);
  p.fill(218, 18, 9, 100);
  p.rect(metrics.x, metrics.y, metrics.width, metrics.height, 4);

  for (const row of frame.cells) {
    for (const cell of row) {
      const x = metrics.x + cell.column * metrics.cellWidth + cell.shear * width * 0.08;
      const y = metrics.y + cell.row * metrics.cellHeight + cell.lift * height * 0.08;
      const w = metrics.cellWidth * (0.87 + cell.mass * 0.08);
      const h = metrics.cellHeight * (0.72 + cell.mass * 0.21);
      const hue = palette[(cell.column + cell.row * 2) % palette.length] + cell.grain * 7;
      const brightness = 40 + cell.mass * 42;
      const alpha = 36 + cell.dryness * 52;
      const skew = cell.shear * width * 0.11;
      p.fill(hue, 48 + cell.dryness * 20, brightness, alpha);
      p.beginShape();
      p.vertex(x + 2, y + 2);
      p.vertex(x + w + skew, y - 1 + cell.lift * height * 0.025);
      p.vertex(x + w - skew * 0.3, y + h + 1);
      p.vertex(x - skew * 0.4, y + h - 2);
      p.endShape(p.CLOSE);

      if (cell.dryness > 0.22) {
        p.stroke(hue + 12, 25, 94, 22 + cell.dryness * 22);
        p.strokeWeight(0.7);
        p.line(x + w * 0.18, y + h * 0.22, x + w * 0.82 + skew * 0.3, y + h * 0.74);
        p.noStroke();
      }
      if (cell.grain > 0.73) {
        p.fill(46, 20, 96, 30 + cell.dryness * 18);
        p.ellipse(x + w * 0.31, y + h * 0.38, 1.6 + cell.dryness * 3, 1.2 + cell.mass * 2);
        p.ellipse(x + w * 0.68, y + h * 0.65, 1.1 + cell.mass * 2, 1.5 + cell.dryness * 2);
      }
    }
  }

  const thresholdX = metrics.x + frame.threshold * metrics.width;
  p.stroke(43, 26, 97, 58);
  p.strokeWeight(1.3);
  p.line(thresholdX - metrics.height * 0.42, metrics.y, thresholdX + metrics.height * 0.42, metrics.y + metrics.height);
  p.stroke(184, 24, 98, 20);
  p.strokeWeight(5);
  p.line(thresholdX - metrics.height * 0.42, metrics.y, thresholdX + metrics.height * 0.42, metrics.y + metrics.height);
  p.pop();
}

function draw(p) {
  drawAtmosphere(p, p.width, p.height);
  drawSlab(p, p.width, p.height);
  if (!reducedMotion) {
    p.push();
    p.noFill();
    p.stroke(46, 18, 96, 11);
    p.strokeWeight(1);
    const breathe = Math.sin(p.frameCount * 0.006) * 3;
    p.rect(p.width * 0.1 + breathe, p.height * 0.15, p.width * 0.8 - breathe * 2, p.height * 0.7, 4);
    p.pop();
  }
}

function exportCanvas() {
  if (sketch) sketch.saveCanvas('mutine-brush-v026-threshold-slab', 'png');
}

function bindControls(field) {
  field.querySelector('[data-gesture="squeeze"]').addEventListener('click', () => commitSample(nextSample(), 'button-sample'));
  field.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
  field.querySelector('[data-gesture="release"]').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitSample(nextSample());
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      release();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      exportCanvas();
    }
  });
}

const sketchDefinition = (p) => {
  sketch = p;
  p.setup = () => {
    const field = document.getElementById(FIELD_ID);
    const renderer = p.createCanvas(1200, 800);
    renderer.parent(field);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noStroke();
    const settled = buildTimeline(STAGES).at(-1);
    frame = reducedMotion ? settled : buildFrame(0, []);
    setInteraction(frame, 'baseline');
    bindControls(field);
    window.__mutineBrushV026 = {
      getState: () => ({
        stage: frame.stage,
        memory: frame.memory.length,
        squeezes: frame.memory.map((event) => ({ ...event })),
        threshold: frame.threshold,
        signature: geometrySignature(frame),
        interaction,
        grammar: frame.grammar,
        cellCount: frame.cells.flat().length,
        drynessPeak: Math.max(...frame.cells.flat().map((cell) => cell.dryness))
      }),
      getFrame: () => frame
    };
    window.__mutineBrushV026Ready = true;
  };
  p.draw = () => draw(p);
  p.mouseClicked = (event) => {
    if (event?.target && event.target !== p.canvas) return true;
    if (p.mouseY >= 0 && p.mouseY <= p.height && p.mouseX >= 0 && p.mouseX <= p.width) commitSample(sampleFromPointer(p), 'pointer-sample');
    return false;
  };
  p.windowResized = () => {
    const field = document.getElementById(FIELD_ID);
    const width = Math.max(320, Math.min(1200, field.clientWidth));
    p.resizeCanvas(width, Math.round(width * 2 / 3));
  };
};

new p5(sketchDefinition);
