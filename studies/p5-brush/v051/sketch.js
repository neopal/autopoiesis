import {
  PULSE_WINDOW_END,
  PULSE_WINDOW_START,
  applyPulse,
  armPulse,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseField,
  releasePulse,
  tickPulse
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#phase-field');
const canvasHost = document.querySelector('#phase-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;
const blindMode = params.get('blind') === '1';

const PALETTE = {
  night: [4, 34, 7],
  ember: [14, 70, 84],
  copper: [22, 67, 88],
  ochre: [40, 62, 87],
  lichen: [92, 31, 70],
  paper: [30, 17, 92],
  shadow: [4, 35, 4],
  seam: [28, 30, 78]
};
const SEGMENT_COLORS = [PALETTE.ember, PALETTE.copper, PALETTE.ochre, PALETTE.lichen, PALETTE.paper];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let selectedSite = 0;
let holdStartedAt = 0;
let activePointerId = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const height = document.documentElement.classList.contains('preview-mode')
    ? Math.max(420, window.innerHeight)
    : Math.max(500, canvasHost.clientHeight || Math.min(760, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    quiet: 'The ring is quiet. Press a rim site and wait for the material to open.',
    'pulse-armed': 'Pressure held. Release only inside the quiet phase window.',
    'pulse-held': 'The ring is measuring time, not drawing a trace.',
    'pulse-refused-site': 'The ring has four phase sites.',
    'pulse-refused-empty': 'No pressure pulse is active. The ring remains exact.',
    'pulse-refused-short': 'The pulse was too short. The ring refused the pressure.',
    'pulse-refused-phase': 'The release missed the quiet window. Nothing was re-produced.',
    'pulse-committed': 'The phase slipped. Segment geometry and the central aperture have changed.',
    lifted: 'The latest phase slip is lifted. The preceding ring returns exactly.',
    'lift-refused': 'There is no phase slip to lift.'
  };
  return messages[interaction] || messages.quiet;
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `PULSE ${String(frame.stage ?? frame.memory.length).padStart(2, '0')} / 05`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering phase slips' : 'quiet ring'} · ${frame.memory.length} slip${frame.memory.length === 1 ? '' : 's'} retained`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  document.querySelectorAll('[data-gesture="select"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.site) === selectedSite));
  });
  if (p5Instance) p5Instance.redraw();
}

function screenPoint(point, p) {
  return { x: point.x * p.width, y: point.y * p.height };
}

function sitePoint(site, p) {
  const angle = site.angle;
  return { x: 0.5 + Math.cos(angle) * site.radius, y: 0.5 + Math.sin(angle) * site.radius };
}

function pointerPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function nearestSite(point) {
  const dx = point.x - 0.5;
  const dy = point.y - 0.5;
  const radius = Math.hypot(dx, dy);
  if (radius < 0.31 || radius > 0.78) return null;
  let best = null;
  let bestDistance = Infinity;
  frame.body.pulseSites.forEach((site) => {
    const target = sitePoint(site, { width: 1, height: 1 });
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = site.id;
    }
  });
  return bestDistance < 0.24 ? best : null;
}

function drawBackground(p) {
  p.background(...PALETTE.night);
  p.noStroke();
  for (let ring = 0; ring < 28; ring += 1) {
    const amount = ring / 28;
    p.fill(7 + amount * 8, 32 + amount * 12, 8 + amount * 10, 4.2);
    p.ellipse(p.width * (0.5 + Math.sin(ring * 1.73) * 0.035), p.height * (0.5 + Math.cos(ring * 1.19) * 0.028), p.width * (1.1 - amount * 0.66), p.height * (1.05 - amount * 0.57));
  }
  p.stroke(...PALETTE.seam);
  p.strokeWeight(0.45);
  for (let index = 0; index < 120; index += 1) {
    const x = p.width * (0.03 + ((index * 0.6180339887) % 0.94));
    const y = p.height * (0.03 + ((index * 0.4142135623) % 0.92));
    const length = 2 + Math.abs(Math.sin(index * 17.17)) * 11;
    p.line(x, y, x + length, y - length * 0.24);
  }
}

