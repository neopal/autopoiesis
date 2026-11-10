export const NODE_COUNT = 28;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503047;

const MODES = ['flare', 'hinge', 'counter', 'drift'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(6));
const normalize = (value) => clamp(Number(value) || 0, 0, 1);

const BASE_STROKE = [
  [0.12, 0.72],
  [0.26, 0.56],
  [0.18, 0.42],
  [0.42, 0.30],
  [0.34, 0.18],
  [0.68, 0.24],
  [0.58, 0.62],
  [0.86, 0.40]
];

function createRibs() {
  return Array.from({ length: NODE_COUNT }, (_, index) => {
    const t = index / (NODE_COUNT - 1);
    const y = (t - 0.5) * 1.76;
    const wave = Math.sin(t * Math.PI * 2.9 + 0.35) * 0.14;
    const x = -0.05 + wave + (t - 0.5) * 0.08;
    return {
      index,
      x: round(x),
      y: round(y),
      length: round(0.28 + Math.sin(t * Math.PI * 4.4 + 0.4) * 0.07 + (index % 3) * 0.025),
      angle: round(Math.sin(t * Math.PI * 2.1) * 0.22 + (t - 0.5) * 0.17),
      weight: round(0.018 + (index % 4) * 0.004),
      echo: round(0.12 + (index % 5) * 0.025)
    };
  });
}

export function buildField() {
  return {
    composition: 'counterpressure-profile',
    renderer: 'svg-lattice',
    document: {
      revision: 0,
      mode: 'quiet',
      phase: 0,
      hand: 0,
      aperture: 0.2,
      density: 0.5
    },
    ribs: createRibs(),
    pending: [],
    memory: [],
    snapshots: [],
    interaction: 'quiet profile'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    document: field.document,
    ribs: field.ribs
  });
}

export function gestureSignature(points) {
  return JSON.stringify((points ?? []).map((point) => [round(normalize(point.x ?? point[0])), round(normalize(point.y ?? point[1]))]));
}

export function recordPoint(field, x, y, time = 0) {
  const next = structuredClone(field);
  next.pending = [...next.pending, { x: round(normalize(x)), y: round(normalize(y)), time: Math.max(0, Math.trunc(Number(time) || 0)) }].slice(-48);
  next.interaction = `counterstroke held / ${next.pending.length} points`;
  return next;
}

function inspectStroke(points) {
  const samples = points.map((point) => ({ x: normalize(point.x ?? point[0]), y: normalize(point.y ?? point[1]) }));
  let length = 0;
  const signs = [];
  let previousSign = 0;
  let reversals = 0;
  let verticalDrift = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const dx = samples[index].x - samples[index - 1].x;
    const dy = samples[index].y - samples[index - 1].y;
    length += Math.hypot(dx, dy);
    verticalDrift += dy;
    const sign = Math.abs(dx) > 0.025 ? Math.sign(dx) : 0;
    if (sign && previousSign && sign !== previousSign) reversals += 1;
    if (sign) previousSign = sign;
    if (sign) signs.push(sign);
  }
  const turning = samples.reduce((total, point, index) => total + (index + 1) * (point.x - point.y), 0);
  const balance = samples.reduce((total, point) => total + (point.x - 0.5) * (point.y - 0.5), 0) / Math.max(1, samples.length);
  const direction = signs.join('');
  return {
    points: samples,
    length: round(length),
    reversals,
    verticalDrift: round(verticalDrift),
    turning: round(turning),
    balance: round(balance),
    direction,
    reversalCode: `${direction}|${Math.round(turning * 1000)}|${Math.round(verticalDrift * 1000)}`
  };
}

