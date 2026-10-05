import {
  STAGES,
  SEGMENT_COUNT,
  buildFrame,
  buildTimeline,
  armPair,
  completePair,
  applyPair,
  liftLatestPair,
  releasePairs,
  geometrySignature,
  segmentPoints
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;

const field = document.querySelector('#bridge-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const pairControl = document.querySelector('#pair-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');

const timeline = buildTimeline(STAGES);
let currentFrame = frozen ? timeline.at(-1) : timeline[0];
let interactionStateName = 'sequence';
let visitorHasTakenOver = false;
let startedAt = performance.now();
let lastStage = currentFrame.stage;
let canvasInstance;

const palette = ['#b85d4b', '#d7b45d', '#779eb2', '#849775', '#c78465', '#9d7c68'];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function safeFrame(frame, state = interactionStateName) {
  currentFrame = frame;
  interactionStateName = state;
  if (stageReadout) {
    stageReadout.textContent = state === 'pair-committed'
      ? 'span lifted / endpoints kept'
      : state === 'pair-refused'
        ? 'one place cannot make a relation'
        : state === 'pair-lifted'
          ? 'latest span lifted'
          : state === 'field-released'
            ? 'field released / first bridge restored'
            : frame.pendingAnchor === null
              ? `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`
              : `segment ${String(frame.pendingAnchor + 1).padStart(2, '0')} is listening`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} span${frame.memory.length === 1 ? '' : 's'} held`;
  if (interactionState) {
    interactionState.textContent = state === 'pair-committed'
      ? 'Two places answered. The endpoints remain; the middle has left the bridge.'
      : state === 'pair-refused'
        ? 'The bridge needs a second, different place.'
        : state === 'pair-lifted'
          ? 'The latest absence is lifted; the previous bridge is exact.'
          : state === 'field-released'
            ? 'All remembered absences are released. The first bridge returns.'
            : frame.pendingAnchor === null
              ? 'The bridge is intact.'
              : `Segment ${frame.pendingAnchor + 1} is held. Touch another segment to answer.`;
  }
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.segmentCount = String(frame.segments.length);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.pending = frame.pendingAnchor === null ? '' : String(frame.pendingAnchor);
  if (canvasInstance) canvasInstance.redraw();
}

function defaultPair() {
  const last = currentFrame.memory.at(-1);
  if (!last) return { from: 2, to: 8 };
  const from = (last.to + 2) % SEGMENT_COUNT;
  return { from, to: Math.min(SEGMENT_COUNT - 1, from + 5) };
}

function commitDefault(source = 'keyboard-pair') {
  const pair = defaultPair();
  visitorHasTakenOver = true;
  safeFrame(applyPair(currentFrame, { ...pair, source }), 'pair-committed');
}

function liftLatest() {
  visitorHasTakenOver = true;
  safeFrame(liftLatestPair(currentFrame), 'pair-lifted');
}

function releaseField() {
  visitorHasTakenOver = true;
  safeFrame(releasePairs(currentFrame), 'field-released');
}

function canvasPoint(event) {
  const rect = canvasInstance.canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function segmentAt(point) {
  let nearest = null;
  let distance = Infinity;
  currentFrame.segments.forEach((segment, index) => {
    if (segment.removed) return;
    const dx = segment.x - point.x;
    const dy = segment.y - point.y;
    const nextDistance = dx * dx + dy * dy;
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = index;
    }
  });
  return distance < 0.06 ? nearest : null;
}

function touchSegment(index) {
  if (index === null || index === undefined) {
    safeFrame(currentFrame, 'pair-refused');
    return;
  }
  visitorHasTakenOver = true;
  if (currentFrame.pendingAnchor === null || currentFrame.pendingAnchor === undefined) {
    safeFrame(armPair(currentFrame, index), 'pair-armed');
    return;
  }
  safeFrame(completePair(currentFrame, index), 'pair-committed');
}

function saveStill() {
  if (canvasInstance) canvasInstance.saveCanvas('mutine-brush-v024', 'png');
}

function bindInput() {
  pairControl.addEventListener('click', () => {
    if (currentFrame.pendingAnchor !== null && currentFrame.pendingAnchor !== undefined) {
      const pair = defaultPair();
      safeFrame(completePair(currentFrame, pair.to), 'pair-committed');
    } else commitDefault('pair-control');
    visitorHasTakenOver = true;
  });
  liftControl.addEventListener('click', liftLatest);
  releaseControl.addEventListener('click', releaseField);
  field.addEventListener('keydown', (event) => {
    if (event.target.closest('button')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (currentFrame.pendingAnchor !== null && currentFrame.pendingAnchor !== undefined) {
        safeFrame(completePair(currentFrame, defaultPair().to), 'pair-committed');
        visitorHasTakenOver = true;
      } else commitDefault('keyboard-pair');
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      liftLatest();
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      releaseField();
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      saveStill();
    }
  });
}

function drawBackground(p) {
  p.background('#111316');
  for (let row = 0; row < 28; row += 1) {
    const amount = row / 27;
    p.noStroke();
    p.fill(p.lerpColor(p.color('#111316'), p.color('#303238'), amount * 0.72));
    p.rect(0, amount * p.height, p.width, p.height / 28 + 1);
  }
  p.noStroke();
  for (let i = 0; i < 520; i += 1) {
    const x = (i * 73.17) % p.width;
    const y = (i * 41.93 + p.width * 0.07) % p.height;
    const alpha = 5 + p.noise(i * 0.09, 3.2) * 17;
    p.fill(238, 230, 213, alpha);
    p.circle(x, y, 0.5 + (i % 3) * 0.35);
  }
  p.fill(215, 180, 93, 12);
  p.ellipse(p.width * 0.52, p.height * 0.48, p.width * 0.72, p.height * 0.9);
}

function screenPoint(p, point) {
  return { x: point.x * p.width, y: point.y * p.height };
}

function drawBridge(p, frame) {
  const active = frame.pendingAnchor;
  const visible = frame.segments.filter((segment) => !segment.removed);
  p.push();
  p.translate(0, 0);
  p.noFill();
  for (let i = 0; i < visible.length - 1; i += 1) {
    const a = visible[i];
    const b = visible[i + 1];
    const pa = screenPoint(p, { x: a.x, y: a.y });
    const pb = screenPoint(p, { x: b.x, y: b.y });
    const stress = Math.max(a.stress, b.stress);
    p.stroke(8, 10, 12, 145);
    p.strokeWeight(42 + stress * 10);
    p.line(pa.x + 10, pa.y + 15, pb.x + 10, pb.y + 15);
    p.stroke(112, 105, 94, 120 - stress * 26);
    p.strokeWeight(31 - stress * 6);
    p.line(pa.x, pa.y, pb.x, pb.y);
    p.stroke(238, 230, 213, 24);
    p.strokeWeight(2);
    p.line(pa.x - 6, pa.y - 4, pb.x - 6, pb.y - 4);
  }
  p.pop();

  frame.segments.forEach((segment, index) => {
    if (segment.removed) return;
    const points = segmentPoints(segment).map((point) => screenPoint(p, point));
    const selected = active === index && !blindMode;
    const tone = palette[index % palette.length];
    const depthTone = p.lerpColor(p.color(tone), p.color('#f2e5c7'), 0.12 + segment.depth * 0.16);
    p.push();
    p.noStroke();
    p.fill(5, 7, 9, 155);
    p.beginShape();
    points.forEach((point) => p.vertex(point.x + 13, point.y + 18));
    p.endShape(p.CLOSE);
    p.fill(depthTone);
    p.beginShape();
    points.forEach((point) => p.vertex(point.x, point.y));
    p.endShape(p.CLOSE);
    p.fill(255, 244, 215, 18 + segment.depth * 20);
    p.beginShape();
    points.forEach((point) => p.vertex(point.x - 4, point.y - 5));
    p.endShape(p.CLOSE);
    p.noFill();
    p.stroke(selected ? '#e7c36c' : 'rgba(238,230,213,.46)');
    p.strokeWeight(selected ? 4 : 1.2);
    p.beginShape();
    points.forEach((point) => p.vertex(point.x, point.y));
    p.endShape(p.CLOSE);
    p.stroke(16, 18, 20, 70);
    p.strokeWeight(1);
    for (let mark = 0; mark < 15; mark += 1) {
      const a = mark / 15;
      const b = ((mark * 7 + index * 3) % 17) / 17;
      const x = p.lerp(points[0].x, points[2].x, a) + (points[1].x - points[0].x) * (b - 0.5) * 0.2;
      const y = p.lerp(points[0].y, points[2].y, a) + (points[1].y - points[0].y) * (b - 0.5) * 0.2;
      p.line(x, y, x + 4 + segment.stress * 3, y - 2);
    }
    if (selected) {
      p.noFill();
      p.stroke(231, 195, 108, 170);
      p.strokeWeight(2);
      p.circle(segment.x * p.width, segment.y * p.height, 34 + segment.depth * 18);
    }
    p.pop();
  });

  const first = frame.segments.find((segment) => !segment.removed);
  const last = [...frame.segments].reverse().find((segment) => !segment.removed);
  if (first && last && frame.memory.length && !blindMode) {
    p.push();
    p.noFill();
    p.stroke(215, 180, 93, 70);
    p.strokeWeight(1);
    p.drawingContext.setLineDash([4, 8]);
    p.line(first.x * p.width, first.y * p.height, last.x * p.width, last.y * p.height);
    p.drawingContext.setLineDash([]);
    p.pop();
  }
}

function createSketch(p) {
  p.setup = () => {
    p.pixelDensity(1);
    const canvas = p.createCanvas(field.clientWidth || 900, field.clientHeight || 560);
    canvas.parent(field);
    canvas.elt.setAttribute('aria-hidden', 'true');
    p.noiseSeed(0x42525544);
    p.frameRate(30);
    bindInput();
    canvas.elt.addEventListener('pointerup', (event) => {
      if (event.target.closest('button')) return;
      touchSegment(segmentAt(canvasPoint(event)));
    });
    window._p5Ready = true;
    window._mutineReady = true;
    safeFrame(currentFrame, 'sequence');
  };

  p.draw = () => {
    drawBackground(p);
    drawBridge(p, currentFrame);
    if (!frozen && !visitorHasTakenOver) {
      const nextStage = Math.min(STAGES - 1, Math.floor((performance.now() - startedAt) / 2700));
      if (nextStage !== lastStage) {
        lastStage = nextStage;
        safeFrame(timeline[nextStage], 'sequence');
      }
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(field.clientWidth || 900, field.clientHeight || 560);
  };
}

canvasInstance = new p5(createSketch);
window.__mutineBrushV024 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    segmentCount: currentFrame.segments.length,
    removed: currentFrame.segments.filter((segment) => segment.removed).length,
    signature: geometrySignature(currentFrame),
    interaction: interactionStateName,
    pending: currentFrame.pendingAnchor
  })
};
