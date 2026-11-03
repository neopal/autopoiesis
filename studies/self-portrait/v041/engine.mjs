export const PLATE_COUNT = 13;
export const MEMORY_LIMIT = 4;
export const DWELL_THRESHOLD = 0.64;
export const SEED = 0x503041;

const LAYOUT = [
  [-34, -39, 22, 18, -8], [-8, -45, 18, 14, 6], [20, -38, 24, 20, -4],
  [39, -24, 17, 24, 12], [-39, -18, 24, 17, -14], [-8, -18, 21, 25, 8],
  [25, -5, 20, 16, -10], [-30, 9, 18, 26, 11], [2, 8, 25, 18, -7],
  [37, 18, 17, 25, -12], [-25, 32, 23, 17, 7], [7, 36, 19, 24, 14],
  [-2, 47, 22, 14, -9]
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 19.173 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createSegment(plateIndex, segmentIndex) {
  return {
    x: rounded(10 + seeded(plateIndex * 17 + segmentIndex * 3 + 3) * 70),
    y: rounded(10 + seeded(plateIndex * 17 + segmentIndex * 3 + 4) * 70),
    width: rounded(12 + seeded(plateIndex * 17 + segmentIndex * 3 + 5) * 38),
    height: rounded(1.8 + seeded(plateIndex * 17 + segmentIndex * 3 + 6) * 3.8),
    angle: rounded(-28 + seeded(plateIndex * 17 + segmentIndex * 3 + 7) * 56),
    tone: segmentIndex % 3
  };
}

function createPlate(index) {
  const [x, y, width, height, angle] = LAYOUT[index];
  return {
    index,
    x: rounded(x + (seeded(index + 11) - 0.5) * 2.4),
    y: rounded(y + (seeded(index + 21) - 0.5) * 2.4),
    width: rounded(width * (0.9 + seeded(index + 31) * 0.16)),
    height: rounded(height * (0.9 + seeded(index + 41) * 0.16)),
    angle: rounded(angle + (seeded(index + 51) - 0.5) * 7),
    split: rounded(0.22 + seeded(index + 61) * 0.55),
    offset: rounded(-4 + seeded(index + 71) * 8),
    state: 'quiet',
    segments: [0, 1, 2].map((segmentIndex) => createSegment(index, segmentIndex))
  };
}

export function buildField() {
  return {
    composition: 'attention-shutters',
    renderer: 'dom-css',
    revision: 0,
    plates: Array.from({ length: PLATE_COUNT }, (_, index) => createPlate(index)),
    ledger: Array.from({ length: PLATE_COUNT }, () => 0),
    attention: null,
    memory: [],
    snapshots: [],
    interaction: 'quiet'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    plates: field.plates.map((plate) => ({
      index: plate.index,
      x: plate.x,
      y: plate.y,
      width: plate.width,
      height: plate.height,
      angle: plate.angle,
      split: plate.split,
      offset: plate.offset,
      state: plate.state,
      segments: plate.segments
    }))
  });
}

function safeSite(site) {
  return clamp(Math.floor(Number(site) || 0), 0, PLATE_COUNT - 1);
}

function safeDwell(dwell) {
  return rounded(clamp(Number(dwell) || 0, 0, 3));
}

export function attend(field, { site = 0, dwell = 0 } = {}) {
  const next = clone(field);
  const safe = safeSite(site);
  next.attention = { site: safe, dwell: safeDwell(dwell) };
  next.interaction = `observing / ${safe}`;
  return next;
}

function mutatePlate(plate, dwell, revision) {
  const intensity = clamp((dwell - DWELL_THRESHOLD) / 1.6, 0.08, 1);
  const sign = revision % 2 === 0 ? 1 : -1;
  const extra = createSegment(plate.index + revision, plate.segments.length);
  extra.x = rounded(18 + intensity * 48);
  extra.y = rounded(12 + (revision % 3) * 22 + intensity * 12);
  extra.width = rounded(18 + intensity * 30);
  extra.height = rounded(2.4 + intensity * 3.6);
  extra.angle = rounded(sign * (18 + intensity * 33));
  return {
    ...plate,
    x: rounded(plate.x + sign * (1.5 + intensity * 3.5)),
    y: rounded(plate.y - intensity * 2.8),
    width: rounded(clamp(plate.width + intensity * 3.2, 12, 30)),
    height: rounded(clamp(plate.height + intensity * 2.2, 10, 31)),
    angle: rounded(plate.angle + sign * (4 + intensity * 10)),
    split: rounded(clamp(plate.split + sign * (0.05 + intensity * 0.08), 0.08, 0.92)),
    offset: rounded(plate.offset + sign * (2 + intensity * 3)),
    state: 'folded',
    segments: [...plate.segments.map((segment, index) => ({
      ...segment,
      x: rounded(segment.x + sign * intensity * (index + 1) * 2.3),
      angle: rounded(segment.angle + sign * intensity * 8)
    })), extra]
  };
}

export function commitAttention(field) {
  const current = field.attention;
  if (!current || current.dwell < DWELL_THRESHOLD) {
    return { accepted: false, field: { ...clone(field), interaction: 'refused / too brief' }, event: null };
  }

  const next = clone(field);
  const revision = field.revision + 1;
  const target = current.site;
  const before = field.plates[target];
  const event = {
    kind: 'attention-fold',
    relation: 'local-self-edit',
    site: target,
    dwell: current.dwell,
    previousState: before.state,
    revision
  };

  next.revision = revision;
  next.plates[target] = mutatePlate(before, current.dwell, revision);
  next.ledger[target] = rounded(next.ledger[target] + 1);
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.attention = null;
  next.interaction = 'folded / local';
  return { accepted: true, field: next, event };
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...clone(field), interaction: 'lifted / exact' };
  return { ...clone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

export function buildTimeline() {
  let field = buildField();
  const timeline = [field];
  const observations = [
    { site: 2, dwell: DWELL_THRESHOLD + 0.18 },
    { site: 7, dwell: DWELL_THRESHOLD + 0.42 },
    { site: 10, dwell: DWELL_THRESHOLD + 0.08 },
    { site: 4, dwell: DWELL_THRESHOLD + 0.6 }
  ];
  for (const observation of observations) {
    field = attend(field, observation);
    field = commitAttention(field).field;
    timeline.push(field);
  }
  return timeline;
}
