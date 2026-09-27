export const SEED = 0x53564748;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 14;
export const MEMORY_LIMIT = 4;
export const PLATE_COUNT = 9;

const AUTO_COUNTERMARKS = [
  { x: 0.18, y: 0.42 },
  { x: 0.76, y: 0.30 },
  { x: 0.54, y: 0.76 },
  { x: 0.32, y: 0.60 },
  { x: 0.84, y: 0.66 },
  { x: 0.46, y: 0.22 },
  { x: 0.25, y: 0.76 },
  { x: 0.68, y: 0.48 }
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function point(value) {
  return { x: Number(value.x), y: Number(value.y) };
}

function copyPlate(plate) {
  return { ...plate, center: point(plate.center) };
}

function copyMark(mark) {
  return { ...mark, point: point(mark.point) };
}

function copyMemory(memory) {
  return memory.map(copyMark);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function basePlates(stage) {
  const random = rng(SEED + stage * 997);
  const layout = [
    [0.22, 0.26], [0.48, 0.19], [0.73, 0.27],
    [0.18, 0.49], [0.43, 0.43], [0.69, 0.48],
    [0.28, 0.72], [0.54, 0.68], [0.78, 0.72]
  ];

  return layout.map(([x, y], index) => ({
    id: `plate-${String(index).padStart(2, '0')}`,
    index,
    center: {
      x: clamp(x + (random() - 0.5) * 0.022 + Math.sin(stage * 0.11 + index) * 0.008, 0.10, 0.90),
      y: clamp(y + (random() - 0.5) * 0.022 + Math.cos(stage * 0.13 + index * 0.7) * 0.008, 0.12, 0.88)
    },
    rotation: (random() - 0.5) * 0.35 + index * 0.11,
    radiusX: 0.082 + random() * 0.012,
    radiusY: 0.068 + random() * 0.012,
    innerScale: 0.42 + random() * 0.08,
    sides: 5 + (index % 2),
    closed: true,
    notch: false,
    innerCut: false,
    role: 'quiet'
  }));
}

function nearestPlate(value, plates) {
  return plates.reduce((best, plate, index) => (
    distance(value, plate.center) < distance(value, plates[best].center) ? index : best
  ), 0);
}

function chooseRemote(sourceIndex, stage, memory) {
  const used = new Set(memory.map((mark) => mark.remoteIndex));
  for (let offset = 3; offset < PLATE_COUNT + 3; offset += 1) {
    const candidate = (sourceIndex + offset + stage) % PLATE_COUNT;
    if (candidate !== sourceIndex && !used.has(candidate)) return candidate;
  }
  return (sourceIndex + 4) % PLATE_COUNT;
}

function makeCountermark(plates, stage, value, source = 'auto-countermark', memory = []) {
  const sourceIndex = nearestPlate(value, plates);
  const remoteIndex = chooseRemote(sourceIndex, stage, memory);
  return {
    kind: 'countermark',
    mode: 'remote-winding',
    point: point(value),
    sourceIndex,
    remoteIndex,
    source,
    stage
  };
}

function applyMemory(plates, memory) {
  const next = plates.map(copyPlate);

  for (const [memoryIndex, mark] of memory.entries()) {
    const source = next[mark.sourceIndex];
    const remote = next[mark.remoteIndex];
    if (!source || !remote) continue;

    source.role = 'source-countermark';
    source.notch = true;
    source.rotation += 0.06 + memoryIndex * 0.015;
    source.radiusX = Math.max(0.062, source.radiusX - 0.004);
    source.radiusY = Math.max(0.050, source.radiusY - 0.003);

    remote.role = 'remote-imprint';
    remote.innerCut = true;
    remote.innerScale = Math.min(0.62, remote.innerScale + 0.08 + memoryIndex * 0.012);
    remote.rotation -= 0.08 + memoryIndex * 0.018;
    remote.radiusX = Math.min(0.12, remote.radiusX + 0.006);
    remote.radiusY = Math.min(0.105, remote.radiusY + 0.005);
  }

  return next;
}

function plateSignature(plates) {
  return plates.map((plate) => [
    plate.role[0],
    plate.center.x.toFixed(4),
    plate.center.y.toFixed(4),
    plate.rotation.toFixed(4),
    plate.notch ? 'n' : '-',
    plate.innerCut ? 'i' : '-'
  ].join(':')).join('|');
}

export function buildFrame(stage, memory = []) {
  const boundedStage = clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const plates = applyMemory(basePlates(boundedStage), inherited);
  const latest = inherited.at(-1);

  return {
    stage: boundedStage,
    grammar: 'disjoint-countermark-plates',
    plates,
    memory: inherited,
    sourceIndex: latest?.sourceIndex ?? null,
    remoteIndex: latest?.remoteIndex ?? null,
    notchCount: plates.filter((plate) => plate.notch).length,
    imprintCount: plates.filter((plate) => plate.innerCut).length,
    primitiveBudget: PRIMITIVE_BUDGET,
    plateSignature: plateSignature(plates)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const value = AUTO_COUNTERMARKS[((stage - 1) / 2) % AUTO_COUNTERMARKS.length];
      memory = [...memory, makeCountermark(frame.plates, stage, value, 'timeline-countermark', memory)].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyCountermark(frame, value) {
  const rawX = Number(value?.x);
  const rawY = Number(value?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.14, 0.86),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.18, 0.82)
  };
  const mark = makeCountermark(frame.plates, frame.stage, bounded, 'visitor-countermark', frame.memory);
  const priorMemory = copyMemory(frame.memory);
  const next = buildFrame(frame.stage, [...frame.memory, mark].slice(-MEMORY_LIMIT));
  return { ...next, countermark: mark, priorMemory, interaction: 'remote-winding' };
}

export function removeLatestCountermark(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  if (!frame.memory.length) return buildFrame(frame.stage, []);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseCountermark() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  return frame.plateSignature;
}
