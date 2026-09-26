import {
  STAGES,
  buildTimeline,
  buildFrame,
  dryPulse,
  liftLatestPulse
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4400;

const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const dryControl = document.querySelector('#dry-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const coil = document.querySelector('#coil');

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];

const palette = {
  ground: '#081215',
  deep: '#020708',
  ink: '#e8e3d4',
  copper: '#e28d62',
  ochre: '#f0c676',
  cyan: '#70b9b2',
  violet: '#b77fa0',
  teal: '#2b6870',
  shadow: '#010304'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function colourFor(index) {
  return [palette.copper, palette.ochre, palette.cyan, palette.violet, '#c9a07e'][index % 5];
}

function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function drawAtmosphere(p, frame, now) {
  p.push();
  p.noStroke();
  p.translate(0, 0, -280);
  p.fill(rgba(palette.teal, 0.035));
  p.ellipse(-p.width * 0.12, -p.height * 0.04, p.width * 0.72, p.height * 0.72);
  p.fill(rgba(palette.copper, 0.022));
  p.ellipse(p.width * 0.22, p.height * 0.17, p.width * 0.42, p.height * 0.32);
  p.pop();

  p.push();
  p.strokeWeight(Math.max(0.35, p.width * 0.00028));
  for (let index = 0; index < 260; index += 1) {
    const angle = index * 2.399 + frame.stage * 0.013;
    const radius = 80 + ((index * 83) % 370);
    const x = Math.cos(angle + now * 0.00003) * radius;
    const y = Math.sin(angle * 1.17) * radius * 0.54;
    const z = Math.cos(angle * 0.71) * 120 - 80;
    p.stroke(index % 29 === 0 ? rgba(palette.ochre, 0.24) : rgba(palette.ink, 0.07));
    p.point(x, y, z);
  }
  p.pop();
}

function coilPoint(p, band, theta, scale) {
  const localDeflection = band.deflection * Math.sin(theta * 1.4 + band.phase * 0.7);
  const radius = (band.radius + localDeflection * 0.12) * scale;
  const x = Math.cos(theta) * radius;
  const y = Math.sin(theta) * radius * 0.72;
  const z = Math.sin(theta * band.twist + band.phase) * band.height * scale * 0.38;
  return { x, y, z };
}

function drawWetBand(p, band, scale, time) {
  const steps = 86;
  const colour = colourFor(band.bandIndex);
  p.push();
  p.noFill();
  p.stroke(colour);
  p.strokeWeight(Math.max(1.25, p.width * (0.0014 + band.grain * 0.0009)));
  p.beginShape(p.LINE_STRIP);
  for (let step = 0; step <= steps; step += 1) {
    const theta = (step / steps) * Math.PI * 2.55 + band.phase + time;
    const point = coilPoint(p, band, theta, scale);
    p.vertex(point.x, point.y, point.z);
  }
  p.endShape();

  p.stroke(rgba(palette.ink, 0.18));
  p.strokeWeight(Math.max(0.45, p.width * 0.00042));
  for (let bristle = 9; bristle < steps; bristle += 17) {
    const theta = (bristle / steps) * Math.PI * 2.55 + band.phase + time;
    const start = coilPoint(p, band, theta, scale);
    const end = {
      x: start.x * 1.025,
      y: start.y * 1.025,
      z: start.z + (band.bandIndex % 2 ? 1 : -1) * scale * 0.028
    };
    p.line(start.x, start.y, start.z, end.x, end.y, end.z);
  }
  p.pop();
}

function drawDryBand(p, band, dry, scale, time) {
  const steps = 86;
  const colour = colourFor(dry.bandIndex);
  const skipStride = Math.max(5, Math.floor(steps / dry.fragmentCount));
  p.push();
  p.noFill();
  p.stroke(colour);
  p.strokeWeight(Math.max(1.4, p.width * 0.0017));
  let open = false;
  for (let step = 0; step <= steps; step += 1) {
    const shouldSkip = step % skipStride < 2 || (step + dry.bandIndex) % 19 === 0;
    if (shouldSkip) {
      if (open) {
        p.endShape();
        open = false;
      }
      continue;
    }
    if (!open) {
      p.beginShape(p.LINE_STRIP);
      open = true;
    }
    const theta = (step / steps) * Math.PI * 2.55 + band.phase + time;
    const point = coilPoint(p, band, theta, scale);
    p.vertex(point.x, point.y, point.z);
  }
  if (open) p.endShape();

  p.stroke(rgba(palette.ochre, 0.74));
  p.strokeWeight(Math.max(0.7, p.width * 0.0007));
  for (let fragment = 0; fragment < dry.fragmentCount; fragment += 1) {
    const ratio = (fragment + 0.5) / dry.fragmentCount;
    const theta = dry.anchorAngle + ratio * Math.PI * 2.55 + time;
    const base = coilPoint(p, band, theta, scale);
    const lift = dry.fragmentLift * scale * (0.55 + ratio);
    const spread = Math.sin(fragment * 2.7 + dry.bandIndex) * dry.fragmentSpread * scale;
    const end = {
      x: base.x + Math.cos(theta + Math.PI * 0.5) * spread,
      y: base.y + Math.sin(theta + Math.PI * 0.5) * spread,
      z: base.z + lift
    };
    p.line(base.x, base.y, base.z, end.x, end.y, end.z);
  }
  p.pop();
}

function drawCore(p, frame, scale) {
  p.push();
  p.noFill();
  p.stroke(rgba(palette.cyan, 0.14));
  p.strokeWeight(Math.max(0.6, p.width * 0.00055));
  p.ellipse(0, 0, scale * 0.72, scale * 0.52);
  p.stroke(rgba(palette.ochre, 0.1));
  p.ellipse(0, 0, scale * 0.52, scale * 0.38);
  p.pop();

  // The work carries its own witness in the coil geometry; no canvas caption is needed.
}

function render(p, frame, state = 'sequence', now = performance.now()) {
  p.background(palette.deep);
  p.ambientLight(24, 36, 38);
  p.directionalLight(104, 84, 62, -0.4, 0.5, -1);
  p.directionalLight(40, 110, 112, 0.6, -0.25, -0.5);

  drawAtmosphere(p, frame, now);
  const scale = Math.min(p.width, p.height) * 0.43;
  const motion = frozen ? 0 : now * 0.00011;
  p.push();
  p.rotateX(-0.33 + Math.sin(now * 0.00014) * 0.025);
  p.rotateY(motion * 0.45 + frame.stage * 0.008);
  p.rotateZ(-0.17);
  frame.bands.forEach((band) => {
    const dry = frame.dryBands.find((item) => item.bandIndex === band.bandIndex);
    if (dry) drawDryBand(p, band, dry, scale, motion);
    else drawWetBand(p, band, scale, motion);
  });
  drawCore(p, frame, scale);
  p.pop();

  if (stageReadout) stageReadout.textContent = state === 'visitor-dry-pulse'
    ? 'drying pulse registered / the seam is routing the coil'
    : state === 'pulse-lifted'
      ? 'latest seam lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} seam${frame.memory.length === 1 ? '' : 's'} held · ${frame.dryBands.length} dry band${frame.dryBands.length === 1 ? '' : 's'}`;
  if (interactionState) interactionState.textContent = state === 'visitor-dry-pulse'
    ? 'One band has fractured; the wet bands are routing around it.'
    : state === 'pulse-lifted'
      ? 'The latest seam is gone; the prior coil is exact.'
      : 'The coil is still wet inside.';
  if (coil) {
    coil.dataset.stage = String(frame.stage);
    coil.dataset.memory = String(frame.memory.length);
    coil.dataset.seams = String(frame.dryBands.length);
    coil.dataset.interaction = state;
  }
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function renderCurrent(p, now = performance.now()) {
  if (interactionFrame) {
    currentFrame = interactionFrame;
    render(p, interactionFrame, interactionFrame.interaction ?? 'visitor-dry-pulse', now);
    return;
  }
  currentFrame = frozen ? timeline.at(-1) : frameAt(now);
  render(p, currentFrame, 'sequence', now);
}

function commitPulse(p, direction = 1) {
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = dryPulse(baseline, { direction });
  renderCurrent(p);
}

function liftLatest(p) {
  if (!interactionFrame) return;
  interactionFrame = liftLatestPulse(interactionFrame);
  renderCurrent(p);
}

function releaseCoil(p) {
  interactionFrame = null;
  startedAt = performance.now();
  renderCurrent(p);
}

const sketch = (p) => {
  p.setup = () => {
    const bounds = coil.getBoundingClientRect();
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    const canvas = p.createCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height), p.WEBGL);
    canvas.parent('coil');
    canvas.id('coil-canvas');
    canvas.elt.tabIndex = 0;
    canvas.elt.setAttribute('aria-label', 'Interactive drying coil canvas');
    renderCurrent(p);
    if (frozen) p.noLoop();
  };

  p.draw = () => renderCurrent(p, performance.now());

  p.keyPressed = () => {
    if (staticPreview) return false;
    if (p.key === 'd' || p.key === 'D' || p.key === 'Enter' || p.key === ' ') commitPulse(p, 1);
    if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) liftLatest(p);
    if (p.key && p.key.toLowerCase() === 'r') releaseCoil(p);
    if (p.key && p.key.toLowerCase() === 's') p.saveCanvas('mutine-brush-v020', 'png');
    return false;
  };

  p.windowResized = () => {
    const bounds = coil.getBoundingClientRect();
    p.resizeCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height));
    renderCurrent(p);
  };
};

const instance = new window.p5(sketch);
dryControl?.addEventListener('click', () => commitPulse(instance, 1));
liftControl?.addEventListener('click', () => liftLatest(instance));
releaseControl?.addEventListener('click', () => releaseCoil(instance));
