import {
  STAGES,
  applyPressure,
  buildTimeline,
  removeLatestPressure
} from './engine.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.querySelector('#piece');
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 2600;
const timeline = buildTimeline(FINAL_STAGE);
const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-pressure');
const releaseButton = document.querySelector('#release-sequence');
const pressButton = document.querySelector('#press-mark');

const colors = {
  ground: '#0a0d12',
  groundLight: '#141d23',
  ink: '#e9e1d0',
  inkSoft: '#a9b4b5',
  accent: '#e58b5b',
  signal: '#79c5bb',
  load: '#d6bd78',
  shadow: '#05070a'
};

let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let startedAt = performance.now();
let animationFrame = 0;
let latestPressureId = null;
let pointerStart = null;
let lastGesture = { startX: 0.22, startY: 0.52, endX: 0.67, endY: 0.37 };

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function point(x, y) {
  return { x: x * 1000, y: y * 620 };
}

function addText(group, text, x, y, attrs = {}) {
  const node = el('text', { x, y, ...attrs });
  node.textContent = text;
  group.append(node);
  return node;
}

function rotatePoint(x, y, angle) {
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}

function reservoirPath(reservoir) {
  const center = point(reservoir.x, reservoir.y);
  const scale = 1.05 * reservoir.scale;
  const rx = 33 * scale;
  const ry = 53 * scale;
  const gap = Math.PI * (0.12 + reservoir.mouth * 0.35);
  const outer = [];
  const inner = [];
  const samples = 18;
  for (let index = 0; index <= samples; index += 1) {
    const angle = gap + (Math.PI * 2 - gap * 2) * (index / samples);
    const local = rotatePoint(Math.cos(angle) * rx, Math.sin(angle) * ry, reservoir.angle);
    outer.push({ x: center.x + local.x, y: center.y + local.y });
  }
  for (let index = samples; index >= 0; index -= 1) {
    const angle = gap + (Math.PI * 2 - gap * 2) * (index / samples);
    const local = rotatePoint(Math.cos(angle) * rx * 0.48, Math.sin(angle) * ry * 0.48, reservoir.angle);
    inner.push({ x: center.x + local.x, y: center.y + local.y });
  }
  const all = [...outer, ...inner];
  return `${all.map((item, index) => `${index === 0 ? 'M' : 'L'} ${item.x.toFixed(2)} ${item.y.toFixed(2)}`).join(' ')} Z`;
}

function roleColor(role) {
  if (role === 'sealed') return colors.accent;
  if (role === 'receiving') return colors.signal;
  if (role === 'overflow') return colors.load;
  return colors.ink;
}