function drawSegment(p, segment, index, scale) {
  const cx = p.width * 0.5;
  const cy = p.height * 0.5;
  const angle = segment.angle + segment.skew * 0.2;
  const half = segment.width * 0.5;
  const inner = segment.inner * scale;
  const outer = segment.outer * scale;
  const bend = segment.skew * scale * 0.2;
  const a0 = angle - half;
  const a1 = angle + half;
  const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

  const point = (radius, a, offset = 0) => ({
    x: cx + Math.cos(a) * radius + Math.cos(a + Math.PI / 2) * offset,
    y: cy + Math.sin(a) * radius + Math.sin(a + Math.PI / 2) * offset
  });
  const innerLeft = point(inner, a0, -bend * 0.28);
  const outerLeft = point(outer * (1 + Math.sin(index * 1.7) * 0.035), a0 + 0.012, -bend);
  const outerMid = point(outer * (1.04 + segment.grain * 0.035), angle, bend * 0.58);
  const outerRight = point(outer * (0.98 + Math.cos(index * 1.3) * 0.035), a1 - 0.012, bend);
  const innerRight = point(inner, a1, bend * 0.22);

  p.noStroke();
  p.fill(...color, 88);
  p.beginShape();
  p.vertex(innerLeft.x, innerLeft.y);
  p.vertex(outerLeft.x, outerLeft.y);
  p.vertex(outerMid.x, outerMid.y);
  p.vertex(outerRight.x, outerRight.y);
  p.vertex(innerRight.x, innerRight.y);
  p.vertex(cx + Math.cos(angle) * inner * 0.9, cy + Math.sin(angle) * inner * 0.9);
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke(...PALETTE.paper, 18 + segment.grain * 22);
  p.strokeWeight(0.75 + segment.grain * 0.9);
  p.beginShape();
  p.vertex(outerLeft.x, outerLeft.y);
  p.bezierVertex(outerMid.x, outerMid.y, outerRight.x, outerRight.y, innerRight.x, innerRight.y);
  p.endShape();

  p.stroke(...PALETTE.seam, 24 + segment.grain * 22);
  p.strokeWeight(0.5);
  for (let line = 1; line < 5; line += 1) {
    const ratio = line / 5;
    const left = point(inner + (outer - inner) * ratio, a0 + ratio * 0.05, -bend * (1 - ratio));
    const right = point(inner + (outer - inner) * ratio, a1 - ratio * 0.05, bend * (1 - ratio));
    p.line(left.x, left.y, right.x, right.y);
  }
}

function drawCore(p, core, scale) {
  const cx = p.width * 0.5;
  const cy = p.height * 0.5;
  const radius = core.radius * scale;
  p.noStroke();
  p.fill(4, 30, 5, 96);
  p.ellipse(cx, cy, radius * 2.35, radius * 2.35);
  p.fill(5, 37, 8, 100);
  p.beginShape();
  for (let index = 0; index < 20; index += 1) {
    const angle = index * Math.PI * 2 / 20;
    const wobble = 1 + Math.sin(index * 2.31 + core.skew * 10) * 0.08 + core.aperture * 0.4;
    p.vertex(cx + Math.cos(angle) * radius * wobble, cy + Math.sin(angle) * radius * wobble);
  }
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(...PALETTE.copper, 34);
  p.strokeWeight(1.1);
  p.ellipse(cx, cy, radius * (1.25 + core.aperture), radius * (1.25 - core.aperture * 0.35));
}

function drawSites(p) {
  if (blindMode) return;
  const scale = Math.min(p.width, p.height);
  frame.body.pulseSites.forEach((site) => {
    const normalized = sitePoint(site, { width: 1, height: 1 });
    const point = screenPoint(normalized, p);
    const active = site.id === selectedSite || frame.pending.site === site.id;
    p.push();
    p.translate(point.x, point.y);
    p.noFill();
    p.stroke(...PALETTE.copper, active ? 82 : 36);
    p.strokeWeight(active ? 1.8 : 0.7);
    p.arc(0, 0, scale * 0.052, scale * 0.052, 0.15, Math.PI * 1.85);
    p.stroke(...PALETTE.paper, active ? 58 : 20);
    p.line(-scale * 0.018, 0, scale * 0.018, 0);
    p.pop();
  });
}

function drawPending(p) {
  if (blindMode || !frame.pending.active || frame.pending.site === null) return;
  const site = frame.body.pulseSites[frame.pending.site];
  const point = screenPoint(sitePoint(site, { width: 1, height: 1 }), p);
  const scale = Math.min(p.width, p.height);
  const phase = frame.pending.phase;
  const progress = Math.max(0, Math.min(1, (phase - PULSE_WINDOW_START) / (PULSE_WINDOW_END - PULSE_WINDOW_START)));
  p.push();
  p.translate(point.x, point.y);
  p.noFill();
  p.stroke(...PALETTE.ochre, 82);
  p.strokeWeight(1.5);
  p.arc(0, 0, scale * (0.11 + progress * 0.035), scale * (0.11 + progress * 0.035), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * phase);
  p.pop();
}