function layoutRibs(previous, document, event) {
  return previous.map((rib, index) => {
    const t = index / (NODE_COUNT - 1);
    const local = Math.sin(index * 0.71 + event.turning * 2.3 + document.phase * 6.28);
    const counter = Math.cos(t * Math.PI * (2.2 + event.reversals * 0.27) + event.polarity * 1.7);
    const side = (index % 2 ? -1 : 1) * document.hand;
    return {
      index,
      x: round(rib.x + counter * (0.075 + document.aperture * 0.05) + side * (t - 0.5) * 0.1),
      y: round(rib.y + local * 0.035 + event.verticalDrift * (t - 0.5) * 0.08),
      length: round(clamp(rib.length * (1 + document.density * 0.18 + counter * 0.08), 0.16, 0.52)),
      angle: round(rib.angle + local * 0.17 + document.hand * (0.28 + t * 0.12)),
      weight: round(clamp(rib.weight * (1 + document.aperture * 0.65 + Math.abs(counter) * 0.11), 0.012, 0.05)),
      echo: round(clamp(rib.echo + (Math.abs(local) * 0.03) + document.aperture * 0.03, 0.08, 0.32))
    };
  });
}

export function commitCounterstroke(field) {
  const next = structuredClone(field);
  const eventShape = inspectStroke(next.pending);
  if (eventShape.points.length < 6 || eventShape.length < 0.9 || eventShape.reversals < 3) {
    next.interaction = 'refused / no counterpressure';
    return { accepted: false, field: next, event: null };
  }

  const revision = field.document.revision + 1;
  const polarity = eventShape.direction.split('').reduce((total, sign, index) => total + (sign === '-' ? -1 : 1) * (index + 1), 0);
  const mode = MODES[(Math.abs(polarity) + revision + (eventShape.turning > 0 ? 1 : 0)) % MODES.length];
  const event = {
    kind: 'counterstroke-rewrite',
    relation: 'release-inverts-profile',
    reversalCode: eventShape.reversalCode,
    reversals: eventShape.reversals,
    length: eventShape.length,
    turning: eventShape.turning,
    verticalDrift: eventShape.verticalDrift,
    polarity,
    mode,
    revision
  };
  next.snapshots = [...next.snapshots, structuredClone(field)].slice(-MEMORY_LIMIT);
  next.document = {
    revision,
    mode,
    phase: round((field.document.phase + eventShape.turning * 0.23 + eventShape.verticalDrift * 0.41 + revision * 0.17) % 1),
    hand: round(clamp(Math.sign(polarity) * (0.35 + Math.min(0.5, eventShape.reversals * 0.04)), -0.8, 0.8)),
    aperture: round(clamp(field.document.aperture + 0.06 + eventShape.reversals * 0.012, 0.2, 0.56)),
    density: round(clamp(field.document.density + 0.04 + eventShape.length * 0.025, 0.5, 0.86))
  };
  next.ribs = layoutRibs(field.ribs, next.document, event);
  next.memory = [...next.memory, event].slice(-MEMORY_LIMIT);
  next.pending = [];
  next.interaction = `rewritten / ${mode}`;
  return { accepted: true, field: next, event };
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...structuredClone(field), interaction: 'lifted / exact' };
  return { ...structuredClone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

function shiftedStroke(offsetX, offsetY, flip = false) {
  return BASE_STROKE.map(([x, y], index) => {
    const source = flip ? BASE_STROKE[BASE_STROKE.length - 1 - index] : [x, y];
    return [clamp(source[0] + offsetX, 0.05, 0.95), clamp(source[1] + offsetY * Math.sin(index * 0.8), 0.05, 0.95)];
  });
}

export function buildTimeline() {
  const strokes = [
    BASE_STROKE,
    shiftedStroke(0.02, 0.06),
    shiftedStroke(-0.04, -0.05, true),
    shiftedStroke(0.05, 0.03)
  ];
  let field = buildField();
  const timeline = [field];
  for (const stroke of strokes) {
    field = stroke.reduce((current, [x, y], index) => recordPoint(current, x, y, index * 40), field);
    field = commitCounterstroke(field).field;
    timeline.push(field);
  }
  return timeline;
}
