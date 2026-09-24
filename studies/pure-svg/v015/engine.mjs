export const SEED = 0x53564745;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 9;
export const MEMORY_LIMIT = 4;
export const TERRITORY_COUNT = 5;

const LAYOUT = [
  { x: 0.22, y: 0.30, scale: 0.17, rotation: -0.22 },
  { x: 0.49, y: 0.22, scale: 0.18, rotation: 0.18 },
  { x: 0.77, y: 0.32, scale: 0.16, rotation: 0.08 },
  { x: 0.68, y: 0.65, scale: 0.21, rotation: -0.12 },
  { x: 0.30, y: 0.67, scale: 0.19, rotation: 0.20 }
];

const AUTO_ATTENTIONS = [
  { x: 0.18, y: 0.28 },
  { x: 0.80, y: 0.70 },
  { x: 0.47, y: 0.20 },
  { x: 0.31, y: 0.75 },
  { x: 0.84, y: 0.36 },
  { x: 0.61, y: 0.62 },
  { x: 0.23, y: 0.42 },
  { x: 0.51, y: 0.78 }
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

function copyHole(hole) {
  return {
    center: copyPoint(hole.center),
    radiusX: Number(hole.radiusX),
    radiusY: Number(hole.radiusY),
    rotation: Number(hole.rotation)
  };
}

function copyTerritory(territory) {
  return {
    ...territory,
    center: copyPoint(territory.center),
    anchor: copyPoint(territory.anchor),
    contour: territory.contour.map(copyPoint),
    hole: copyHole(territory.hole),
    visible: Boolean(territory.visible),
    holeOpen: Boolean(territory.holeOpen)
  };
}

function copyAttention(attention) {
  return {
    ...attention,
    point: copyPoint(attention.point),
    normal: copyPoint(attention.normal)
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function makeContour(index, stage) {
  const random = rng(SEED + index * 97 + stage * 7919);
  return Array.from({ length: 11 }, (_, pointIndex) => {
    const angle = (Math.PI * 2 * pointIndex) / 11;
    const lobe = 0.84 + random() * 0.22 + Math.sin(pointIndex * 1.8 + index) * 0.035;
    return {
      x: Math.cos(angle) * lobe,
      y: Math.sin(angle) * lobe * (0.82 + (index % 2) * 0.10)
    };
  });
}

function baseTerritories(stage) {
  return LAYOUT.map((layout, index) => {
    const drift = Math.sin(stage * 0.34 + index * 1.7) * 0.008;
    const twist = Math.cos(stage * 0.25 + index * 0.8) * 0.018;
    const center = {
      x: clamp(layout.x + drift * (index % 2 ? -1 : 1), 0.14, 0.86),
      y: clamp(layout.y + drift * (index % 2 ? 1 : -1), 0.16, 0.84)
    };
    const scale = layout.scale + Math.sin(stage * 0.31 + index) * 0.008;
    const rotation = layout.rotation + twist;
    const hole = {
      center: {
        x: center.x + Math.cos(rotation + index) * scale * 0.12,
        y: center.y + Math.sin(rotation + index) * scale * 0.12
      },
      radiusX: scale * (0.27 + (index % 2) * 0.04),
      radiusY: scale * (0.18 + (index % 3) * 0.03),
      rotation: rotation - 0.16
    };
    return {
      id: `territory-${String(index).padStart(2, '0')}`,
      kind: 'compound',
      center,
      anchor: {
        x: center.x + Math.cos(rotation - 0.6) * scale * 0.32,
        y: center.y + Math.sin(rotation - 0.6) * scale * 0.32
      },
      contour: makeContour(index, stage),
      hole,
      scale,
      rotation,
      visible: true,
      holeOpen: true,
      role: 'idle',
      phase: (stage * 0.12 + index * 0.71) % (Math.PI * 2)
    };
  });
}

function nearestIndex(point, territories) {
  return territories.reduce((best, territory, index) => (
    distance(point, territory.anchor) < distance(point, territories[best].anchor) ? index : best
  ), 0);
}

function copyMemory(memory) {
  return memory.map(copyAttention);
}

function makeAttention(territories, stage, point, source = 'auto-attention') {
  const hostIndex = nearestIndex(point, territories);
  const receiverOffset = 1 + ((stage + hostIndex) % (territories.length - 1));
  const receiverIndex = (hostIndex + receiverOffset) % territories.length;
  const holeIndex = (hostIndex + 1) % territories.length;
  const host = territories[hostIndex];
  const receiver = territories[receiverIndex];
  const normal = normalize({ x: point.x - host.center.x, y: point.y - host.center.y });
  return {
    kind: 'attention',
    point: copyPoint(point),
    hostIndex,
    receiverIndex,
    holeIndex,
    normal,
    source,
    stage
  };
}

function applyMemory(territories, memory) {
  const result = territories.map(copyTerritory);
  for (const [attentionIndex, attention] of memory.entries()) {
    const age = memory.length - attentionIndex;
    const strength = 0.72 + age * 0.09;
    const host = result[attention.hostIndex];
    const receiver = result[attention.receiverIndex];
    const displaced = result[attention.holeIndex];

    if (host) {
      const toward = normalize({ x: attention.point.x - host.center.x, y: attention.point.y - host.center.y });
      host.holeOpen = false;
      host.role = 'closing';
      host.scale = Math.max(0.13, host.scale - 0.014 * strength);
      host.center.x = clamp(host.center.x + toward.x * 0.018 * strength, 0.12, 0.88);
      host.center.y = clamp(host.center.y + toward.y * 0.018 * strength, 0.14, 0.86);
      host.anchor.x = clamp(host.anchor.x + toward.x * 0.026 * strength, 0.10, 0.90);
      host.anchor.y = clamp(host.anchor.y + toward.y * 0.026 * strength, 0.12, 0.88);
      host.rotation += Math.atan2(toward.y, toward.x) * 0.05 * strength;
      host.hole.center = copyPoint(host.center);
    }

    if (receiver) {
      const away = normalize({ x: receiver.center.x - attention.point.x, y: receiver.center.y - attention.point.y });
      receiver.holeOpen = true;
      receiver.role = 'receiving';
      receiver.scale = Math.min(0.245, receiver.scale + 0.020 * strength);
      receiver.center.x = clamp(receiver.center.x + away.x * 0.016 * strength, 0.12, 0.88);
      receiver.center.y = clamp(receiver.center.y + away.y * 0.016 * strength, 0.14, 0.86);
      receiver.anchor.x = clamp(receiver.anchor.x + away.x * 0.022 * strength, 0.10, 0.90);
      receiver.anchor.y = clamp(receiver.anchor.y + away.y * 0.022 * strength, 0.12, 0.88);
      receiver.rotation += Math.atan2(away.y, away.x) * 0.04 * strength;
      receiver.hole.center = {
        x: receiver.center.x - away.x * receiver.scale * 0.16,
        y: receiver.center.y - away.y * receiver.scale * 0.16
      };
      receiver.hole.radiusX = Math.min(receiver.scale * 0.37, receiver.hole.radiusX + 0.012 * strength);
      receiver.hole.radiusY = Math.min(receiver.scale * 0.30, receiver.hole.radiusY + 0.010 * strength);
    }

    if (displaced && displaced !== host && displaced !== receiver) {
      displaced.role = 'witness';
      displaced.rotation += Math.sin(attentionIndex + displaced.phase) * 0.026 * strength;
      displaced.anchor.x = clamp(displaced.anchor.x + Math.cos(displaced.phase) * 0.008 * strength, 0.10, 0.90);
      displaced.anchor.y = clamp(displaced.anchor.y + Math.sin(displaced.phase) * 0.008 * strength, 0.12, 0.88);
    }
  }
  return result;
}

function topologySignature(territories) {
  return territories.map((territory) => `${territory.holeOpen ? 'O' : 'C'}:${territory.role[0]}`).join('');
}

export function buildFrame(stage, memory = []) {
  const draft = baseTerritories(stage);
  const inherited = copyMemory(memory);
  const territories = applyMemory(draft, inherited);
  return {
    stage,
    draft: draft.map(copyTerritory),
    territories,
    memory: inherited,
    holes: territories.filter((territory) => territory.holeOpen).length,
    closedVoids: territories.filter((territory) => !territory.holeOpen).length,
    topology: topologySignature(territories),
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const point = AUTO_ATTENTIONS[((stage - 1) / 2) % AUTO_ATTENTIONS.length];
      const attention = makeAttention(frame.territories, stage, point);
      memory = [...memory, attention].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyAttention(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.14, 0.86),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.18, 0.82)
  };
  const attention = makeAttention(frame.territories, frame.stage, bounded, 'visitor-attention');
  const priorMemory = copyMemory(frame.memory);
  const next = buildFrame(frame.stage, [...frame.memory, attention].slice(-MEMORY_LIMIT));
  return { ...next, attention, priorMemory, interaction: 'visitor-attention' };
}

export function deleteAttention(frame, attentionIndex = frame.memory.length - 1) {
  if (attentionIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (attentionIndex < 0 || attentionIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== attentionIndex);
  return buildFrame(frame.stage, memory);
}
