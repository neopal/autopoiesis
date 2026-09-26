export const SEED = 0x42525540;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const BAND_COUNT = 9;
export const PRIMITIVE_BUDGET = 84;
export const TAU = Math.PI * 2;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyBand = (band) => ({ ...band });
const copyEvent = (event) => ({ ...event });

function baseBands(stage) {
  const random = rng(SEED + stage * 12791);
  return Array.from({ length: BAND_COUNT }, (_, index) => ({
    bandIndex: index,
    radius: 0.23 + index * 0.018 + random() * 0.018,
    height: 0.38 + random() * 0.28,
    phase: index * (TAU / BAND_COUNT) + (random() - 0.5) * 0.12,
    twist: 0.35 + random() * 0.8,
    grain: 0.22 + random() * 0.7,
    coherence: 0.82 + random() * 0.18,
    wetness: 0.72 + random() * 0.28,
    deflection: 0,
    fragmentCount: 0,
    hue: [16, 35, 176, 206, 334][index % 5]
  }));
}

function normalizeDirection(direction) {
  return Number(direction) < 0 ? -1 : 1;
}

function chooseBand(bands, stage, memoryLength, direction) {
  const wet = bands.filter((band) => band.coherence > 0.42);
  const available = wet.length ? wet : bands;
  const rank = (stage * 2 + memoryLength * 3) % Math.max(available.length, 1);
  const chosen = direction > 0 ? rank : available.length - 1 - rank;
  return available[Math.max(0, Math.min(available.length - 1, chosen))];
}

function makeEvent(frame, band, direction, source = 'visitor-dry-pulse') {
  return {
    id: `${source}-${frame.stage}-${band.bandIndex}-${frame.memory.length}`,
    stage: frame.stage,
    source,
    kind: 'drying-pulse',
    bandIndex: band.bandIndex,
    direction,
    mass: clamp(0.32 + band.grain * 0.38 + band.height * 0.12, 0.28, 0.88),
    rule: 'dry-seam-field'
  };
}

function applyEvent(bands, dryBands, event) {
  const chosen = bands.find((band) => band.bandIndex === event.bandIndex);
  if (!chosen) return { bands, dryBands };
  const chosenPhase = chosen.phase;
  const nextBands = bands.map((band) => {
    const delta = band.bandIndex - chosen.bandIndex;
    const distance = Math.abs(delta);
    if (band.bandIndex === chosen.bandIndex) {
      return {
        ...band,
        phase: band.phase + event.direction * (0.08 + event.mass * 0.08),
        radius: band.radius + event.direction * event.mass * 0.018,
        coherence: 0.14,
        wetness: 0.08,
        deflection: event.direction * (0.06 + event.mass * 0.03),
        fragmentCount: 7 + Math.round(event.mass * 6)
      };
    }
    const side = delta >= 0 ? 1 : -1;
    const influence = Math.max(0, 1 - distance / (BAND_COUNT + 1));
    return {
      ...band,
      phase: band.phase + side * event.direction * influence * event.mass * 0.19,
      radius: band.radius + side * event.direction * influence * event.mass * 0.012,
      height: clamp(band.height + influence * event.mass * 0.045, 0.2, 0.9),
      coherence: clamp(band.coherence - influence * event.mass * 0.035, 0.35, 1),
      wetness: clamp(band.wetness - influence * event.mass * 0.02, 0.24, 1),
      deflection: band.deflection + side * event.direction * influence * event.mass * 0.07
    };
  });
  const dry = {
    bandIndex: chosen.bandIndex,
    anchorAngle: ((chosenPhase % TAU) + TAU) % TAU,
    anchorRadius: chosen.radius,
    fragmentCount: 7 + Math.round(event.mass * 6),
    fragmentSpread: 0.06 + event.mass * 0.11,
    fragmentLift: 0.04 + event.mass * 0.09,
    mass: event.mass,
    direction: event.direction,
    hue: chosen.hue
  };
  return {
    bands: nextBands,
    dryBands: [...dryBands, dry].slice(-MEMORY_LIMIT)
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let bands = baseBands(safeStage);
  let dryBands = [];
  inherited.forEach((event) => {
    const applied = applyEvent(bands, dryBands, event);
    bands = applied.bands;
    dryBands = applied.dryBands;
  });
  return {
    stage: safeStage,
    memory: inherited,
    bands,
    dryBands,
    dryLoad: dryBands.reduce((total, dry) => total + dry.mass, 0),
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'helical-drying-coil'
  };
}

function automaticPulse(stage, frame) {
  const band = chooseBand(frame.bands, stage, frame.memory.length, stage % 2 ? -1 : 1);
  return makeEvent(frame, band, stage % 2 ? -1 : 1, 'autonomous-drying');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1 && frame.bands.length) {
      memory = [...memory, automaticPulse(stage, frame)].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function dryPulse(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const direction = normalizeDirection(input.direction);
  const band = chooseBand(baseline.bands, baseline.stage, baseline.memory.length, direction);
  const pulse = makeEvent(baseline, band, direction);
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, pulse]),
    interaction: 'visitor-dry-pulse',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestPulse(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'pulse-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'pulse-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pulse-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    bands: frame.bands.map((band) => [band.bandIndex, band.radius, band.height, band.phase, band.coherence, band.wetness, band.deflection, band.fragmentCount]),
    dryBands: frame.dryBands,
    dryLoad: frame.dryLoad
  });
}
