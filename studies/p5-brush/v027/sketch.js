import {
  ISLAND_COUNT,
  STAGES,
  applyScrape,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestScrape,
  releaseScrapes
} from './engine.mjs';

const FIELD_ID = 'fracture-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

let sketch;
let frame;
let interaction = 'baseline';
let drawing = false;
let pointerId = null;
let draftPath = [];

const palette = {
  night: [252, 30, 8],
  coral: [12, 62, 93],
  apricot: [27, 50, 97],
  lime: [70, 36, 88],
  violet: [268, 38, 82],
  pale: [42, 21, 98]
};

function fieldNode() {
  return document.getElementById(FIELD_ID);
}

function setInteraction(nextFrame, label = nextFrame.interaction || 'baseline') {
  frame = nextFrame;
  interaction = label;
  const field = fieldNode();
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.scrapeCount = String(frame.events.length);
  field.dataset.stage = String(frame.stage);
  field.dataset.fractureLoad = String(frame.fractureLoad);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} scrape${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) {
    const messages = {
      baseline: 'The islands are holding their residue.',
      'scrape-committed': 'The scrape broke the population; residue returned elsewhere.',
      'scrape-refused': 'The material refuses that scrape.',
      'scrape-lifted': 'The latest fracture has been lifted; the prior bodies return.',
      'memory-released': 'The population has released its remembered residue.'
    };
    stateNode.textContent = messages[label] || messages.baseline;
  }
}

function nextScrape() {
  const paths = [
    { points: [{ x: 0.12, y: 0.76 }, { x: 0.32, y: 0.57 }, { x: 0.62, y: 0.36 }], pressure: 0.68 },
    { points: [{ x: 0.82, y: 0.76 }, { x: 0.63, y: 0.58 }, { x: 0.4, y: 0.48 }], pressure: 0.52 },
    { points: [{ x: 0.17, y: 0.22 }, { x: 0.42, y: 0.34 }, { x: 0.7, y: 0.22 }], pressure: 0.76 },
    { points: [{ x: 0.74, y: 0.3 }, { x: 0.56, y: 0.42 }, { x: 0.28, y: 0.22 }], pressure: 0.61 }
  ];
  return paths[frame.memory.length % paths.length];
}

function commitScrape(scrape, source = 'keyboard-scrape') {
  setInteraction(applyScrape(frame, scrape, source));
}

function lift() {
  setInteraction(liftLatestScrape(frame));
}

function release() {
  setInteraction(releaseScrapes(frame));
}

function exportCanvas() {
  if (sketch) sketch.saveCanvas('mutine-brush-v027-fracture-return', 'png');
}

function resizeDraft(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function addDraftPoint(event, canvas) {
  const point = resizeDraft(event, canvas);
  const previous = draftPath.at(-1);
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.008) draftPath.push(point);
}

function finishPointer(event) {
  const eventId = event.pointerId ?? 'mouse';
  if (!drawing || (pointerId !== null && eventId !== pointerId)) return;
  const canvas = sketch?.canvas;
  if (canvas) addDraftPoint(event, canvas);
  drawing = false;
  pointerId = null;
  if (draftPath.length > 1) commitScrape({ points: draftPath, pressure: clamp(0.46 + Math.min(0.44, draftPath.length * 0.018)) }, 'pointer-scrape');
  draftPath = [];
}

function bindPointer(canvas) {
  const beginMouse = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (drawing) return;
    event.preventDefault();
    drawing = true;
    pointerId = 'mouse';
    draftPath = [];
    addDraftPoint(event, canvas);
  };
  const moveMouse = (event) => {
    if (!drawing || pointerId !== 'mouse') return;
    event.preventDefault();
    addDraftPoint(event, canvas);
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    drawing = true;
    pointerId = event.pointerId ?? 1;
    draftPath = [];
    canvas.setPointerCapture?.(pointerId);
    addDraftPoint(event, canvas);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing || (pointerId !== null && event.pointerId !== pointerId)) return;
    event.preventDefault();
    addDraftPoint(event, canvas);
  });
  canvas.addEventListener('pointerup', finishPointer);
  window.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('mousedown', beginMouse);
  canvas.addEventListener('mousemove', moveMouse);
  window.addEventListener('mouseup', finishPointer);
  canvas.addEventListener('pointercancel', () => {
    drawing = false;
    pointerId = null;
    draftPath = [];
  });
}