function makeDefs() {
  const defs = el('defs');
  const background = el('linearGradient', { id: 'background-gradient', x1: '0', y1: '0', x2: '1', y2: '1' });
  background.append(el('stop', { offset: '0%', 'stop-color': colors.groundLight }));
  background.append(el('stop', { offset: '58%', 'stop-color': colors.ground }));
  background.append(el('stop', { offset: '100%', 'stop-color': '#05070a' }));
  defs.append(background);

  const reservoir = el('linearGradient', { id: 'reservoir-gradient', x1: '0', y1: '0', x2: '1', y2: '1' });
  reservoir.append(el('stop', { offset: '0%', 'stop-color': colors.ink }));
  reservoir.append(el('stop', { offset: '55%', 'stop-color': '#bfc8bd' }));
  reservoir.append(el('stop', { offset: '100%', 'stop-color': '#647579' }));
  defs.append(reservoir);

  const glow = el('filter', { id: 'soft-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  glow.append(el('feGaussianBlur', { stdDeviation: '7', result: 'blur' }));
  const merge = el('feMerge');
  merge.append(el('feMergeNode', { in: 'blur' }));
  merge.append(el('feMergeNode', { in: 'SourceGraphic' }));
  glow.append(merge);
  defs.append(glow);
  return defs;
}

function drawBackground(group) {
  group.append(el('rect', { x: 0, y: 0, width: 1000, height: 620, fill: 'url(#background-gradient)' }));
  for (let index = 0; index < 170; index += 1) {
    const x = (index * 137.31) % 1000;
    const y = (index * 71.17) % 620;
    group.append(el('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: index % 5 === 0 ? 1.6 : 0.7, fill: colors.ink, opacity: (0.02 + (index % 7) * 0.004).toFixed(3) }));
  }
  group.append(el('path', { d: 'M 74 500 C 242 560 348 480 480 526 S 765 515 932 420', fill: 'none', stroke: colors.signal, 'stroke-width': 1, opacity: 0.12, 'stroke-dasharray': '2 12' }));
}

function bridgePath(bridge) {
  const points = bridge.points.map((item) => point(item.x, item.y));
  return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} C ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)} ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)} ${points[2].x.toFixed(2)} ${points[2].y.toFixed(2)}`;
}

function drawBridges(group) {
  for (const bridge of frameState.bridges) {
    const overflow = bridge.kind === 'overflow';
    group.append(el('path', {
      d: bridgePath(bridge),
      fill: 'none',
      stroke: overflow ? colors.load : colors.signal,
      'stroke-width': overflow ? 10 : 7,
      'stroke-linecap': 'round',
      opacity: overflow ? 0.76 : 0.32,
      filter: overflow ? 'url(#soft-glow)' : ''
    }));
    group.append(el('path', {
      d: bridgePath(bridge),
      fill: 'none',
      stroke: overflow ? colors.ink : colors.inkSoft,
      'stroke-width': overflow ? 2 : 1.2,
      'stroke-linecap': 'round',
      opacity: overflow ? 0.9 : 0.58,
      'stroke-dasharray': overflow ? '1 0' : '3 9'
    }));
  }
}

function drawReservoirs(group) {
  frameState.reservoirs.forEach((reservoir) => {
    const center = point(reservoir.x, reservoir.y);
    const fill = reservoir.role === 'soft' ? 'url(#reservoir-gradient)' : roleColor(reservoir.role);
    const path = el('path', {
      d: reservoirPath(reservoir),
      fill,
      stroke: reservoir.role === 'soft' ? colors.inkSoft : colors.ink,
      'stroke-width': reservoir.role === 'soft' ? 1.3 : 2,
      opacity: reservoir.role === 'sealed' ? 0.98 : 0.9,
      'stroke-linejoin': 'round'
    });
    group.append(path);

    const mouthAngle = reservoir.angle - Math.PI * (0.12 + reservoir.mouth * 0.35);
    const mouth = rotatePoint(41 * reservoir.scale, 0, mouthAngle);
    const mouthStart = { x: center.x + mouth.x, y: center.y + mouth.y };
    const mouthEnd = { x: center.x - mouth.x * 0.34, y: center.y - mouth.y * 0.34 };
    group.append(el('path', {
      d: `M ${mouthStart.x.toFixed(2)} ${mouthStart.y.toFixed(2)} L ${mouthEnd.x.toFixed(2)} ${mouthEnd.y.toFixed(2)}`,
      fill: 'none',
      stroke: reservoir.role === 'sealed' ? colors.accent : colors.shadow,
      'stroke-width': reservoir.role === 'sealed' ? 6 : 4,
      'stroke-linecap': 'round',
      opacity: reservoir.role === 'sealed' ? 0.95 : 0.62
    }));

    if (reservoir.role !== 'soft') {
      group.append(el('circle', { cx: center.x, cy: center.y, r: 4 + reservoir.load * 4, fill: roleColor(reservoir.role), opacity: 0.78 }));
    }
  });
}

function drawBreaks(group) {
  for (const broken of frameState.breaks) {
    const origin = frameState.reservoirs[broken.from];
    const next = frameState.reservoirs[broken.to];
    const a = point((origin.x + next.x) * 0.5 - 0.022, (origin.y + next.y) * 0.5 - 0.016);
    const b = point((origin.x + next.x) * 0.5 + 0.022, (origin.y + next.y) * 0.5 + 0.016);
    group.append(el('path', { d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`, stroke: colors.accent, 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.94 }));
    group.append(el('path', { d: `M ${(a.x + 10).toFixed(2)} ${(a.y - 8).toFixed(2)} L ${(b.x + 10).toFixed(2)} ${(b.y - 8).toFixed(2)}`, stroke: colors.shadow, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.92 }));
  }
}

