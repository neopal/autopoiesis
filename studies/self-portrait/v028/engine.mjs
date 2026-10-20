export const SEED = 0x43504658;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const PLATE_COUNT = 11;
export const PRIMITIVE_BUDGET = 66;

const RULES = ['fold', 'counterfold', 'interleave', 'hinge'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const modulo = (value, length) => ((value % length) + length) % length;

function seeded(index, stage, salt = 0) {
  const value = Math.sin((index + 1 + salt) * 19.193 + (stage + 1) * 47.117 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function basePlate(index, stage) {
  const side = index % 2 === 0 ? -1 : 1;
  return {
    index,
    x: (index - (PLATE_COUNT - 1) / 2) * 0.095 + (seeded(index, stage, 1) - 0.5) * 0.035,
    y: (seeded(index, stage, 2) - 0.5) * 0.18 + side * 0.018,
    z: (index - (PLATE_COUNT - 1) / 2) * 0.08,
    width: 0.34 + seeded(index, stage, 3) * 0.18,
    height: 0.84 + seeded(index, stage, 4) * 0.22,
    tilt: (seeded(index, stage, 5) - 0.5) * 0.24 + side * 0.035,
    fold: (seeded(index, stage, 6) - 0.5) * 0.12,
    crease: seeded(index, stage, 7),
    phase: seeded(index, stage, 8) * Math.PI * 2,
    state: 'quiet'
  };
}

function baseFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, STAGES - 1);
  return {
    composition: 'folded-grammar-volume',
    stage: safeStage,
    plates: Array.from({ length: PLATE_COUNT }, (_, index) => basePlate(index, safeStage)),
    ruleIndex: 0,
    checksum: 0,
    memory: [],
    commits: [],
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    ruleIndex: frame.ruleIndex,
    checksum: frame.checksum,
    plates: frame.plates.map((plate) => [
      plate.index,
      Number(plate.x.toFixed(5)),
      Number(plate.y.toFixed(5)),
      Number(plate.z.toFixed(5)),
      Number(plate.width.toFixed(5)),
      Number(plate.height.toFixed(5)),
      Number(plate.tilt.toFixed(5)),
      Number(plate.fold.toFixed(5)),
      Number(plate.crease.toFixed(5)),
      plate.state
    ])
  });
}

function normalizePoints(input) {
  const points = Array.isArray(input?.points) ? input.points : [];
  return points
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map(([x, y]) => [clamp(Number(x) || 0, -1, 1), clamp(Number(y) || 0, -1, 1)]);
}

export function gestureGeometry(input = {}) {
  const points = normalizePoints(input);
  let length = 0;
  let turns = 0;
  let previousAngle = null;
  let curvature = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index][0] - points[index - 1][0];
    const dy = points[index][1] - points[index - 1][1];
    const segmentLength = Math.hypot(dx, dy);
    length += segmentLength;
    const angle = Math.atan2(dy, dx);
    if (previousAngle !== null) {
      let delta = angle - previousAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      curvature += delta;
      if (Math.abs(delta) > 0.42) turns += 1;
    }
    previousAngle = angle;
  }
  return {
    points,
    length,
    turns,
    curvature,
    direction: points.length > 1 ? Math.sign(points.at(-1)[0] - points[0][0]) || 1 : 0
  };
}

function chooseRoles(frame, gesture) {
  const pathCode = Math.round(Math.abs(gesture.curvature) * 13 + gesture.length * 17 + gesture.turns * 5);
  const hingeIndex = modulo(frame.checksum + frame.memory.length * 7 + frame.ruleIndex * 11 + pathCode, PLATE_COUNT);
  const counterOffset = 2 + modulo(gesture.turns + Math.round(gesture.length * 3) + frame.ruleIndex, 4);
  const counterIndex = modulo(hingeIndex + counterOffset, PLATE_COUNT);
  const relayIndex = modulo(counterIndex + 2 + Math.abs(Math.round(gesture.curvature * 2)), PLATE_COUNT);
  return { hingeIndex, counterIndex, relayIndex, pathCode };
}