function bindControls(field) {
  field.querySelector('[data-gesture="scrape"]').addEventListener('click', () => commitScrape(nextScrape(), 'button-scrape'));
  field.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
  field.querySelector('[data-gesture="release"]').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitScrape(nextScrape());
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

function drawAtmosphere(p, width, height) {
  p.noStroke();
  p.background(...palette.night);
  for (let index = 0; index < 18; index += 1) {
    const x = width * (0.06 + ((index * 47) % 88) / 100);
    const y = height * (0.08 + ((index * 29) % 82) / 100);
    const radius = width * (0.04 + (index % 5) * 0.018);
    p.fill(index % 3 === 0 ? palette.violet[0] : palette.coral[0], 32, 32, 4 + (index % 4) * 2);
    p.ellipse(x, y, radius, radius * (0.52 + (index % 4) * 0.16));
  }
  p.stroke(palette.pale[0], 10, 86, 9);
  p.strokeWeight(0.7);
  for (let index = 0; index < 11; index += 1) {
    const y = height * (0.13 + index * 0.071);
    p.line(width * 0.07, y, width * 0.93, y + Math.sin(index * 1.7) * height * 0.015);
  }
}

function drawIsland(p, island, width, height, index) {
  const cx = island.x * width;
  const cy = island.y * height;
  const paletteEntry = [palette.coral, palette.apricot, palette.lime, palette.violet][index % 4];
  const hue = (paletteEntry[0] + island.returnMass * 18 + island.fracture * 7) % 360;
  const alpha = 66 + island.mass * 27;
  const size = Math.max(12, island.radius * width);

  p.push();
  p.translate(cx, cy);
  p.rotate(island.angle);
  p.noStroke();
  p.fill(hue, paletteEntry[1] * 0.72, 9, 24);
  p.ellipse(size * 0.13, size * 0.17, size * 2.2, size * 1.32);
  p.fill(hue, paletteEntry[1], paletteEntry[2], alpha);
  p.beginShape();
  for (const point of island.points) p.vertex((point.x - island.x) * width, (point.y - island.y) * height);
  p.endShape(p.CLOSE);

  if (island.fracture > 0.03) {
    p.fill((hue + 20) % 360, Math.max(18, paletteEntry[1] - 16), 98, 34 + island.fracture * 38);
    p.beginShape();
    for (let pointIndex = 0; pointIndex < island.points.length; pointIndex += 2) {
      const point = island.points[pointIndex];
      const offset = (pointIndex % 4 === 0 ? 1 : -1) * island.fracture * size * 0.18;
      p.vertex((point.x - island.x) * width + offset, (point.y - island.y) * height - offset * 0.28);
    }
    p.endShape(p.CLOSE);
    p.stroke((hue + 24) % 360, 20, 98, 48);
    p.strokeWeight(Math.max(0.7, width * 0.0008));
    for (let crack = 0; crack < 2 + Math.floor(island.fracture * 4); crack += 1) {
      const start = island.points[(crack * 3) % island.points.length];
      p.line((start.x - island.x) * width, (start.y - island.y) * height, (start.x - island.x) * width + size * 0.2 * (crack % 2 ? -1 : 1), (start.y - island.y) * height - size * 0.14);
    }
  }

  p.noStroke();
  const specks = 3 + Math.floor(island.grain * 5) + Math.floor(island.returnMass * 4);
  for (let speck = 0; speck < specks; speck += 1) {
    const point = island.points[(speck * 2 + index) % island.points.length];
    const drift = island.returnMass * size * 0.24;
    p.fill((hue + 32 + speck * 7) % 360, 28, 100, 42 + island.returnMass * 30);
    p.ellipse((point.x - island.x) * width + Math.sin(speck * 4.3) * drift, (point.y - island.y) * height + Math.cos(speck * 2.1) * drift, 1.5 + island.returnMass * 4, 1.1 + island.fracture * 3);
  }
  if (island.returnMass > 0.02) {
    p.noFill();
    p.stroke((hue + 46) % 360, 22, 100, 45 + island.returnMass * 28);
    p.strokeWeight(1.2);
    p.ellipse(0, 0, size * (1.75 + island.returnMass * 0.65), size * (1.12 + island.returnMass * 0.38));
  }
  p.pop();
}

function drawDraft(p, width, height) {
  if (!drawing || draftPath.length < 2) return;
  p.push();
  p.noFill();
  p.stroke(palette.lime[0], 22, 100, 76);
  p.strokeWeight(Math.max(1.5, width * 0.0024));
  p.beginShape();
  for (const point of draftPath) p.vertex(point.x * width, point.y * height);
  p.endShape();
  p.stroke(palette.pale[0], 12, 100, 74);
  p.strokeWeight(Math.max(0.5, width * 0.0008));
  p.beginShape();
  for (const point of draftPath) p.vertex(point.x * width, point.y * height - width * 0.004);
  p.endShape();
  p.pop();
}

function draw(p) {
  drawAtmosphere(p, p.width, p.height);
  for (let index = 0; index < frame.islands.length; index += 1) drawIsland(p, frame.islands[index], p.width, p.height, index);
  drawDraft(p, p.width, p.height);
  if (!reducedMotion && !staticMode) {
    p.push();
    p.noFill();
    p.stroke(palette.violet[0], 22, 92, 12);
    p.strokeWeight(1);
    const breathe = Math.sin(p.frameCount * 0.007) * 4;
    p.ellipse(p.width * 0.5, p.height * 0.47, p.width * 0.79 + breathe, p.height * 0.63 - breathe);
    p.pop();
  }
}

const sketchDefinition = (p) => {
  sketch = p;
  p.setup = () => {
    const field = fieldNode();
    const renderer = p.createCanvas(1200, 800);
    renderer.parent(field);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noStroke();
    const settled = buildTimeline(STAGES).at(-1);
    frame = reducedMotion || staticMode ? settled : buildFrame(0, []);
    setInteraction(frame, 'baseline');
    bindPointer(p.canvas);
    bindControls(field);
    window.__mutineBrushV027 = {
      getState: () => ({
        stage: frame.stage,
        memory: frame.memory.length,
        scrapes: frame.memory.map((event) => ({ ...event })),
        signature: geometrySignature(frame),
        interaction,
        grammar: frame.grammar,
        islandCount: frame.islands.length,
        fracturedCount: frame.islands.filter((island) => island.fracture > 0.03).length,
        returnedCount: frame.islands.filter((island) => island.returnMass > 0.03).length,
        lastScrape: frame.lastScrape
      }),
      getFrame: () => frame
    };
    window.__mutineBrushV027Ready = true;
  };
  p.draw = () => draw(p);
  p.windowResized = () => {
    const field = fieldNode();
    const width = Math.max(320, Math.min(1200, field.clientWidth));
    p.resizeCanvas(width, Math.round(width * 2 / 3));
  };
};

new p5(sketchDefinition);
