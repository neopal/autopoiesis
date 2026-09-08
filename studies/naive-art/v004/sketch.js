import { STAGES, applyCorrection, buildTimeline, deleteLatestCorrection, layoutForViewport } from './engine.mjs';

const field = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const vanishingControl = document.querySelector('#vanishing-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4200;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let viewHeight = 700;

if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fx = (value) => Number(value * 1000).toFixed(2);
const fy = (value) => Number(value * viewHeight).toFixed(2);

function pointInPanel(panel, point) {
  return { ...point, x: panel.x + point.x * panel.w, y: panel.y + point.y * panel.h };
}

function pathData(points, panel) {
  return points.map((point, index) => {
    const mapped = pointInPanel(panel, point);
    return `${index ? 'L' : 'M'} ${fx(mapped.x)} ${fy(mapped.y)}`;
  }).join(' ');
}

function polygonData(points, panel) {
  return `${pathData(points, panel)} Z`;
}

function lineData(a, b, panel) {
  const start = pointInPanel(panel, a);
  const end = pointInPanel(panel, b);
  return `x1="${fx(start.x)}" y1="${fy(start.y)}" x2="${fx(end.x)}" y2="${fy(end.y)}"`;
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

function drawTree(tree, panel, ground) {
  const trunkTop = pointInPanel(panel, { x: tree.x, y: tree.y + 0.05 });
  const trunkBottom = pointInPanel(panel, { x: tree.x, y: ground });
  const crown = polygonData([{ x: tree.x, y: tree.y - 0.11 }, { x: tree.x - 0.10, y: tree.y + 0.10 }, { x: tree.x + 0.075, y: tree.y + 0.07 }], panel);
  return `<g class="tree"><path class="tree-trunk" d="M ${fx(trunkTop.x)} ${fy(trunkTop.y)} L ${fx(trunkBottom.x)} ${fy(trunkBottom.y)}"/><path class="tree-crown" d="${crown}"/></g>`;
}

function drawGround(world, panel, draft) {
  if (draft) {
    const a = pointInPanel(panel, { x: 0.06, y: world.ground.y });
    const b = pointInPanel(panel, { x: 0.94, y: world.ground.y });
    return `<path class="ground-flat" d="M ${fx(a.x)} ${fy(a.y)} L ${fx(b.x)} ${fy(b.y)}"/>`;
  }
  const left = pointInPanel(panel, world.ground.left);
  const right = pointInPanel(panel, world.ground.right);
  const vp = pointInPanel(panel, world.ground.vanishingPoint);
  return `<path class="ground-ray" d="M ${fx(left.x)} ${fy(left.y)} L ${fx(vp.x)} ${fy(vp.y)}"/><path class="ground-ray" d="M ${fx(right.x)} ${fy(right.y)} L ${fx(vp.x)} ${fy(vp.y)}"/>`;
}

function drawHouse(world, panel, kind, progress) {
  const draft = kind === 'refused';
  const opacity = draft ? 0.86 : 0.24 + progress * 0.76;
  const front = world.house.front;
  const roof = world.house.roof;
  const frontPath = polygonData([front.left, front.right, front.bottomRight, front.bottomLeft], panel);
  const roofPath = draft
    ? polygonData([front.left, roof.frontPeak, front.right], panel)
    : polygonData([front.left, roof.frontPeak, front.right, world.house.back.topRight, roof.backPeak, world.house.back.topLeft], panel);
  const sidePath = draft ? '' : `<path class="house-side" d="${polygonData([front.right, world.house.back.topRight, world.house.back.bottomRight, front.bottomRight], panel)}"/>`;
  const window = pointInPanel(panel, { x: 0.555, y: 0.49 });
  const doorTop = pointInPanel(panel, world.house.door.top);
  const doorBottom = pointInPanel(panel, world.house.door.bottom);
  const recedingGuide = draft ? '' : `<path class="perspective-guide" d="M ${fx(pointInPanel(panel, world.house.recedingEdge[0]).x)} ${fy(pointInPanel(panel, world.house.recedingEdge[0]).y)} L ${fx(pointInPanel(panel, world.house.vanishingPoint ?? { x: 0.5, y: 0.27 }).x)} ${fy(pointInPanel(panel, world.house.vanishingPoint ?? { x: 0.5, y: 0.27 }).y)}"/>`;
  return `<g class="house ${draft ? 'house-draft' : 'house-kept'}" opacity="${opacity.toFixed(3)}">
    <path class="house-shadow" d="${frontPath}"/>
    ${sidePath}
    <path class="house-front" d="${frontPath}"/>
    <path class="house-roof" d="${roofPath}"/>
    <path class="portal" d="M ${fx(doorTop.x)} ${fy(doorTop.y)} L ${fx(doorBottom.x)} ${fy(doorBottom.y)} L ${fx(doorBottom.x + panel.w * 0.04)} ${fy(doorBottom.y)} L ${fx(doorTop.x + panel.w * 0.04)} ${fy(doorTop.y)} Z"/>
    <rect class="window-mark" x="${fx(window.x - panel.w * 0.032)}" y="${fy(window.y - panel.h * 0.035)}" width="${fx(panel.w * 0.064)}" height="${fy(panel.h * 0.07)}"/>
    ${recedingGuide}
    <text class="panel-stage" x="${fx(pointInPanel(panel, { x: 0.49, y: 0.235 }).x)}" y="${fy(pointInPanel(panel, { x: 0.49, y: 0.235 }).y)}" text-anchor="middle">${draft ? 'front-facing' : 'away, incorrectly'}</text>
  </g>`;
}

function recedingPath(points, panel) {
  const receding = points.filter((point) => point.recedes || point.inside);
  return receding.length > 1 ? pathData(receding, panel) : '';
}

function drawPanel(frame, panel, kind, progress) {
  const draft = kind === 'refused';
  const world = draft ? frame.draft : frame.scene;
  const label = draft ? 'PROPOSAL' : 'CONSEQUENCE';
  const house = drawHouse(world, panel, kind, progress);
  const baseRoute = pathData(world.route, panel);
  const routeOverlay = draft ? '' : recedingPath(world.route, panel);
  const ground = drawGround(world, panel, draft);
  const treeGround = draft ? world.ground.y : 0.82;
  return `<g class="panel-group ${draft ? 'panel-refused' : 'panel-kept'}">
    <rect class="panel-paper" x="${fx(panel.x)}" y="${fy(panel.y)}" width="${fx(panel.w)}" height="${fy(panel.h)}"/>
    ${ground}
    ${drawSun(frame.scene.sun, panel)}${drawTree(frame.scene.tree, panel, treeGround)}
    <path class="route ${draft ? 'route-draft' : 'route-kept'}" d="${baseRoute}"/>
    ${house}
    ${routeOverlay ? `<path class="route route-receding" d="${routeOverlay}"/>` : ''}
    <text class="panel-label" x="${fx(pointInPanel(panel, { x: 0.055, y: 0.075 }).x)}" y="${fy(pointInPanel(panel, { x: 0.055, y: 0.075 }).y)}">${label}</text>
    <text class="panel-stage" x="${fx(pointInPanel(panel, { x: 0.945, y: 0.075 }).x)}" y="${fy(pointInPanel(panel, { x: 0.945, y: 0.075 }).y)}" text-anchor="end">${draft ? 'flat' : `${frame.memory.length} remembered`}</text>
  </g>`;
}

function drawMemoryTrace(frame, layout) {
  const draftPoint = pointInPanel(layout.panels[0], frame.draft.vanishingPoint);
  const keptPoint = pointInPanel(layout.panels[1], frame.scene.vanishingPoint);
  const bridgeY = (layout.bridge.y1 + layout.bridge.y2) / 2;
  const bend = layout.mode === 'stacked' ? { x: (draftPoint.x + keptPoint.x) / 2, y: bridgeY } : { x: 0.50, y: bridgeY - 0.1 };
  const trace = `M ${fx(draftPoint.x)} ${fy(draftPoint.y)} C ${fx(bend.x)} ${fy(draftPoint.y)} ${fx(bend.x)} ${fy(keptPoint.y)} ${fx(keptPoint.x)} ${fy(keptPoint.y)}`;
  const opacity = frame.memory.length ? 0.82 : 0.42;
  return `<g class="memory-trace" opacity="${opacity}"><path class="trace-under" d="${trace}"/><path class="trace-line" d="${trace}"/><circle class="trace-dot" cx="${fx(draftPoint.x)}" cy="${fy(draftPoint.y)}" r="5"/><circle class="trace-dot" cx="${fx(keptPoint.x)}" cy="${fy(keptPoint.y)}" r="5"/></g>`;
}

function render(frame, progress = 1, state = 'sequence') {
  const width = fieldWrap.clientWidth || 1000;
  const height = fieldWrap.clientHeight || 700;
  const layout = layoutForViewport(width, height);
  viewHeight = layout.mode === 'stacked' ? 1500 : 700;
  field.setAttribute('viewBox', `0 0 1000 ${viewHeight}`);
  const label = state === 'visitor-vanishing-point' ? 'VISITOR VANISHING POINT' : state === 'vanishing-point-deleted' ? 'VANISHING POINT UNDONE' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const sceneVp = pointInPanel(layout.panels[1], frame.scene.vanishingPoint);
  field.innerHTML = `<defs>
    <pattern id="paper-grain" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 2 11 L 18 8 M 27 34 L 42 37 M 8 45 L 14 42"/><circle cx="35" cy="12" r="1.5"/><circle cx="17" cy="27" r="1"/></pattern>
    <filter id="soft-shadow" x="-30%" y="-30%" width="170%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="${viewHeight}"/>
  <rect class="grain" x="0" y="0" width="1000" height="${viewHeight}"/>
  ${drawPanel(frame, layout.panels[0], 'refused', 1)}
  ${drawPanel(frame, layout.panels[1], 'kept', progress)}
  <circle class="vp-witness" cx="${fx(sceneVp.x)}" cy="${fy(sceneVp.y)}" r="7"/>
  <line class="vp-witness-line" ${lineData(frame.scene.vanishingPoint, { x: frame.scene.vanishingPoint.x, y: 0.02 }, layout.panels[1])}/>
  ${drawMemoryTrace(frame, layout)}
  <text class="sequence-mark" x="46" y="${viewHeight - 36}">${label}</text>
  <text class="sequence-mark sequence-mark--right" x="954" y="${viewHeight - 36}" text-anchor="end">${frame.primitiveCount} SHAPES / ${frame.memory.length} REMEMBERED</text>`;
  stageReadout.textContent = state === 'visitor-vanishing-point' ? 'visitor vanishing point / paused' : state === 'vanishing-point-deleted' ? 'vanishing point undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered points`;
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
  return { x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth), y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight) };
}

function makeVanishingPoint(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-vanishing-point' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyCorrection(base, point);
  render(interactionFrame, 1, 'visitor-vanishing-point');
}

function undoVanishingPoint() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestCorrection(base);
  render(interactionFrame, 1, 'vanishing-point-deleted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  started = performance.now();
  currentStage = 0;
  renderCurrent();
}

field.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  makeVanishingPoint(pointerPoint(event));
});
field.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeVanishingPoint({ x: 0.78, y: 0.34 });
});
vanishingControl.addEventListener('click', () => makeVanishingPoint({ x: 0.78, y: 0.34 }));
undoControl.addEventListener('click', undoVanishingPoint);
releaseControl.addEventListener('click', releaseSequence);

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
