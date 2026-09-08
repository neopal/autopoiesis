import { STAGES, applyCorrection, buildTimeline, deleteLatestCorrection, layoutForViewport } from './engine.mjs';

const field = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const turnControl = document.querySelector('#turn-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4200;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
// Open on a legible middle state: the rule is visible before the visitor reads the prose.
let started = performance.now() - STAGE_MS * 3;
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
  const top = pointInPanel(panel, { x: tree.x, y: tree.y + 0.05 });
  const bottom = pointInPanel(panel, { x: tree.x, y: ground });
  const crown = polygonData([{ x: tree.x, y: tree.y - 0.11 }, { x: tree.x - 0.10, y: tree.y + 0.10 }, { x: tree.x + 0.075, y: tree.y + 0.07 }], panel);
  return `<g class="tree"><path class="tree-trunk" d="M ${fx(top.x)} ${fy(top.y)} L ${fx(bottom.x)} ${fy(bottom.y)}"/><path class="tree-crown" d="${crown}"/></g>`;
}

function drawGround(world, panel, draft) {
  if (draft) {
    const a = pointInPanel(panel, { x: 0.06, y: world.ground.y });
    const b = pointInPanel(panel, { x: 0.94, y: world.ground.y });
    return `<path class="ground-flat" d="M ${fx(a.x)} ${fy(a.y)} L ${fx(b.x)} ${fy(b.y)}"/>`;
  }
  const points = [world.ground.left, ...(world.ground.turns ?? []), world.ground.right];
  return `<path class="ground-kept" d="${pathData(points, panel)}"/>`;
}

function drawHouse(world, panel, kind, progress) {
  const draft = kind === 'refused';
  const opacity = draft ? 0.84 : 0.26 + progress * 0.74;
  const front = world.house.front;
  const frontPath = polygonData([front.left, front.right, front.bottomRight, front.bottomLeft], panel);
  const roofPath = polygonData([front.left, world.house.roof.peak, front.right], panel);
  const portalTop = pointInPanel(panel, world.house.door.top);
  const portalBottom = pointInPanel(panel, world.house.door.bottom);
  const window = pointInPanel(panel, { x: 0.555, y: 0.49 });
  const hinges = world.house.hinges ?? [];
  const hingePath = hinges.length ? pathData([front.right, ...hinges], panel) : '';
  const sidePoints = hinges.length ? [front.right, ...hinges.slice(0, 9), front.bottomRight] : [front.right, front.bottomRight];
  const sidePath = draft ? '' : `<path class="house-side" d="${polygonData(sidePoints, panel)}"/>`;
  const hingeDots = hinges.filter((point) => point.turn).map((point) => {
    const mapped = pointInPanel(panel, point);
    return `<circle class="hinge-dot" cx="${fx(mapped.x)}" cy="${fy(mapped.y)}" r="4.2"/>`;
  }).join('');
  return `<g class="house ${draft ? 'house-draft' : 'house-kept'}" opacity="${opacity.toFixed(3)}">
    <path class="house-shadow" d="${frontPath}"/>
    ${sidePath}
    <path class="house-front" d="${frontPath}"/>
    <path class="house-roof" d="${roofPath}"/>
    ${hingePath ? `<path class="house-hinge" d="${hingePath}"/>${hingeDots}` : ''}
    <path class="portal" d="M ${fx(portalTop.x)} ${fy(portalTop.y)} L ${fx(portalBottom.x)} ${fy(portalBottom.y)} L ${fx(portalBottom.x + panel.w * 0.04)} ${fy(portalBottom.y)} L ${fx(portalTop.x + panel.w * 0.04)} ${fy(portalTop.y)} Z"/>
    <rect class="window-mark" x="${fx(window.x - panel.w * 0.032)}" y="${fy(window.y - panel.h * 0.035)}" width="${fx(panel.w * 0.064)}" height="${fy(panel.h * 0.07)}"/>
    <text class="panel-stage" x="${fx(pointInPanel(panel, { x: 0.49, y: 0.235 }).x)}" y="${fy(pointInPanel(panel, { x: 0.49, y: 0.235 }).y)}" text-anchor="middle">${draft ? 'before the turn' : 'habit, repeated'}</text>
  </g>`;
}

