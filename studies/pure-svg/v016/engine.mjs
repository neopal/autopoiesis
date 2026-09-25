export const SEED = 0x53564746;
export const STAGES = 18;
export const PRIMITIVE_BUDGET = 12;
export const MEMORY_LIMIT = 4;
export const JOINT_COUNT = 6;
export const COMMIT_THRESHOLD = 0.65;

const AUTO_WITNESSES = [
  { x: 0.18, y: 0.44 },
  { x: 0.82, y: 0.54 },
  { x: 0.48, y: 0.22 },
  { x: 0.68, y: 0.77 },
  { x: 0.28, y: 0.70 },
  { x: 0.86, y: 0.28 }
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function point(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyJoint(joint) {
  return { ...joint, center: point(joint.center) };
}

function copySegment(segment) {
  return { ...segment, a: point(segment.a), b: point(segment.b) };
}

function copyEcho(echo) {
  return { ...echo, center: point(echo.center) };
}

function copyWitness(witness) {
  return { ...witness, point: point(witness.point) };
}

function copyMemory(memory) {
  return memory.map(copyWitness);
}

function baseJoints(stage) {
  return Array.from({ length: JOINT_COUNT }, (_, index) => {
    const random = rng(SEED + stage * 997 + index * 131);
    const t = index / (JOINT_COUNT - 1);
    const x = 0.17 + t * 0.66 + Math.sin(stage * 0.20 + index * 1.12) * 0.012;
    const y = 0.50 + Math.sin(t * Math.PI * 1.35 - 0.52) * 0.18 + Math.cos(stage * 0.17 + index) * 0.012;
    const nextX = 0.17 + Math.min(1, t + 0.05) * 0.66;
    const nextY = 0.50 + Math.sin(Math.min(1, t + 0.05) * Math.PI * 1.35 - 0.52) * 0.18;
    return {
      id: `joint-${String(index).padStart(2, '0')}`,
      center: { x: clamp(x, 0.12, 0.88), y: clamp(y, 0.18, 0.82) },
      angle: Math.atan2(nextY - y, nextX - x) + (random() - 0.5) * 0.22,
      length: 0.16 + random() * 0.025,
      width: 0.045 + random() * 0.012,
      role: 'idle',
      radius: 0.08 + random() * 0.012
    };
  });
}

function makeSegments(joints) {
  return joints.slice(0, -1).map((joint, index) => ({
    id: `segment-${String(index).padStart(2, '0')}`,
    from: index,
    to: index + 1,
    a: point(joint.center),
    b: point(joints[index + 1].center),
    width: 0.034 + ((index % 2) * 0.008),
    visible: true,
    role: 'body'
  }));
}

function makeEchoes() {
  return Array.from({ length: MEMORY_LIMIT }, (_, index) => ({
    id: `echo-${String(index).padStart(2, '0')}`,
    visible: false,
    memoryIndex: index,
    sourceIndex: -1,
    receiverIndex: -1,
    center: { x: 0.5, y: 0.5 },
    rotation: 0,
    length: 0,
    width: 0,
    role: 'dormant'
  }));
}

function nearestJoint(pointValue, joints) {
  return joints.reduce((best, joint, index) => (
    distance(pointValue, joint.center) < distance(pointValue, joints[best].center) ? index : best
  ), 0);
}

function makeWitness(joints, stage, value, source = 'auto-witness') {
  const sourceIndex = nearestJoint(value, joints);
  const receiverIndex = (sourceIndex + 2 + (stage % 2)) % JOINT_COUNT;
  const sourceSegment = Math.min(sourceIndex, JOINT_COUNT - 2);
  return {
    kind: 'witness',
    mode: 'held-gaze',
    commitThreshold: COMMIT_THRESHOLD,
    point: point(value),
    sourceIndex,
    receiverIndex,
    sourceSegment,
    source,
    stage
  };
}

function applyMemory(joints, segments, echoes, memory) {
  const nextJoints = joints.map(copyJoint);
  const nextSegments = segments.map(copySegment);
  const nextEchoes = echoes.map(copyEcho);

  for (const [memoryIndex, witness] of memory.entries()) {
    const age = memory.length - memoryIndex;
    const strength = 0.78 + age * 0.10;
    const source = nextJoints[witness.sourceIndex];
    const receiver = nextJoints[witness.receiverIndex];
    const segment = nextSegments[witness.sourceSegment];
    const echo = nextEchoes[memoryIndex % MEMORY_LIMIT];

    if (source) {
      source.role = 'sacrificed';
      source.width *= Math.max(0.42, 1 - 0.13 * strength);
      source.length *= Math.max(0.48, 1 - 0.09 * strength);
      source.center.x = clamp(source.center.x + (witness.point.x - source.center.x) * 0.045 * strength, 0.10, 0.90);
      source.center.y = clamp(source.center.y + (witness.point.y - source.center.y) * 0.045 * strength, 0.14, 0.86);
      source.angle += 0.18 * strength;
    }

    if (receiver) {
      receiver.role = 'inherited';
      receiver.width = Math.min(0.095, receiver.width + 0.014 * strength);
      receiver.length = Math.min(0.24, receiver.length + 0.024 * strength);
      receiver.radius = Math.min(0.15, receiver.radius + 0.014 * strength);
      receiver.angle -= 0.22 * strength;
      receiver.center.x = clamp(receiver.center.x + (receiver.center.x - witness.point.x) * 0.034 * strength, 0.10, 0.90);
      receiver.center.y = clamp(receiver.center.y + (receiver.center.y - witness.point.y) * 0.034 * strength, 0.14, 0.86);
    }

    if (segment) {
      segment.visible = false;
      segment.role = 'sacrificed';
    }

    if (echo) {
      echo.visible = true;
      echo.sourceIndex = witness.sourceIndex;
      echo.receiverIndex = witness.receiverIndex;
      echo.center = receiver ? point(receiver.center) : point(witness.point);
      echo.rotation = (receiver?.angle ?? 0) + 0.78 * strength;
      echo.length = receiver ? receiver.length * (0.72 + age * 0.06) : 0.14;
      echo.width = receiver ? receiver.width * 0.72 : 0.04;
      echo.role = 'inherited-joint';
    }
  }

  return { joints: nextJoints, segments: nextSegments, echoes: nextEchoes };
}

function bodySignature(joints, segments, echoes) {
  return [
    joints.map((joint) => `${joint.role[0]}:${joint.center.x.toFixed(4)}:${joint.center.y.toFixed(4)}`).join('|'),
    segments.map((segment) => `${segment.visible ? '1' : '0'}:${segment.role[0]}`).join('|'),
    echoes.map((echo) => `${echo.visible ? '1' : '0'}:${echo.receiverIndex}`).join('|')
  ].join('||');
}

export function buildFrame(stage, memory = []) {
  const inherited = copyMemory(memory);
  const base = baseJoints(stage);
  const baseSegments = makeSegments(base);
  const applied = applyMemory(base, baseSegments, makeEchoes(), inherited);
  return {
    stage,
    grammar: 'single-articulated-body',
    joints: applied.joints,
    segments: applied.segments,
    echoes: applied.echoes,
    memory: inherited,
    sacrificedSegments: applied.segments.filter((segment) => !segment.visible).length,
    inheritedEchoes: applied.echoes.filter((echo) => echo.visible).length,
    primitiveBudget: PRIMITIVE_BUDGET,
    bodySignature: bodySignature(applied.joints, applied.segments, applied.echoes)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const value = AUTO_WITNESSES[((stage - 1) / 2) % AUTO_WITNESSES.length];
      memory = [...memory, makeWitness(frame.joints, stage, value)].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyAttention(frame, value) {
  const rawX = Number(value?.x);
  const rawY = Number(value?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.14, 0.86),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.18, 0.82)
  };
  const witness = makeWitness(frame.joints, frame.stage, bounded, 'visitor-witness');
  const priorMemory = copyMemory(frame.memory);
  const next = buildFrame(frame.stage, [...frame.memory, witness].slice(-MEMORY_LIMIT));
  return { ...next, attention: witness, priorMemory, interaction: 'visitor-witness' };
}

export function deleteAttention(frame, attentionIndex = frame.memory.length - 1) {
  if (attentionIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (attentionIndex < 0 || attentionIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  return buildFrame(frame.stage, frame.memory.filter((_, index) => index !== attentionIndex));
}

export function releaseAttention() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  return frame.bodySignature;
}
