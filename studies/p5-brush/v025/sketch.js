import {
  COLUMN_COUNT,
  ROW_COUNT,
  STAGES,
  applyHinge,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestHinge,
  releaseHinges
} from './engine.mjs';

const FIELD_ID = 'membrane-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

let sketch;
let frame;
let renderer;
let frameIndex = 0;
let interaction = 'baseline';

function setInteraction(nextFrame, label = nextFrame.interaction || 'baseline') {
  frame = nextFrame;
  interaction = label;
  const field = document.getElementById(FIELD_ID);
  const signature = geometrySignature(frame);
  field.dataset.signature = signature;
  field.dataset.memory = String(frame.memory.length);
  field.dataset.hingeCount = String(frame.hinges.length);
  field.dataset.stage = String(frame.stage);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} hinge${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) {
    const messages = {
      baseline: 'The membrane is hanging under its own weight.',
      'hinge-committed': 'A seam has become a hinge; the lower mass has folded inward.',
      'hinge-refused': 'The same seam refuses to take the same weight twice.',
      'hinge-lifted': 'The latest fold has been lifted; the preceding membrane returns.',
      'field-released': 'The membrane has released its remembered weight.'
    };
    stateNode.textContent = messages[label] || messages.baseline;
  }
}

function nextHinge() {
  const count = frame.memory.length;
  const row = 1 + ((count * 3 + 2) % (ROW_COUNT - 2));
  const side = count % 2 === 0 ? 'left' : 'right';
  return { row, side };
}

function commitNext(source = 'keyboard-hinge') {
  const hinge = nextHinge();
  setInteraction(applyHinge(frame, hinge.row, hinge.side, source));
}

function lift() {
  setInteraction(liftLatestHinge(frame));
}

function release() {
  setInteraction(releaseHinges(frame));
}

function meshPosition(node, width, height) {
  return {
    x: (node.x - 0.5) * width * 0.78,
    y: (node.y - 0.5) * height * 0.76,
    z: node.z * height * 0.84
  };
}

function drawBackdrop(p, width, height) {
  p.push();
  p.translate(0, 0, -height * 0.76);
  p.noStroke();
  p.fill(222, 18, 8, 100);
  p.rect(-width / 2, -height / 2, width, height);
  p.fill(188, 28, 12, 18);
  p.ellipse(width * 0.12, -height * 0.08, width * 0.62, height * 0.92);
  p.fill(174, 35, 13, 13);
  p.ellipse(-width * 0.24, height * 0.22, width * 0.38, height * 0.48);
  p.pop();
}

function drawMembrane(p, width, height) {
  const palette = [27, 34, 41, 48, 55, 162, 170, 178];
  p.push();
  p.rotateX(-0.11);
  p.rotateY(Math.sin(p.frameCount * 0.006) * (reducedMotion ? 0 : 0.035));
  p.translate(0, height * 0.01, 0);
  p.ambientMaterial(40, 37, 28);
  p.strokeWeight(0.7);

  for (let row = 0; row < ROW_COUNT - 1; row += 1) {
    const hue = palette[row % palette.length];
    p.fill(hue, row < 5 ? 56 : 42, row < 5 ? 87 : 70, 78);
    p.stroke(hue + 10, 40, 96, 44);
    p.beginShape(p.TRIANGLE_STRIP);
    for (let column = 0; column < COLUMN_COUNT; column += 1) {
      const upper = meshPosition(frame.nodes[row][column], width, height);
      const lower = meshPosition(frame.nodes[row + 1][column], width, height);
      p.vertex(upper.x, upper.y, upper.z);
      p.vertex(lower.x, lower.y, lower.z);
    }
    p.endShape();
  }

  p.noFill();
  p.stroke(46, 24, 100, 54);
  p.strokeWeight(1.25);
  for (let column = 0; column < COLUMN_COUNT; column += 2) {
    p.beginShape();
    for (let row = 0; row < ROW_COUNT; row += 1) {
      const position = meshPosition(frame.nodes[row][column], width, height);
      p.vertex(position.x, position.y, position.z + 3);
    }
    p.endShape();
  }

  p.stroke(175, 30, 92, 65);
  p.strokeWeight(2.4);
  for (const hinge of frame.hinges) {
    const row = frame.nodes[hinge.row];
    p.beginShape();
    for (const node of row) {
      const position = meshPosition(node, width, height);
      p.vertex(position.x, position.y, position.z + 7);
    }
    p.endShape();
  }

  p.strokeWeight(1.8);
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let column = 0; column < COLUMN_COUNT; column += 2) {
      const node = frame.nodes[row][column];
      const position = meshPosition(node, width, height);
      p.stroke(node.fold > 0.1 ? 178 : 42, node.fold > 0.1 ? 42 : 18, 95, node.fold > 0.1 ? 62 : 38);
      p.point(position.x, position.y, position.z + 9);
    }
  }
  p.pop();
}

function draw(p) {
  const width = p.width;
  const height = p.height;
  p.background(222, 18, 7);
  p.ortho(-width / 2, width / 2, -height / 2, height / 2, -2000, 2000);
  p.ambientLight(70, 66, 58);
  p.directionalLight(255, 215, 165, -0.25, 0.4, -1);
  p.directionalLight(120, 190, 182, 0.45, -0.15, -0.8);
  drawBackdrop(p, width, height);
  drawMembrane(p, width, height);
}

function pointerHinge(p) {
  const x = clamp(p.mouseX / p.width);
  const y = clamp(p.mouseY / p.height);
  const row = Math.min(ROW_COUNT - 2, Math.max(1, Math.floor(y * (ROW_COUNT - 1))));
  const side = x < 0.5 ? 'left' : 'right';
  setInteraction(applyHinge(frame, row, side, 'pointer-hinge'));
}

function exportCanvas() {
  if (sketch) sketch.saveCanvas('mutine-brush-v025-hanging-membrane', 'png');
}

function bindControls(field) {
  field.querySelector('[data-gesture="hinge"]').addEventListener('click', () => commitNext('button-hinge'));
  field.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
  field.querySelector('[data-gesture="release"]').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitNext('keyboard-hinge');
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
    renderer = p.createCanvas(1200, 700, p.WEBGL);
    renderer.parent(field);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noStroke();
    const settled = buildTimeline(STAGES).at(-1);
    frame = reducedMotion ? settled : buildFrame(0, []);
    setInteraction(frame, 'baseline');
    bindControls(field);
    window.__mutineBrushV025 = {
      getState: () => ({
        stage: frame.stage,
        memory: frame.memory.length,
        hinges: frame.hinges.map((hinge) => ({ ...hinge })),
        signature: geometrySignature(frame),
        interaction,
        grammar: frame.grammar,
        nodeCount: frame.nodes.flat().length,
        foldedNodeCount: frame.nodes.flat().filter((node) => node.fold > 0).length
      }),
      getFrame: () => frame
    };
    window.__mutineBrushV025Ready = true;
  };
  p.draw = () => draw(p);
  p.mousePressed = (event) => {
    if (event?.target !== p.canvas) return true;
    if (p.mouseY >= 0 && p.mouseY <= p.height && p.mouseX >= 0 && p.mouseX <= p.width) pointerHinge(p);
    return false;
  };
  p.windowResized = () => {
    const field = document.getElementById(FIELD_ID);
    const width = Math.max(320, Math.min(1200, field.clientWidth));
    p.resizeCanvas(width, Math.round(width * 7 / 12));
  };
};

new p5(sketchDefinition);
