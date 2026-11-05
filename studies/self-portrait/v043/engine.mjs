export const CHANNEL_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const RESISTANCE_THRESHOLD = 0.62;
export const TRAVEL_THRESHOLD = 0.58;
export const ALIGNMENT_THRESHOLD = 0.66;
export const SEED = 0x503043;

const LAYOUT = [
  [-0.54, -0.64, 0.24, 0.54, -0.22],
  [-0.18, -0.73, 0.27, 0.42, 0.14],
  [0.23, -0.64, 0.22, 0.56, 0.31],
  [0.54, -0.33, 0.26, 0.44, -0.18],
  [0.16, -0.20, 0.30, 0.62, 0.08],
  [-0.25, -0.19, 0.25, 0.48, -0.36],
  [-0.58, 0.18, 0.24, 0.46, 0.19],
  [-0.18, 0.38, 0.29, 0.42, -0.16],
  [0.31, 0.34, 0.25, 0.54, 0.27]
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 19.731 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createChannel(index) {
  const [x, y, width, height, angle] = LAYOUT[index];
  return {
    index,
    x: rounded(x + (seeded(index + 7) - 0.5) * 0.028),
    y: rounded(y + (seeded(index + 17) - 0.5) * 0.028),
    width: rounded(width * (0.92 + seeded(index + 27) * 0.14)),
    height: rounded(height * (0.92 + seeded(index + 37) * 0.14)),
    angle: rounded(angle + (seeded(index + 47) - 0.5) * 0.2),
    contours: 3 + Math.floor(seeded(index + 57) * 3),
    density: rounded(0.34 + seeded(index + 67) * 0.32),
    grain: rounded(0.18 + seeded(index + 77) * 0.64),
    phase: rounded(seeded(index + 87)),
    tone: index % 4,
    state: 'quiet'
  };
}

export function buildField() {
  return {
    composition: 'resistance-portrait',
    renderer: 'p5-canvas',
    revision: 0,
    channels: Array.from({ length: CHANNEL_COUNT }, (_, index) => createChannel(index)),
    pressure: null,
    memory: [],
    snapshots: [],
    interaction: 'quiet slab'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    channels: field.channels.map((channel) => ({
      index: channel.index,
      x: channel.x,
      y: channel.y,
      width: channel.width,
      height: channel.height,
      angle: channel.angle,
      contours: channel.contours,
      density: channel.density,
      grain: channel.grain,
      phase: channel.phase,
      tone: channel.tone,
      state: channel.state
    }))
  });
}

function safeChannel(channel) {
  return clamp(Math.floor(Number(channel) || 0), 0, CHANNEL_COUNT - 1);
}

function safeUnit(value) {
  return rounded(clamp(Number(value) || 0, 0, 1));
}

export function loadPressure(field, {
  channel = 0,
  travel = 0,
  alignment = 0,
  pressure = 0
} = {}) {
  const next = clone(field);
  const safe = safeChannel(channel);
  next.pressure = {
    channel: safe,
    travel: safeUnit(travel),
    alignment: safeUnit(alignment),
    pressure: safeUnit(pressure)
  };
  next.interaction = `loaded / ${safe}`;
  return next;
}

function chooseReceiver(source, revision) {
  let receiver = (source * 5 + revision * 3 + 2) % CHANNEL_COUNT;
  if (receiver === source) receiver = (receiver + 1) % CHANNEL_COUNT;
  return receiver;
}

function recastRemote(channel, load, alignment, revision) {
  const direction = revision % 2 === 0 ? 1 : -1;
  const intensity = clamp((load - RESISTANCE_THRESHOLD) / 0.38, 0.16, 1);
  const grainShift = (alignment - ALIGNMENT_THRESHOLD) * direction;
  return {
    ...channel,
    x: rounded(channel.x + direction * (0.024 + intensity * 0.035)),
    y: rounded(channel.y - intensity * 0.026),
    width: rounded(clamp(channel.width + intensity * 0.04, 0.12, 0.38)),
    height: rounded(clamp(channel.height + direction * intensity * 0.032, 0.2, 0.72)),
    angle: rounded(channel.angle + direction * (0.08 + intensity * 0.24)),
    contours: channel.contours + 2 + (revision % 2),
    density: rounded(clamp(channel.density + 0.16 + intensity * 0.25, 0.15, 1)),
    grain: rounded((channel.grain + grainShift * 0.44 + 1) % 1),
    phase: rounded((channel.phase + 0.18 + intensity * 0.26) % 1),
    state: 'recast'
  };
}

export function commitPressure(field) {
  const current = field.pressure;
  if (!current || current.travel < TRAVEL_THRESHOLD || current.alignment < ALIGNMENT_THRESHOLD || current.pressure < RESISTANCE_THRESHOLD) {
    return {
      accepted: false,
      field: { ...clone(field), pressure: null, interaction: 'refused / latent' },
      event: null
    };
  }

  const next = clone(field);
  const revision = field.revision + 1;
  const source = current.channel;
  const receiver = chooseReceiver(source, revision);
  const event = {
    kind: 'resistance-recast',
    relation: 'pressure-remembered-elsewhere',
    source,
    receiver,
    travel: current.travel,
    alignment: current.alignment,
    pressure: current.pressure,
    revision
  };

  next.revision = revision;
  next.channels[receiver] = recastRemote(field.channels[receiver], current.pressure, current.alignment, revision);
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.pressure = null;
  next.interaction = 'recast / remote';
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
  const strokes = [
    { channel: 1, travel: TRAVEL_THRESHOLD + 0.18, alignment: ALIGNMENT_THRESHOLD + 0.12, pressure: RESISTANCE_THRESHOLD + 0.14 },
    { channel: 5, travel: TRAVEL_THRESHOLD + 0.24, alignment: ALIGNMENT_THRESHOLD + 0.2, pressure: RESISTANCE_THRESHOLD + 0.22 },
    { channel: 7, travel: TRAVEL_THRESHOLD + 0.12, alignment: ALIGNMENT_THRESHOLD + 0.16, pressure: RESISTANCE_THRESHOLD + 0.1 },
    { channel: 2, travel: TRAVEL_THRESHOLD + 0.3, alignment: ALIGNMENT_THRESHOLD + 0.24, pressure: RESISTANCE_THRESHOLD + 0.28 }
  ];
  const timeline = [field];
  for (const stroke of strokes) {
    field = loadPressure(field, stroke);
    field = commitPressure(field).field;
    timeline.push(field);
  }
  return timeline;
}