function drawPanel(frame, panel, kind, progress) {
  const draft = kind === 'refused';
  const world = draft ? frame.draft : frame.scene;
  const label = draft ? 'PROPOSAL' : 'CONSEQUENCE';
  const house = drawHouse(world, panel, kind, progress);
  const baseRoute = pathData(world.route, panel);
  const routeTurns = world.route.filter((point) => point.turn);
  const routeTurn = routeTurns.length ? pathData([world.route[2], ...routeTurns], panel) : '';
  const ground = drawGround(world, panel, draft);
  const treeGround = draft ? world.ground.y : 0.83;
  return `<g class="panel-group ${draft ? 'panel-refused' : 'panel-kept'}">
    <rect class="panel-paper" x="${fx(panel.x)}" y="${fy(panel.y)}" width="${fx(panel.w)}" height="${fy(panel.h)}"/>
    ${ground}
    ${drawSun(frame.scene.sun, panel)}${drawTree(frame.scene.tree, panel, treeGround)}
    <path class="route ${draft ? 'route-draft' : 'route-kept'}" d="${baseRoute}"/>
    ${house}
    ${routeTurn ? `<path class="route route-turn" d="${routeTurn}"/>` : ''}
    <text class="panel-label" x="${fx(pointInPanel(panel, { x: 0.055, y: 0.075 }).x)}" y="${fy(pointInPanel(panel, { x: 0.055, y: 0.075 }).y)}">${label}</text>
    <text class="panel-stage" x="${fx(pointInPanel(panel, { x: 0.945, y: 0.075 }).x)}" y="${fy(pointInPanel(panel, { x: 0.945, y: 0.075 }).y)}" text-anchor="end">${draft ? 'straight' : `${frame.scene.turns.length} turns kept`}</text>
  </g>`;
}

function drawMemoryBridge(frame, layout) {
  const from = pointInPanel(layout.panels[0], { x: 0.66, y: 0.44 });
  const to = pointInPanel(layout.panels[1], { x: 0.34, y: 0.44 });
  const middle = layout.mode === 'stacked'
    ? { x: (from.x + to.x) / 2, y: (layout.bridge.y1 + layout.bridge.y2) / 2 }
    : { x: (from.x + to.x) / 2, y: from.y - 0.09 };
  const trace = `M ${fx(from.x)} ${fy(from.y)} C ${fx(middle.x)} ${fy(from.y)} ${fx(middle.x)} ${fy(to.y)} ${fx(to.x)} ${fy(to.y)}`;
  return `<g class="memory-bridge" opacity="${frame.memory.length ? 0.9 : 0.48}"><path class="bridge-under" d="${trace}"/><path class="bridge-line" d="${trace}"/><circle class="bridge-dot" cx="${fx(from.x)}" cy="${fy(from.y)}" r="5"/><circle class="bridge-dot" cx="${fx(to.x)}" cy="${fy(to.y)}" r="5"/></g>`;
}

function render(frame, progress = 1, state = 'sequence') {
  const width = fieldWrap.clientWidth || 1000;
  const height = fieldWrap.clientHeight || 700;
  const layout = layoutForViewport(width, height);
  viewHeight = layout.mode === 'stacked' ? 1500 : 700;
  field.setAttribute('viewBox', `0 0 1000 ${viewHeight}`);
  const label = state === 'visitor-wrong-turn' ? 'VISITOR TURN / PAUSED' : state === 'wrong-turn-deleted' ? 'LAST TURN UNDONE' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  field.innerHTML = `<defs>
    <pattern id="paper-grain" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 2 11 L 18 8 M 27 34 L 42 37 M 8 45 L 14 42"/><circle cx="35" cy="12" r="1.5"/><circle cx="17" cy="27" r="1"/></pattern>
    <filter id="soft-shadow" x="-30%" y="-30%" width="170%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="${viewHeight}"/>
  <rect class="grain" x="0" y="0" width="1000" height="${viewHeight}"/>
  ${drawPanel(frame, layout.panels[0], 'refused', 1)}
  ${drawPanel(frame, layout.panels[1], 'kept', progress)}
  ${drawMemoryBridge(frame, layout)}
  <text class="sequence-mark" x="46" y="${viewHeight - 36}">${label}</text>
  <text class="sequence-mark sequence-mark--right" x="954" y="${viewHeight - 36}" text-anchor="end">${frame.primitiveCount} SHAPES / ${frame.scene.turns.length} TURNS</text>`;
  stageReadout.textContent = state === 'visitor-wrong-turn' ? 'visitor turn / paused' : state === 'wrong-turn-deleted' ? 'last turn undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.turns.length} turns retained`;
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
  const boxHeight = field.viewBox.baseVal.height || 700;
  const scale = Math.min(bounds.width / 1000, bounds.height / boxHeight);
  const drawnWidth = 1000 * scale;
  const drawnHeight = boxHeight * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return { x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth), y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight) };
}

function makeWrongTurn(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-wrong-turn' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyCorrection(base, point);
  render(interactionFrame, 1, 'visitor-wrong-turn');
}

function undoWrongTurn() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestCorrection(base);
  render(interactionFrame, 1, 'wrong-turn-deleted');
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
  makeWrongTurn(pointerPoint(event));
});
field.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeWrongTurn({ x: 0.78, y: 0.34 });
});
turnControl.addEventListener('click', () => makeWrongTurn({ x: 0.78, y: 0.34 }));
undoControl.addEventListener('click', undoWrongTurn);
releaseControl.addEventListener('click', releaseSequence);

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
