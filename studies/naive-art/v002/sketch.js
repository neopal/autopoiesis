import { STAGES, applyCorrection, buildTimeline, deleteLatestCorrection, layoutForViewport } from './engine.mjs';

const field = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const correctionControl = document.querySelector('#correction-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3900;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let viewHeight = 700;

if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  paper: '#f2e1b9',
  paperDeep: '#e7c98d',
  ink: '#173b4d',
  coral: '#cf543d',
  yellow: '#f0b64c',
  blue: '#4f7e8b',
  moss: '#788b5d',
  shadow: '#b99c69'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fx = (value) => Number(value * 1000).toFixed(2);
const fy = (value) => Number(value * viewHeight).toFixed(2);

function pointInPanel(panel, point) {
  return { x: panel.x + point.x * panel.w, y: panel.y + point.y * panel.h };
}

function pathData(points, panel) {
  return points.map((point, index) => {
    const mapped = pointInPanel(panel, point);
    return `${index ? 'L' : 'M'} ${fx(mapped.x)} ${fy(mapped.y)}`;
  }).join(' ');
}

function houseData(world, panel) {
  const left = world.houseX - world.houseWidth / 2;
  const right = world.houseX + world.houseWidth / 2;
  const top = world.houseY;
  const bottom = world.houseY + world.houseHeight;
  const peak = { x: world.houseX + world.roofLean, y: top - 0.14 };
  return {
    body: pathData([{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }], panel) + ' Z',
    roof: pathData([{ x: left - 0.02, y: top + 0.01 }, peak, { x: right + 0.018, y: top + 0.015 }], panel) + ' Z',
    door: pointInPanel(panel, { x: world.door.x, y: world.door.y }),
    doorWidth: panel.w * 0.065,
    doorHeight: panel.h * 0.17,
    left: panel.x + left * panel.w,
    right: panel.x + right * panel.w,
    top: panel.y + top * panel.h,
    bottom: panel.y + bottom * panel.h
  };
}

function pathFor(world, panel) {
  return pathData([
    { x: world.door.x, y: world.door.y + 0.17 },
    { x: world.pathBend, y: world.pathKneeY },
    { x: 0.48, y: 0.98 }
  ], panel);
}

function drawSun(sun, panel) {
  const center = pointInPanel(panel, sun);
  const radius = sun.radius * Math.min(panel.w * 1000, panel.h * viewHeight);
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    const a = pointInPanel(panel, { x: sun.x + Math.cos(angle) * sun.radius * 1.34, y: sun.y + Math.sin(angle) * sun.radius * 1.34 });
    const b = pointInPanel(panel, { x: sun.x + Math.cos(angle) * sun.radius * 1.72, y: sun.y + Math.sin(angle) * sun.radius * 1.72 });
    return `<line class="sun-ray" x1="${fx(a.x)}" y1="${fy(a.y)}" x2="${fx(b.x)}" y2="${fy(b.y)}"/>`;
  }).join('');
  return `<g class="sun"><circle cx="${fx(center.x)}" cy="${fy(center.y)}" r="${radius.toFixed(2)}"/>${rays}</g>`;
}

function drawTree(tree, panel) {
  const trunkTop = pointInPanel(panel, { x: tree.x, y: tree.y + 0.05 });
  const trunkBottom = pointInPanel(panel, { x: tree.x, y: 0.79 });
  const crown = pathData([
    { x: tree.x, y: tree.y - 0.11 },
    { x: tree.x - 0.10, y: tree.y + 0.10 },
    { x: tree.x + 0.075, y: tree.y + 0.07 }
  ], panel) + ' Z';
  return `<g class="tree"><path class="tree-trunk" d="M ${fx(trunkTop.x)} ${fy(trunkTop.y)} L ${fx(trunkBottom.x)} ${fy(trunkBottom.y)}"/><path class="tree-crown" d="${crown}"/></g>`;
}

function drawHouse(world, panel, kind, progress) {
  const data = houseData(world, panel);
  const draft = kind === 'refused';
  const opacity = draft ? 0.84 : 0.24 + progress * 0.76;
  const doorLeft = data.door.x - data.doorWidth / 2;
  const doorTop = data.door.y;
  return `<g class="house ${draft ? 'house-draft' : 'house-kept'}" opacity="${opacity.toFixed(3)}">
    <path class="house-shadow" d="${data.body}"/>
    <path class="house-body" d="${data.body}"/>
    <path class="house-roof" d="${data.roof}"/>
    <rect class="house-door" x="${fx(doorLeft)}" y="${fy(doorTop)}" width="${fx(data.doorWidth)}" height="${fy(data.doorHeight)}"/>
    <line class="door-seam" x1="${fx(data.door.x)}" y1="${fy(doorTop)}" x2="${fx(data.door.x)}" y2="${fy(doorTop + data.doorHeight)}"/>
  </g>`;
}