function applyGesture(frame, gesture) {
  const next = clone(frame);
  const previous = clone(frame);
  delete previous.undo;
  const { hingeIndex, counterIndex, relayIndex, pathCode } = chooseRoles(frame, gesture);
  const energy = clamp(gesture.length * 0.46 + gesture.turns * 0.12 + Math.abs(gesture.curvature) * 0.06, 0.12, 0.92);
  const ruleBefore = frame.ruleIndex;
  const ruleAfter = modulo(ruleBefore + 1 + gesture.turns + (gesture.direction < 0 ? 1 : 0), RULES.length);
  const hinge = next.plates[hingeIndex];
  const counter = next.plates[counterIndex];
  const relay = next.plates[relayIndex];

  next.plates.forEach((plate) => {
    if (plate.state !== 'quiet') plate.state = 'trace';
  });

  hinge.state = 'hinge';
  hinge.fold = clamp(hinge.fold + 0.2 + energy * 0.3, -1, 1);
  hinge.tilt += (gesture.direction || 1) * (0.08 + energy * 0.06);
  hinge.z += 0.04 + energy * 0.08;
  hinge.crease = clamp(hinge.crease + 0.18 + energy * 0.16, 0, 1.4);

  counter.state = 'counterfold';
  counter.fold = clamp(counter.fold - 0.16 - energy * 0.26, -1, 1);
  counter.tilt -= (gesture.direction || 1) * (0.06 + energy * 0.04);
  counter.z -= 0.04 + energy * 0.07;
  counter.crease = clamp(counter.crease + 0.13 + energy * 0.11, 0, 1.4);

  relay.state = 'relay';
  relay.y += (gesture.curvature >= 0 ? 1 : -1) * (0.04 + energy * 0.045);
  relay.fold += gesture.curvature >= 0 ? 0.08 : -0.08;
  relay.width = clamp(relay.width * (0.95 - energy * 0.04), 0.18, 0.7);

  const checksum = (pathCode * 17 + hingeIndex * 23 + counterIndex * 31 + relayIndex * 13 + frame.memory.length * 19 + ruleAfter * 29) % 100003;
  const event = {
    id: `visitor-gesture-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'visitor-gesture',
    kind: 'grammar-fold',
    points: gesture.points,
    length: Number(gesture.length.toFixed(6)),
    turns: gesture.turns,
    curvature: Number(gesture.curvature.toFixed(6)),
    direction: gesture.direction,
    energy: Number(energy.toFixed(6)),
    hingeIndex,
    counterIndex,
    relayIndex,
    ruleBefore,
    ruleAfter,
    historyBefore: frame.memory.length,
    reason: 'the gesture is parsed by the current grammar; a non-local hinge folds, a counterfold answers, and a relay changes the next grammar'
  };

  next.ruleIndex = ruleAfter;
  next.checksum = checksum;
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.commits = [...frame.commits, event].slice(-MEMORY_LIMIT);
  next.interaction = 'grammar-fold';
  next.undo = previous;
  return next;
}

export function buildFrame(stage = 0, memory = []) {
  let frame = baseFrame(stage);
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) {
    frame = commitGesture(frame, { points: event.points });
  }
  frame.interaction = 'sequence';
  return frame;
}

export function commitGesture(frame, input = {}) {
  const gesture = gestureGeometry(input);
  if (gesture.points.length < 3 || gesture.length < 0.2) {
    const refused = clone(frame);
    refused.interaction = 'gesture-refused';
    return refused;
  }
  return applyGesture(frame, gesture);
}

export function liftLatestGesture(frame) {
  if (!frame.memory.length) {
    const untouched = clone(frame);
    untouched.interaction = 'lifted-empty';
    return untouched;
  }
  if (frame.undo) {
    const restored = clone(frame.undo);
    restored.interaction = 'lifted';
    return restored;
  }
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'lifted';
  return restored;
}

export function releaseGrammar(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'released';
  return released;
}

const CUES = [
  { points: [[-0.82, -0.34], [-0.32, 0.28], [0.08, -0.18], [0.76, 0.34]] },
  { points: [[-0.75, 0.46], [-0.25, -0.22], [0.22, 0.42], [0.78, -0.38]] },
  { points: [[-0.7, -0.46], [-0.22, 0.1], [0.16, -0.4], [0.72, 0.24]] },
  { points: [[-0.78, 0.22], [-0.34, -0.34], [0.2, 0.18], [0.74, 0.46]] }
];

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[2, 0], [6, 1], [10, 2], [14, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = commitGesture(frame, CUES[eventStages.get(stage)]);
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}

export const RULE_NAMES = RULES;
