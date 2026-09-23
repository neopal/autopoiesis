export const SEED = 0x53564744;
export const STAGES = 14;
export const PRIMITIVE_BUDGET = 18;
export const MEMORY_LIMIT = 3;
export const GATE_COUNT = 18;

const LANES = [0.25, 0.5, 0.75];
const SLOTS = [0.13, 0.28, 0.43, 0.57, 0.72, 0.87];
const AUTO_CONSTRAINTS = [
  { x: 0.18, y: 0.25 },
  { x: 0.80, y: 0.71 },
  { x: 0.32, y: 0.48 },
  { x: 0.74, y: 0.28 },
  { x: 0.22, y: 0.76 },
  { x: 0.87, y: 0.50 },
  { x: 0.52, y: 0.20 }
];

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyGate(gate) {
  return {
    ...gate,
    x: Number(gate.x),
    y: Number(gate.y),
    width: Number(gate.width),
    height: Number(gate.height),
    angle: Number(gate.angle),
    visible: Boolean(gate.visible)
  };
}

function copyConstraint(constraint) {
  return {
    ...constraint,
    point: copyPoint(constraint.point),
    blockedIndices: [...constraint.blockedIndices],
    corridorOrder: [...constraint.corridorOrder],
    normal: copyPoint(constraint.normal)
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function baseGates(stage) {
  const random = rng(SEED + stage * 7919);
  const gates = [];
  let index = 0;
  for (let lane = 0; lane < LANES.length; lane += 1) {
    for (let slot = 0; slot < SLOTS.length; slot += 1) {
      const stagger = (lane % 2 ? 0.012 : -0.008) * Math.sin(stage * 0.6 + slot);
      const jitter = (random() - 0.5) * 0.014;
      gates.push({
        id: `gate-${String(index).padStart(2, '0')}`,
        x: clamp(SLOTS[slot] + stagger + jitter, 0.075, 0.925),
        y: clamp(LANES[lane] + Math.sin(stage * 0.42 + slot * 0.83 + lane) * 0.014 + (random() - 0.5) * 0.010, 0.13, 0.87),
        width: 0.058 + (slot % 3) * 0.006,
        height: 0.074 + (lane % 2) * 0.008,
        angle: (lane % 2 ? -1 : 1) * (0.22 + slot * 0.035) + stage * 0.012,
        lane,
        slot,
        visible: true,
        role: 'idle'
      });
      index += 1;
    }
  }
  return gates;
}

function nearestIndex(point, gates) {
  return gates.reduce((best, gate, index) => (
    distance(point, gate) < distance(point, gates[best]) ? index : best
  ), 0);
}

function laneIndices(lane) {
  return SLOTS.map((_, slot) => lane * SLOTS.length + slot);
}

function makeConstraint(gates, stage, point, source = 'auto-constraint') {
  const focusIndex = nearestIndex(point, gates);
  const focus = gates[focusIndex];
  const lane = focus.lane;
  const sameLane = laneIndices(lane);
  const localSlot = focus.slot;
  const left = sameLane[(localSlot + 5) % 6];
  const right = sameLane[(localSlot + 1) % 6];
  const blockedIndices = [left, focusIndex, right];
  let gapIndex = (focusIndex + 7 + stage * 2) % gates.length;
  if (blockedIndices.includes(gapIndex)) gapIndex = (gapIndex + 5) % gates.length;
  let escapeIndex = (gapIndex + 6 + lane) % gates.length;
  if (blockedIndices.includes(escapeIndex) || escapeIndex === gapIndex) escapeIndex = (escapeIndex + 4) % gates.length;
  const normal = normalize({ x: point.x - focus.x, y: point.y - focus.y });
  const corridorOrder = [lane, (lane + 1) % LANES.length, (lane + 2) % LANES.length];
  return {
    kind: 'constraint',
    point: copyPoint(point),
    focusIndex,
    lane,
    blockedIndices,
    gapIndex,
    escapeIndex,
    corridorOrder,
    normal,
    source,
    stage
  };
}

function applyMemory(gates, memory) {
  const result = gates.map(copyGate);
  for (const [constraintIndex, constraint] of memory.entries()) {
    const age = memory.length - constraintIndex;
    const strength = 0.72 + age * 0.08;
    for (const index of constraint.blockedIndices) {
      const gate = result[index];
      if (!gate) continue;
      const toward = normalize({ x: constraint.point.x - gate.x, y: constraint.point.y - gate.y });
      gate.x = clamp(lerp(gate.x, constraint.point.x - toward.x * 0.032, 0.16 * strength), 0.055, 0.945);
      gate.y = clamp(lerp(gate.y, constraint.point.y - toward.y * 0.032, 0.16 * strength), 0.11, 0.89);
      gate.angle = lerp(gate.angle, Math.atan2(toward.y, toward.x) + Math.PI / 2, 0.30 * strength);
      gate.width += 0.009 * strength;
      gate.role = 'blocked';
      gate.visible = true;
    }
    const gap = result[constraint.gapIndex];
    if (gap) {
      gap.visible = false;
      gap.role = 'gap';
    }
    const escape = result[constraint.escapeIndex];
    if (escape) {
      const away = normalize({ x: escape.x - constraint.point.x, y: escape.y - constraint.point.y });
      escape.x = clamp(escape.x + away.x * 0.020 * strength, 0.055, 0.945);
      escape.y = clamp(escape.y + away.y * 0.020 * strength, 0.11, 0.89);
      escape.angle += Math.atan2(away.y, away.x) * 0.04 * strength;
      escape.role = 'escape';
      escape.visible = true;
    }
    for (const gate of result) {
      if (constraint.blockedIndices.includes(Number(gate.id.slice(-2)))) continue;
      if (gate.lane === constraint.lane && gate.visible && gate.role === 'idle') {
        gate.angle += Math.sin(gate.slot + constraintIndex * 0.7) * 0.014 * strength;
      }
    }
  }
  return result;
}

function corridorSignature(gates) {
  return LANES.map((_, lane) => gates
    .filter((gate) => gate.lane === lane)
    .map((gate) => `${gate.visible ? '1' : '0'}${gate.role[0]}`)
    .join(''));
}

export function buildFrame(stage, memory = []) {
  const draft = baseGates(stage);
  const inherited = memory.map(copyConstraint);
  const gates = applyMemory(draft, inherited);
  return {
    stage,
    draft: draft.map(copyGate),
    gates,
    memory: inherited,
    corridors: corridorSignature(gates),
    vacancies: gates.filter((gate) => !gate.visible).length,
    blocked: gates.filter((gate) => gate.visible && gate.role === 'blocked').length,
    escapes: gates.filter((gate) => gate.visible && gate.role === 'escape').length,
    cutCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const point = AUTO_CONSTRAINTS[((stage - 1) / 2) % AUTO_CONSTRAINTS.length];
      const constraint = makeConstraint(frame.gates, stage, point);
      memory = [...memory, constraint].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyConstraint(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.18, 0.82)
  };
  const constraint = makeConstraint(frame.gates, frame.stage, bounded, 'visitor-constraint');
  const priorMemory = frame.memory.map(copyConstraint);
  const next = buildFrame(frame.stage, [...frame.memory, constraint].slice(-MEMORY_LIMIT));
  return { ...next, constraint, priorMemory, interaction: 'visitor-constraint' };
}

export function deleteConstraint(frame, constraintIndex = frame.memory.length - 1) {
  if (constraintIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (constraintIndex < 0 || constraintIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== constraintIndex);
  return buildFrame(frame.stage, memory);
}