function drawPanel(frame, panel, kind, progress) {
  const draft = kind === 'refused';
  const world = draft ? frame.draft : frame.scene;
  const label = draft ? 'PROPOSAL' : 'CONSEQUENCE';
  const groundA = pointInPanel(panel, { x: 0.04, y: 0.80 });
  const groundB = pointInPanel(panel, { x: 0.96, y: 0.80 });
  const pathClass = draft ? 'route route-draft' : 'route route-kept';
  const route = `<path class="${pathClass}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${draft ? 0 : (1 - progress).toFixed(3)}" d="${pathFor(world, panel)}"/>`;
  const house = drawHouse(world, panel, kind, progress);
  const corner = pointInPanel(panel, { x: 0.055, y: 0.075 });
  return `<g class="panel-group ${draft ? 'panel-refused' : 'panel-kept'}">
    <rect class="panel-paper" x="${fx(panel.x)}" y="${fy(panel.y)}" width="${fx(panel.w)}" height="${fy(panel.h)}"/>
    <path class="ground" d="M ${fx(groundA.x)} ${fy(groundA.y)} L ${fx(groundB.x)} ${fy(groundB.y)}"/>
    ${drawSun(frame.scene.sun, panel)}${drawTree(frame.scene.tree, panel)}${route}${house}
    <text class="panel-label" x="${fx(corner.x)}" y="${fy(corner.y)}">${label}</text>
    <text class="panel-stage" x="${fx(panel.x + panel.w - 0.055)}" y="${fy(corner.y)}" text-anchor="end">${draft ? 'wrong door' : 'door carried'}</text>
  </g>`;
}

function drawMemoryTrace(frame, layout) {
  const draftDoor = pointInPanel(layout.panels[0], { x: frame.draft.door.x, y: frame.draft.door.y + 0.085 });
  const keptDoor = pointInPanel(layout.panels[1], { x: frame.scene.door.x, y: frame.scene.door.y + 0.085 });
  const bridgeY = (layout.bridge.y1 + layout.bridge.y2) / 2;
  const bend = layout.mode === 'stacked'
    ? { x: (draftDoor.x + keptDoor.x) / 2, y: bridgeY }
    : { x: 0.50, y: bridgeY - 0.10 };
  const trace = `M ${fx(draftDoor.x)} ${fy(draftDoor.y)} C ${fx(bend.x)} ${fy(draftDoor.y)} ${fx(bend.x)} ${fy(keptDoor.y)} ${fx(keptDoor.x)} ${fy(keptDoor.y)}`;
  const opacity = frame.memory.length ? 0.92 : 0.48;
  return `<g class="memory-trace" opacity="${opacity}"><path class="trace-under" d="${trace}"/><path class="trace-line" d="${trace}"/><circle class="trace-dot" cx="${fx(draftDoor.x)}" cy="${fy(draftDoor.y)}" r="5"/><circle class="trace-dot" cx="${fx(keptDoor.x)}" cy="${fy(keptDoor.y)}" r="5"/></g>`;
}

function render(frame, progress = 1, state = 'sequence') {
  const width = fieldWrap.clientWidth || 1000;
  const height = fieldWrap.clientHeight || 700;
  const layout = layoutForViewport(width, height);
  viewHeight = layout.mode === 'stacked' ? 1500 : 700;
  field.setAttribute('viewBox', `0 0 1000 ${viewHeight}`);
  const label = state === 'visitor-correction' ? 'VISITOR CORRECTION' : state === 'correction-deleted' ? 'CORRECTION UNDONE' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  field.innerHTML = `<defs>
    <pattern id="paper-grain" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 2 11 L 18 8 M 27 34 L 42 37 M 8 45 L 14 42"/><circle cx="35" cy="12" r="1.5"/><circle cx="17" cy="27" r="1"/></pattern>
    <filter id="soft-shadow" x="-30%" y="-30%" width="170%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="${viewHeight}"/>
  <rect class="grain" x="0" y="0" width="1000" height="${viewHeight}"/>
  ${drawPanel(frame, layout.panels[0], 'refused', 1)}
  ${drawPanel(frame, layout.panels[1], 'kept', progress)}
  ${drawMemoryTrace(frame, layout)}
  <text class="sequence-mark" x="46" y="${viewHeight - 36}">${label}</text>
  <text class="sequence-mark sequence-mark--right" x="954" y="${viewHeight - 36}" text-anchor="end">${frame.primitiveCount} SHAPES / ${frame.memory.length} KEPT</text>`;
  stageReadout.textContent = state === 'visitor-correction' ? 'visitor correction / paused' : state === 'correction-deleted' ? 'correction undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} retained corrections`;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return { frame: timeline[currentStage], progress: (elapsed % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = frameAt(now);
  render(current.frame, current.progress, 'sequence');
}

function pointerPoint(event) {
  const bounds = field.getBoundingClientRect();
  const viewBoxHeight = field.viewBox.baseVal.height || 700;
  const scale = Math.min(bounds.width / 1000, bounds.height / viewBoxHeight);
  const drawnWidth = 1000 * scale;
  const drawnHeight = viewBoxHeight * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return {
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight)
  };
}

function makeCorrection(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-correction' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyCorrection(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-correction');
}

function undoCorrection() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestCorrection(base);
  paused = true;
  render(interactionFrame, 1, 'correction-deleted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  started = performance.now();
  currentStage = 0;
  paused = frozen;
  renderCurrent();
}

field.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  makeCorrection(pointerPoint(event));
});
field.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeCorrection({ x: 0.78, y: 0.42 });
});
correctionControl.addEventListener('click', () => makeCorrection({ x: 0.78, y: 0.42 }));
undoControl.addEventListener('click', undoCorrection);
releaseControl.addEventListener('click', releaseSequence);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