function drawRing(p) {
  const scale = Math.min(p.width, p.height);
  const cx = p.width * 0.5;
  const cy = p.height * 0.5;
  p.push();
  p.drawingContext.shadowBlur = 30;
  p.drawingContext.shadowColor = 'rgba(0,0,0,.55)';
  p.noStroke();
  p.fill(...PALETTE.shadow, 76);
  p.ellipse(cx + scale * 0.012, cy + scale * 0.025, scale * 1.02, scale * 1.02);
  p.drawingContext.shadowBlur = 0;
  p.pop();

  p.push();
  p.noStroke();
  p.fill(20, 28, 15, 38);
  p.ellipse(cx, cy, scale * 1.02, scale * 1.02);
  frame.body.segments.forEach((segment, index) => drawSegment(p, segment, index, scale));
  drawCore(p, frame.body.core, scale);
  p.pop();
  drawSites(p);
  drawPending(p);
}

function drawFrame(p) {
  drawBackground(p);
  drawRing(p);
}

function attachEvents() {
  const canvas = renderer.elt;
  canvas.addEventListener('pointerdown', (event) => {
    if (staticMode || blindMode) return;
    const point = pointerPoint(event);
    const site = nearestSite(point);
    if (site === null) return;
    selectedSite = site;
    activePointerId = event.pointerId;
    holdStartedAt = performance.now();
    canvas.setPointerCapture?.(event.pointerId);
    renderFrame(armPulse(frame, site));
    event.preventDefault();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (staticMode || blindMode || event.pointerId !== activePointerId) return;
    const elapsed = performance.now() - holdStartedAt;
    activePointerId = null;
    const pending = tickPulse(frame, elapsed);
    renderFrame(releasePulse(pending, 'pointer'));
    event.preventDefault();
  });
  canvas.addEventListener('pointercancel', () => {
    activePointerId = null;
    renderFrame(releaseField());
  });
  document.querySelectorAll('[data-gesture]').forEach((button) => {
    button.addEventListener('click', () => {
      const gesture = button.dataset.gesture;
      if (gesture === 'select') {
        selectedSite = Number(button.dataset.site);
        renderFrame({ ...frame, interaction: 'pulse-armed' });
      } else if (gesture === 'pulse') {
        renderFrame(applyPulse(frame, selectedSite, 420, 'control-pulse'));
      } else if (gesture === 'lift') {
        renderFrame(liftLatest(frame));
      } else if (gesture === 'release') {
        renderFrame(releaseField());
      }
    });
  });
}

function handleKey(event) {
  const key = event.key;
  if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', ' ', 'Enter', 'Delete', 'Backspace', 'Escape'].includes(key)) event.preventDefault();
  if (key === 'ArrowUp') selectedSite = 0;
  if (key === 'ArrowRight') selectedSite = 1;
  if (key === 'ArrowDown') selectedSite = 2;
  if (key === 'ArrowLeft') selectedSite = 3;
  if (key === 'Enter' || key === ' ') renderFrame(applyPulse(frame, selectedSite, 420, 'keyboard-pulse'));
  if (key === 'Delete' || key === 'Backspace') renderFrame(liftLatest(frame));
  if (key === 'Escape' || key.toLowerCase() === 'r') renderFrame(releaseField());
  if (key.toLowerCase() === 's') p5Instance.saveCanvas('mutine-brush-v051', 'png');
  if (key.startsWith('Arrow')) renderFrame({ ...frame, interaction: 'pulse-armed' });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noiseSeed(0x42523531);
    p.frameRate(30);
    p5Instance = p;
    attachEvents();
    document.addEventListener('keydown', handleKey);
    window._p5Ready = true;
    window.__mutineBrushV051 = {
      ready: true,
      getState: () => frame,
      geometrySignature: () => geometrySignature(frame)
    };
    if (staticMode) p.noLoop();
    renderFrame(frame);
  };
  p.draw = () => {
    if (frame.pending.active && holdStartedAt) {
      frame = tickPulse(frame, performance.now() - holdStartedAt);
      if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
    }
    drawFrame(p);
  };
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    p.redraw();
  };
};

new p5(sketch);
