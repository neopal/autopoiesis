const VIEWBOX = { width: 1000, height: 760 };
const BASE_X = 150;
const BASE_Y = 380;
const SPAN_X = 700;
const STRAND_LAYOUT = Array.from({ length: 11 }, (_, index) => ({
  index,
  offset: (index - 5) * 31,
  width: 18 + (index % 3) * 4,
  phase: -0.34 + index * 0.11,
  weight: 0.84 + (index % 4) * 0.07
}));
const ZONE_LAYOUT = [
  { index: 0, x: 240, y: 380, radius: 34 },
  { index: 1, x: 500, y: 380, radius: 34 },
  { index: 2, x: 760, y: 380, radius: 34 }
];

export const STRAND_COUNT = STRAND_LAYOUT.length;
export const ZONE_COUNT = ZONE_LAYOUT.length;
export const MEMORY_WINDOW = 4;
export const VIEWBOX_SIZE = VIEWBOX;

const round = (value) => Math.round(value * 1000) / 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function eventLoad(memory) {
  return memory.reduce((sum, event, eventIndex) => sum + event.pressure * (eventIndex + 1), 0);
}

function centerPoint(index, unit, memory) {
  const layout = STRAND_LAYOUT[index];
  const load = eventLoad(memory);
  const x = BASE_X + unit * SPAN_X;
  const base = BASE_Y + layout.offset;
  const weave = Math.sin(unit * Math.PI * 2 + layout.phase) * (26 + index * 1.6);
  const bow = Math.sin(unit * Math.PI) * (index - 5) * 9;
  let y = base + weave + bow;
  let warpedX = x;

  for (const [eventIndex, event] of memory.entries()) {
    const pulse = (eventIndex + 1) * event.pressure;
    const local = Math.sin((unit + index * 0.037) * Math.PI * 2 + pulse);
    const envelope = Math.sin(unit * Math.PI);
    if (event.kind === 'pressure-shear') {
      y += envelope * local * pulse * (7 + (index % 4) * 2);
      warpedX += envelope * Math.cos(unit * Math.PI * 1.5 + index) * pulse * 4;
    } else if (event.kind === 'pressure-split') {
      y += envelope * Math.sign(index - 5 || 1) * pulse * (4 + (index % 3));
      warpedX += envelope * local * pulse * 5;
    } else if (event.kind === 'pressure-buckle') {
      y += Math.sin(unit * Math.PI * 3 + index) * envelope * pulse * 8;
      warpedX -= envelope * pulse * 3;
    } else {
      y += envelope * (0.5 - unit) * pulse * (index - 5) * 0.8;
    }
  }

  if (load > 0) {
    y += Math.sin(unit * Math.PI) * Math.cos(index * 0.7 + load) * Math.min(load, 2.4) * 2.5;
  }
  return { x: round(clamp(warpedX, 80, 920)), y: round(clamp(y, 105, 655)) };
}

function strandPolygon(index, memory) {
  const layout = STRAND_LAYOUT[index];
  const units = [0, 0.12, 0.25, 0.39, 0.52, 0.66, 0.8, 0.92, 1];
  const centers = units.map((unit) => centerPoint(index, unit, memory));
  const pressure = eventLoad(memory);
  const width = layout.width * (1 + Math.min(pressure, 2) * 0.06);
  const upper = centers.map((point, pointIndex) => {
    const unit = units[pointIndex];
    const taper = 0.64 + Math.sin(unit * Math.PI) * 0.36;
    return { x: point.x, y: round(point.y - width * taper) };
  });
  const lower = [...centers].reverse().map((point, reverseIndex) => {
    const unit = units[units.length - 1 - reverseIndex];
    const taper = 0.64 + Math.sin(unit * Math.PI) * 0.36;
    return { x: point.x, y: round(point.y + width * taper) };
  });
  const points = [...upper, ...lower];
  return {
    index,
    points,
    signature: points.map(({ x, y }) => `${x},${y}`).join(' '),
    center: centers[Math.floor(centers.length / 2)],
    width: round(width),
    weight: layout.weight
  };
}

function makeZones() {
  return ZONE_LAYOUT.map((zone) => ({ ...zone, signature: `${zone.index}:${zone.x},${zone.y},${zone.radius}` }));
}

function normalizeMemory(memory) {
  return Array.isArray(memory) ? memory.slice(-MEMORY_WINDOW).map((event) => ({
    type: event.type,
    kind: event.kind,
    sourceZones: [...event.sourceZones],
    pressure: event.pressure
  })) : [];
}

export function geometrySignature(frame) {
  return frame.strands.map((strand) => strand.signature).join('|');
}

export function buildFrame(memory = []) {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'pressure-loom',
    strands: STRAND_LAYOUT.map((_, index) => strandPolygon(index, normalizedMemory)),
    zones: makeZones(),
    memory: normalizedMemory,
    pending: [],
    interaction: normalizedMemory.length ? 'settled' : 'quiet',
    event: null,
    state: { passCount: normalizedMemory.length }
  };
}

export function beginPass(frame, zoneIndex) {
  if (!Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex >= ZONE_COUNT) return frame;
  return { ...frame, pending: [zoneIndex], interaction: 'pass-started', event: null };
}

export function sampleZone(frame, zoneIndex) {
  if (!Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex >= ZONE_COUNT) return frame;
  if (!frame.pending?.length) return beginPass(frame, zoneIndex);
  if (frame.pending.includes(zoneIndex) || frame.pending.length >= ZONE_COUNT) return frame;
  const pending = [...frame.pending, zoneIndex];
  const reversed = pending.some((value, index) => index > 0 && value < pending[index - 1]);
  return {
    ...frame,
    pending,
    interaction: reversed ? 'pass-reversed' : pending.length === ZONE_COUNT ? 'pass-ready' : 'pass-crossing',
    event: null
  };
}

function pressureFor(memoryLength) {
  return round(0.72 + memoryLength * 0.21);
}

function eventKind(memoryLength) {
  return ['pressure-shear', 'pressure-split', 'pressure-buckle', 'pressure-fold'][memoryLength % 4];
}

export function commitPass(frame) {
  if (!Array.isArray(frame.pending) || frame.pending.length !== ZONE_COUNT) {
    return { ...frame, interaction: 'pass-refused-incomplete', event: { type: 'pass-refused', sourceZones: [...(frame.pending ?? [])] } };
  }
  if (frame.pending.some((value, index) => value !== index)) {
    return { ...frame, interaction: 'pass-refused-direction', event: { type: 'pass-refused-direction', sourceZones: [...frame.pending] } };
  }
  const kind = eventKind(frame.memory.length);
  const event = {
    type: kind,
    kind,
    sourceZones: [...frame.pending],
    pressure: pressureFor(frame.memory.length)
  };
  const next = buildFrame([...frame.memory, event]);
  next.pending = [];
  next.interaction = 'pass-committed';
  next.event = event;
  return next;
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (let count = 0; count < MEMORY_WINDOW; count += 1) {
    const ready = sampleZone(sampleZone(beginPass(timeline.at(-1), 0), 1), 2);
    timeline.push(commitPass(ready));
  }
  return timeline;
}

export function liftLatestPass(frame) {
  if (!frame.memory.length) return frame;
  const lifted = buildFrame(frame.memory.slice(0, -1));
  lifted.interaction = 'pass-lifted';
  return lifted;
}

export function releaseLoom() {
  return buildFrame();
}