function drawLabels(group) {
  if (blind) return;
  const label = frameState.memory.length ? 'PRESSURE HELD / ROUTE ALTERED' : 'SOFT CHAIN / NEXT MOUTH LATENT';
  addText(group, `CAPILLARY SENTENCE / ${String(frameState.stage).padStart(2, '0')}`, 54, 52, { fill: colors.inkSoft, 'font-size': 12, 'font-family': 'ui-monospace, monospace', 'letter-spacing': 2 });
  addText(group, label, 946, 52, { fill: frameState.memory.length ? colors.accent : colors.signal, 'font-size': 12, 'font-family': 'ui-monospace, monospace', 'letter-spacing': 1.4, 'text-anchor': 'end' });
  addText(group, `${frameState.reservoirs.filter((item) => item.role !== 'soft').length} LOADED · ${frameState.breaks.length} BREAKS · ${frameState.redirects.length} OVERFLOWS`, 946, 574, { fill: colors.inkSoft, 'font-size': 11, 'font-family': 'ui-monospace, monospace', 'letter-spacing': 1.1, 'text-anchor': 'end' });
  if (interactive && !staticPreview) addText(group, 'DRAG TO PRESS · ENTER TO REPEAT · DELETE TO LIFT', 54, 574, { fill: colors.signal, 'font-size': 11, 'font-family': 'ui-monospace, monospace', 'letter-spacing': 1.1 });
}

function render() {
  svg.replaceChildren(makeDefs());
  const background = el('g');
  drawBackground(background);
  svg.append(background);
  const bridgeGroup = el('g');
  drawBridges(bridgeGroup);
  svg.append(bridgeGroup);
  const reservoirGroup = el('g');
  drawReservoirs(reservoirGroup);
  drawBreaks(reservoirGroup);
  svg.append(reservoirGroup);
  const labelGroup = el('g');
  drawLabels(labelGroup);
  svg.append(labelGroup);
  svg.dataset.stage = String(frameState.stage);
  svg.dataset.memory = String(frameState.memory.length);
  svg.dataset.breaks = String(frameState.breaks.length);
  svg.dataset.redirects = String(frameState.redirects.length);
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (pressButton) pressButton.disabled = !interactive || staticPreview;
  if (liftButton) liftButton.disabled = !interactive || staticPreview || frameState.memory.length === 0;
  if (releaseButton) releaseButton.disabled = !interactive || staticPreview;
}

function positionFromEvent(event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / Math.max(1, rect.width),
    y: (event.clientY - rect.top) / Math.max(1, rect.height)
  };
}

function placePressure(gesture) {
  if (!interactive || staticPreview) return false;
  window.cancelAnimationFrame(animationFrame);
  const changed = applyPressure(frameState, gesture);
  if (!changed.accepted) {
    updateState('The click was too short; pressure needs a route.');
    return false;
  }
  lastGesture = { ...gesture };
  frameState = changed;
  latestPressureId = frameState.memory.at(-1)?.id ?? null;
  paused = true;
  updateState('The source mouth sealed; its old join broke and the load reached another mouth.');
  updateButtons();
  render();
  return true;
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = removeLatestPressure(frameState);
  latestPressureId = frameState.memory.at(-1)?.id ?? null;
  paused = true;
  updateState('The latest pressure lifted; the earlier sentence is exact again.');
  updateButtons();
  render();
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  latestPressureId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The sentence is soft; each chamber still feeds the next.');
  updateButtons();
  render();
  animationFrame = window.requestAnimationFrame(drawFrame);
}

function saveStill() {
  const serial = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serial], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v016-capillary.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function drawFrame(now) {
  render();
  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      latestPressureId = frameState.memory.at(-1)?.id ?? null;
      updateButtons();
    }
    if (nextStage < FINAL_STAGE) animationFrame = window.requestAnimationFrame(drawFrame);
  }
}

svg.addEventListener('pointerdown', (event) => {
  if (!interactive || staticPreview) return;
  pointerStart = positionFromEvent(event);
  svg.setPointerCapture?.(event.pointerId);
});
svg.addEventListener('pointerup', (event) => {
  if (!interactive || staticPreview || !pointerStart) return;
  const end = positionFromEvent(event);
  const gesture = { startX: pointerStart.x, startY: pointerStart.y, endX: end.x, endY: end.y };
  pointerStart = null;
  placePressure(gesture);
});
svg.addEventListener('pointercancel', () => { pointerStart = null; });
svg.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    placePressure(lastGesture);
  }
  if (event.key === 'Delete' || event.key.toLowerCase() === 'u') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
pressButton?.addEventListener('click', () => placePressure(lastGesture));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', render);

window.__mutineHandwritingV016 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((entry) => ({ ...entry })),
    loadedReservoirs: frameState.reservoirs.filter((reservoir) => reservoir.role !== 'soft').length,
    breakCount: frameState.breaks.length,
    overflowCount: frameState.redirects.length,
    paused,
    interactive,
    blind,
    latestPressureId
  }),
  placePressure,
  liftLatest,
  releaseSequence,
  getSvgSignature: () => svg.outerHTML,
  getSvg: () => svg
};

updateButtons();
drawFrame(performance.now());
