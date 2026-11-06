import {
  CHOICE_LIMIT,
  MEMORY_LIMIT,
  PANEL_COUNT,
  SEED,
  buildField,
  buildTimeline,
  choosePanel,
  commitContradiction,
  geometrySignature,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field = staticMode ? buildTimeline().at(-1) : buildField();
let selectedPanel = 0;
let renderer;
let backgroundLayer;
let pointerActive = false;

const stageNode = document.querySelector('[data-refusal-stage]');
const hostNode = document.querySelector('[data-refusal-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

const stateText = (stage) => ({
  'quiet register': 'the portrait is withholding an answer',
  'choice held': 'a choice is held without a mark',
  'refused / incomplete': 'the register refused an incomplete proposition',
  'refused / agreement': 'agreement makes no new portrait',
  'split / elsewhere': 'the contradiction split an unchosen panel',
  'lifted / exact': 'the last split was lifted exactly'
}[stage] ?? 'the register is deciding');

function renderStatus(stage = field.interaction) {
  readoutNode.textContent = `${stage} / ${String(field.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${field.memory.length} split${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.choices.length
    ? `${field.choices.length} / ${CHOICE_LIMIT} choices held · choose another panel`
    : 'select a panel · choose a side · commit the contradiction';
}

function stagePoint(event) {
  const rect = stageNode.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function panelPosition(panel) {
  const width = renderer?.width ?? hostNode.clientWidth;
  const height = renderer?.height ?? hostNode.clientHeight;
  return {
    x: width * (0.5 + panel.x * 0.69),
    y: height * (0.47 + panel.y * 0.52)
  };
}

function nearestPanel(point) {
  let best = selectedPanel;
  let bestDistance = Infinity;
  for (const panel of field.panels) {
    const position = panelPosition(panel);
    const dx = position.x - point.x;
    const dy = position.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = panel.index;
    }
  }
  return best;
}

function selectPanel(index) {
  selectedPanel = (index + PANEL_COUNT) % PANEL_COUNT;
  field = { ...field, interaction: field.choices.length ? 'choice held' : 'panel selected' };
  renderStatus(field.choices.length ? 'choice held' : 'quiet register');
  stageNode.focus({ preventScroll: true });
}

function choose(side) {
  if (staticMode) return field;
  field = choosePanel(field, selectedPanel, side);
  renderStatus('choice held');
  stageNode.focus({ preventScroll: true });
  return field;
}

function commit() {
  if (staticMode) return { accepted: false, field };
  const result = commitContradiction(field);
  field = result.field;
  renderStatus(result.accepted ? 'split / elsewhere' : result.field.interaction);
  stageNode.focus({ preventScroll: true });
  return result;
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  renderStatus('lifted / exact');
  stageNode.focus({ preventScroll: true });
  return field;
}

function release() {
  if (staticMode) return field;
  selectedPanel = 0;
  field = releaseField();
  renderStatus('quiet register');
  stageNode.focus({ preventScroll: true });
  return field;
}

function cycle(direction) {
  selectPanel(selectedPanel + direction);
}

function onPointerDown(event) {
  if (staticMode || event.target.closest('.refusal-controls')) return;
  event.preventDefault();
  pointerActive = true;
  selectPanel(nearestPanel(stagePoint(event)));
}

function onPointerUp(event) {
  if (staticMode || !pointerActive || event.target.closest('.refusal-controls')) return;
  event.preventDefault();
  pointerActive = false;
  stageNode.focus({ preventScroll: true });
}

stageNode.addEventListener('pointerdown', onPointerDown);
stageNode.addEventListener('pointerup', onPointerUp);
stageNode.addEventListener('pointercancel', onPointerUp);
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') { event.preventDefault(); cycle(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); cycle(-1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); choose('left'); }
  if (event.key === 'ArrowDown') { event.preventDefault(); choose('right'); }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape') { event.preventDefault(); release(); }
});

document.querySelector('[data-action="choose-left"]').addEventListener('click', () => choose('left'));
document.querySelector('[data-action="choose-right"]').addEventListener('click', () => choose('right'));
document.querySelector('[data-action="commit"]').addEventListener('click', commit);
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', release);

function createBackdrop(p) {
  backgroundLayer = p.createGraphics(p.width, p.height);
  backgroundLayer.pixelDensity(1);
  const ctx = backgroundLayer.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, p.width, p.height);
  gradient.addColorStop(0, '#282c4b');
  gradient.addColorStop(.46, '#20243a');
  gradient.addColorStop(1, '#151927');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, p.width, p.height);
  backgroundLayer.noFill();
  backgroundLayer.stroke(276, 32, 91, 12);
  backgroundLayer.strokeWeight(1);
  for (let i = -8; i < 18; i += 1) {
    const x = i * p.width / 11;
    backgroundLayer.bezier(x, 0, x + p.width * .08, p.height * .27, x - p.width * .1, p.height * .68, x + p.width * .15, p.height);
  }
  backgroundLayer.stroke(48, 43, 93, 10);
  for (let i = 0; i < 18; i += 1) {
    const y = p.height * (.08 + i * .06);
    backgroundLayer.line(0, y, p.width, y + p.width * .025);
  }
  p.randomSeed(SEED);
  for (let i = 0; i < Math.floor((p.width * p.height) / 7200); i += 1) {
    const x = p.random(p.width);
    const y = p.random(p.height);
    backgroundLayer.stroke(i % 4 === 0 ? 28 : 276, i % 4 === 0 ? 58 : 22, i % 4 === 0 ? 95 : 78, 12);
    backgroundLayer.point(x, y);
  }
}

function drawSpine(p) {
  const w = p.width;
  const h = p.height;
  p.push();
  p.translate(0, h * .47);
  p.stroke(43, 25, 93, 48);
  p.strokeWeight(Math.max(1, Math.min(2.4, w / 500)));
  p.line(w * .055, 0, w * .945, 0);
  p.stroke(276, 38, 95, 26);
  p.line(w * .055, 4, w * .945, 4);
  for (let i = 0; i < PANEL_COUNT; i += 1) {
    const x = w * (.5 + field.panels[i].x * .69);
    p.noStroke();
    p.fill(43, 25, 20, 78);
    p.ellipse(x, 0, Math.max(7, w * .012), Math.max(7, w * .012));
    p.fill(43, 30, 84, 92);
    p.ellipse(x, 0, Math.max(3, w * .005), Math.max(3, w * .005));
  }
  p.pop();
}

function drawLeaf(p, panel, x, y, width, height, splitPart = 0) {
  const lean = panel.lean * width * .8 + splitPart * width * .16;
  p.push();
  p.translate(x, y);
  p.rotate(panel.lean + splitPart * .035);
  p.noStroke();
  p.fill(220, 35, 8, 55);
  p.beginShape();
  p.vertex(-width * .46 + 7, -height * .5 + 8);
  p.vertex(width * .42 + 7, -height * .5 + 8);
  p.vertex(width * .5 + 7, height * .46 + 8);
  p.vertex(-width * .37 + 7, height * .5 + 8);
  p.endShape(p.CLOSE);
  const hue = panel.tone === 0 ? 43 : panel.tone === 1 ? 276 : panel.tone === 2 ? 18 : 205;
  p.fill(hue, 28, panel.state === 'split' ? 27 : 20, 96);
  p.beginShape();
  p.vertex(-width * .5, -height * .5);
  p.vertex(width * .43, -height * .5 + lean * .05);
  p.vertex(width * .5, height * .45);
  p.vertex(-width * .44, height * .5 - lean * .04);
  p.endShape(p.CLOSE);
  p.stroke(hue, panel.state === 'split' ? 64 : 34, 93, panel.state === 'split' ? 86 : 48);
  p.strokeWeight(panel.state === 'split' ? 1.5 : .8);
  p.line(-width * .32, -height * .38, width * .31, -height * .38 + lean * .08);
  p.line(-width * .32, height * .35, width * .34, height * .35 - lean * .06);
  p.stroke(43, 17, 100, panel.state === 'split' ? 72 : 32);
  p.strokeWeight(.65);
  for (let i = 0; i < panel.seams; i += 1) {
    const seamY = -height * .24 + i * height * .18;
    p.line(-width * .28, seamY, width * .3, seamY + Math.sin(panel.phase * 6 + i) * 2);
  }
  p.noStroke();
  p.fill(220, 26, 90, 68);
  const notchX = -width * .32 + panel.notch * width * .55;
  p.beginShape();
  p.vertex(notchX - width * .1, -height * .5 + 1);
  p.vertex(notchX, -height * .5 + Math.max(9, height * .08));
  p.vertex(notchX + width * .1, -height * .5 + 1);
  p.endShape(p.CLOSE);
  p.pop();
}

function drawPanel(p, panel, active) {
  const width = p.width;
  const height = p.height;
  const position = panelPosition(panel);
  const panelWidth = Math.max(16, panel.width * width * 1.08);
  const panelHeight = Math.max(130, panel.height * height * .62);
  const isChosen = field.choices.some((choice) => choice.panel === panel.index);
  const glow = panel.state === 'split' ? 1 : active ? .7 : 0;
  if (glow) {
    p.push();
    p.noStroke();
    p.fill(panel.state === 'split' ? 18 : 276, panel.state === 'split' ? 70 : 38, 100, panel.state === 'split' ? 22 : 14);
    p.ellipse(position.x, position.y, panelWidth * 2.5, panelHeight * .8);
    p.pop();
  }
  if (panel.state === 'split') {
    drawLeaf(p, panel, position.x - panelWidth * .24, position.y, panelWidth * .58, panelHeight * .92, -1);
    drawLeaf(p, panel, position.x + panelWidth * .24, position.y, panelWidth * .58, panelHeight * .92, 1);
    p.stroke(43, 19, 100, 78);
    p.strokeWeight(1);
    p.line(position.x, position.y - panelHeight * .4, position.x, position.y + panelHeight * .4);
  } else {
    drawLeaf(p, panel, position.x, position.y, panelWidth, panelHeight);
  }
  if (isChosen) {
    const choice = field.choices.find((entry) => entry.panel === panel.index);
    p.push();
    p.stroke(choice.side === 'left' ? 276 : 18, 58, 100, 92);
    p.strokeWeight(2);
    const offset = choice.side === 'left' ? -panelWidth * .65 : panelWidth * .65;
    p.line(position.x + offset, position.y - panelHeight * .46, position.x + offset, position.y + panelHeight * .46);
    p.pop();
  }
  if (active) {
    p.push();
    p.noFill();
    p.stroke(62, 26, 100, 88);
    p.strokeWeight(1.4);
    p.rect(position.x - panelWidth * .62, position.y - panelHeight * .58, panelWidth * 1.24, panelHeight * 1.16, 2);
    p.pop();
  }
}

function drawRegister(p) {
  drawSpine(p);
  for (const panel of field.panels) drawPanel(p, panel, panel.index === selectedPanel && !staticMode);
  p.push();
  p.noFill();
  p.stroke(276, 35, 97, 24);
  p.strokeWeight(.8);
  p.arc(p.width * .5, p.height * .47, p.width * .78, p.height * .78, p.PI * .1, p.PI * .9);
  p.stroke(18, 46, 96, 22);
  p.arc(p.width * .5, p.height * .47, p.width * .7, p.height * .69, p.PI * 1.1, p.PI * 1.9);
  p.pop();
}

new p5((p) => {
  p.setup = () => {
    const width = Math.max(1, hostNode.clientWidth);
    const height = Math.max(1, hostNode.clientHeight);
    p.pixelDensity(1);
    renderer = p.createCanvas(width, height);
    renderer.parent(hostNode);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    createBackdrop(p);
    renderStatus(staticMode ? 'split / elsewhere' : 'quiet register');
    window.__mutinePortraitV044 = {
      getState: () => field,
      geometrySignature: () => geometrySignature(field),
      choose: (side) => choose(side),
      select: (index) => selectPanel(index),
      commit,
      lift,
      release
    };
  };

  p.draw = () => {
    p.image(backgroundLayer, 0, 0);
    if (!reducedMotion && !staticMode) {
      p.push();
      p.blendMode(p.SCREEN);
      p.noFill();
      p.stroke(276, 24, 92, 8);
      p.strokeWeight(1);
      const drift = Math.sin(p.frameCount * .006) * 5;
      p.arc(p.width * .5, p.height * .47 + drift, p.width * .86, p.height * .86, p.PI * .14, p.PI * .82);
      p.pop();
    }
    drawRegister(p);
  };

  p.windowResized = () => {
    if (!hostNode.clientWidth || !hostNode.clientHeight) return;
    p.resizeCanvas(hostNode.clientWidth, hostNode.clientHeight);
    createBackdrop(p);
  };
});
