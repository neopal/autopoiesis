import { STAGES, applyCut, buildTimeline, deleteScar } from './engine.mjs';

const field = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const cutControl = document.querySelector('#cut-control');
const deleteControl = document.querySelector('#delete-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3600;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}
const frozen = reducedMotion || staticPreview;
let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

const palette = {
  ground: '#101414',
  groundSoft: '#182321',
  bone: '#e8e0cf',
  mineral: '#b9ccb4',
  moss: '#6e9980',
  cut: '#ec7154',
  amber: '#e8b35b',
  ink: '#071010'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(1);
const py = (value) => (value * 700).toFixed(1);

function pathData(points) {
  return `M ${px(points[0].x)} ${py(points[0].y)} ${points.slice(1).map((point) => `L ${px(point.x)} ${py(point.y)}`).join(' ')} Z`;
}

function lineData(a, b) {
  return `M ${px(a.x)} ${py(a.y)} L ${px(b.x)} ${py(b.y)}`;
}

function lineElement(a, b) {
  return `<line class="limb" x1="${px(a.x)}" y1="${py(a.y)}" x2="${px(b.x)}" y2="${py(b.y)}"/>`;
}

function backgroundDust(stage) {
  return Array.from({ length: 22 }, (_, index) => {
    const x = 45 + ((index * 137 + stage * 23) % 910);
    const y = 74 + ((index * 71 + stage * 29) % 550);
    const length = 8 + (index % 5) * 7;
    return `<line class="dust" x1="${x}" y1="${y}" x2="${x + length}" y2="${y - (index % 3) * 2}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const points = frame.points;
  const rearFoot = { x: points[13].x - 0.015, y: Math.min(0.84, points[13].y + 0.1) };
  const frontFoot = { x: points[9].x + 0.025, y: Math.min(0.84, points[9].y + 0.1) };
  const memory = frame.memory.map((scar, index) => `<g class="memory-scar" opacity="${0.3 + index * 0.12}"><circle cx="${px(scar.point.x)}" cy="${py(scar.point.y)}" r="${9 + index * 2}"/><path d="${lineData({ x: scar.point.x - 0.018, y: scar.point.y - 0.02 }, { x: scar.point.x + 0.018, y: scar.point.y + 0.02 })}"/></g>`).join('');
  const activeScar = frame.scar ? `<g class="active-scar"><circle cx="${px(frame.scar.point.x)}" cy="${py(frame.scar.point.y)}" r="17"/><path d="${lineData({ x: frame.scar.point.x - 0.036, y: frame.scar.point.y - 0.034 }, { x: frame.scar.point.x + 0.036, y: frame.scar.point.y + 0.034 })}"/><path d="${lineData({ x: frame.scar.point.x + 0.036, y: frame.scar.point.y - 0.034 }, { x: frame.scar.point.x - 0.036, y: frame.scar.point.y + 0.034 })}"/></g>` : '';
  const limbs = [
    lineElement(points[9], frontFoot),
    lineElement(points[10], { x: points[10].x - 0.02, y: points[10].y + 0.13 }),
    lineElement(points[12], rearFoot),
    lineElement(points[13], { x: points[13].x - 0.04, y: points[13].y + 0.1 })
  ].join('');
  const progressOffset = Math.max(0, 1 - progress);
  const modeLabel = state === 'visitor-cut' ? 'VISITOR CUT' : state === 'deleted' ? 'LATEST CUT DELETED' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  field.innerHTML = `
    <defs>
      <radialGradient id="ground-glow" cx="50%" cy="44%" r="70%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset="1" stop-color="${palette.ground}"/></radialGradient>
      <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.mineral}"/><stop offset="0.58" stop-color="${palette.bone}"/><stop offset="1" stop-color="${palette.moss}"/></linearGradient>
      <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="13"/></filter>
    </defs>
    <rect class="paper" x="0" y="0" width="1000" height="700"/>
    <g aria-hidden="true">${backgroundDust(frame.stage)}</g>
    <path class="animal-shadow" d="${pathData(points)}"/>
    <path class="draft" pathLength="1" d="${pathData(frame.draft)}"/>
    <path class="animal-glow" d="${pathData(points)}"/>
    <g class="limbs">${limbs}</g>
    <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" d="${pathData(points)}"/>
    <path class="animal-inner" d="M ${px(points[3].x)} ${py(points[3].y + 0.02)} Q ${px(points[5].x - 0.05)} ${py(points[5].y + 0.09)} ${px(points[7].x)} ${py(points[7].y - 0.01)}"/>
    ${memory}
    ${activeScar}
    <circle class="eye" cx="${px(points[5].x - 0.032)}" cy="${py(points[5].y + 0.045)}" r="5"/>
    <path class="horn" d="M ${px(points[4].x)} ${py(points[4].y)} Q ${px(points[4].x - 0.015)} ${py(points[4].y - 0.105)} ${px(points[4].x + 0.06)} ${py(points[4].y - 0.13)}"/>
    <path class="mouth" d="M ${px(points[6].x - 0.02)} ${py(points[6].y + 0.02)} Q ${px(points[6].x + 0.035)} ${py(points[6].y + 0.035)} ${px(points[6].x + 0.045)} ${py(points[6].y - 0.006)}"/>
    <text class="stage-mark" x="46" y="650">${modeLabel}</text>
    <text class="budget-mark" x="954" y="650" text-anchor="end">18 PRIMITIVES / ${frame.memory.length} KEPT</text>
  `;
  stageReadout.textContent = state === 'visitor-cut' ? 'visitor cut / paused' : state === 'deleted' ? 'latest cut deleted' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} inherited cuts`;
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
  const scale = Math.min(bounds.width / 1000, bounds.height / 700);
  const drawnWidth = 1000 * scale;
  const drawnHeight = 700 * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return {
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight)
  };
}

function makeCut(point) {
  const base = interactionFrame?.interaction === 'visitor-cut' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyCut(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-cut');
}

function deleteLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  const next = base.scar?.source === 'visitor-cut' || !base.scar
    ? deleteScar(base)
    : buildFrame(base.stage, base.memory);
  interactionFrame = { ...next, interaction: 'deleted', scar: null };
  paused = true;
  render(interactionFrame, 1, 'deleted');
}

function releaseSequence() {
  interactionFrame = null;
  paused = frozen;
  started = performance.now();
  currentStage = 0;
  renderCurrent();
}

field.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  makeCut(pointerPoint(event));
});
field.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeCut({ x: 0.7, y: 0.43 });
});
cutControl.addEventListener('click', () => {
  if (!staticPreview) makeCut({ x: 0.7, y: 0.43 });
});
deleteControl.addEventListener('click', () => {
  if (!staticPreview) deleteLatest();
});
releaseControl.addEventListener('click', () => {
  if (!staticPreview) releaseSequence();
});

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
