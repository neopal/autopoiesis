export const SEED = 0x53564749;
export const STAGES = 15;
export const PRIMITIVE_BUDGET = 11;
export const MEMORY_LIMIT = 4;
export const CHANNEL_COUNT = 7;

const AUTO_PRESSURES = [2, 5, 1, 6, 3, 0, 4, 2];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyChannel(channel) {
  return { ...channel, center: copyPoint(channel.center) };
}

function copyPressure(pressure) {
  return { ...pressure };
}

function copyMemory(memory) {
  return memory.map(copyPressure);
}

function channelPathSignature(channel) {
  return [
    channel.center.x.toFixed(4),
    channel.center.y.toFixed(4),
    channel.rotation.toFixed(4),
    channel.radius.toFixed(4),
    channel.bend.toFixed(4),
    channel.aperture ? 'a' : '-',
    channel.winding
  ].join(':');
}

function baseChannels(stage) {
  const random = rng(SEED + stage * 991);
  const channels = [];
  for (let index = 0; index < CHANNEL_COUNT; index += 1) {
    const angle = -Math.PI / 2 + (index / CHANNEL_COUNT) * Math.PI * 2;
    const radius = 0.255 + random() * 0.018;
    channels.push({
      id: `channel-${String(index).padStart(2, '0')}`,
      index,
      center: {
        x: 0.5 + Math.cos(angle) * (0.19 + random() * 0.018),
        y: 0.5 + Math.sin(angle) * (0.19 + random() * 0.018)
      },
      angle,
      rotation: angle + Math.PI / 2 + (random() - 0.5) * 0.16,
      radius,
      bend: (random() - 0.5) * 0.16,
      width: 0.075 + random() * 0.014,
      innerScale: 0.52 + random() * 0.05,
      winding: index % 2 === 0 ? 'cw' : 'ccw',
      closed: true,
      aperture: false,
      role: 'quiet'
    });
  }
  return channels;
}

function pressureTarget(stage, memoryLength) {
  return (AUTO_PRESSURES[memoryLength % AUTO_PRESSURES.length] + stage + memoryLength) % CHANNEL_COUNT;
}

function makePressure(stage, memory, source = 'auto-pressure', requestedIndex = null) {
  const flippedIndex = Number.isInteger(requestedIndex)
    ? ((requestedIndex % CHANNEL_COUNT) + CHANNEL_COUNT) % CHANNEL_COUNT
    : pressureTarget(stage, memory.length);
  const apertureIndex = (flippedIndex + 2 + memory.length) % CHANNEL_COUNT;
  return {
    kind: 'pressure',
    mode: 'order-inversion',
    source,
    stage,
    flippedIndex,
    apertureIndex,
    ordinal: memory.length
  };
}

function applyMemory(channels, memory) {
  const next = channels.map(copyChannel);
  const paintOrder = Array.from({ length: CHANNEL_COUNT }, (_, index) => index);

  for (const [memoryIndex, pressure] of memory.entries()) {
    const flipped = next[pressure.flippedIndex];
    const aperture = next[pressure.apertureIndex];
    if (!flipped || !aperture) continue;

    flipped.role = 'pressure-flipped';
    flipped.rotation += 0.08 + memoryIndex * 0.018;
    flipped.radius = Math.min(0.34, flipped.radius + 0.012 + memoryIndex * 0.002);
    flipped.bend += 0.18 + memoryIndex * 0.024;
    flipped.winding = flipped.winding === 'cw' ? 'ccw' : 'cw';

    aperture.role = 'aperture';
    aperture.aperture = true;
    aperture.rotation -= 0.06 + memoryIndex * 0.016;
    aperture.radius = Math.max(0.205, aperture.radius - 0.010);
    aperture.innerScale = Math.min(0.79, aperture.innerScale + 0.08 + memoryIndex * 0.012);
    aperture.bend -= 0.14 + memoryIndex * 0.018;

    const flippedOrder = paintOrder.indexOf(pressure.flippedIndex);
    const preceding = (flippedOrder + CHANNEL_COUNT - 1) % CHANNEL_COUNT;
    [paintOrder[preceding], paintOrder[flippedOrder]] = [paintOrder[flippedOrder], paintOrder[preceding]];
  }

  for (const channel of next) channel.pathSignature = channelPathSignature(channel);
  return { channels: next, paintOrder };
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

export function buildFrame(stage, memory = []) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const base = baseChannels(safeStage);
  const { channels, paintOrder } = applyMemory(base, inherited);
  const latest = inherited.at(-1);

  return {
    stage: safeStage,
    grammar: 'pressure-valve-stack',
    channels,
    paintOrder,
    memory: inherited,
    flippedIndex: latest?.flippedIndex ?? null,
    apertureIndex: latest?.apertureIndex ?? null,
    pressureCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    signature: geometrySignature({ channels, paintOrder })
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const pressure = makePressure(stage, memory, 'timeline-pressure');
      memory = [...memory, pressure].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyPressure(frame) {
  const pressure = makePressure(frame.stage, frame.memory, 'visitor-pressure');
  const priorMemory = copyMemory(frame.memory.length >= MEMORY_LIMIT ? frame.memory.slice(0, -1) : frame.memory);
  const next = buildFrame(frame.stage, [...frame.memory, pressure].slice(-MEMORY_LIMIT));
  return { ...next, pressure, priorMemory, interaction: 'order-inversion' };
}

export function removeLatestPressure(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releasePressure() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  if (!frame?.channels) return '';
  return `${(frame.paintOrder ?? []).join(',')}::${frame.channels.map((channel) => channelPathSignature(channel)).join('|')}`;
}
