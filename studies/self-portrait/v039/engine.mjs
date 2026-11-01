export const RIBBON_COUNT = 22;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503039;

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 17.391 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createRibbon(index) {
  const ring = index / RIBBON_COUNT;
  return {
    index,
    radius: rounded(0.27 + seeded(index + 3) * 0.56),
    height: rounded(-0.78 + seeded(index + 12) * 1.56),
    curve: rounded(-0.42 + seeded(index + 21) * 0.84),
    lift: rounded(-0.2 + seeded(index + 30) * 0.4),
    phase: rounded(ring * Math.PI * 2 + (seeded(index + 39) - 0.5) * 0.22),
    width: rounded(0.018 + seeded(index + 48) * 0.028),
    depth: rounded(0.5 + seeded(index + 57) * 0.5)
  };
}

export function buildField() {
  return {
    composition: 'counterfield-volume',
    renderer: 'webgl',
    revision: 0,
    volume: {
      twist: rounded(-0.16 + seeded(71) * 0.32),
      fold: rounded(0.14 + seeded(72) * 0.22),
      rise: rounded(0.02 + seeded(73) * 0.18),
      yaw: rounded(-0.08 + seeded(74) * 0.16),
      pitch: rounded(-0.1 + seeded(75) * 0.2),
      scale: rounded(0.9 + seeded(76) * 0.12)
    },
    ribbons: Array.from({ length: RIBBON_COUNT }, (_, index) => createRibbon(index)),
    ledger: { left: 0, right: 0 },
    offers: [],
    memory: [],
    snapshots: [],
    interaction: 'quiet'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    volume: field.volume,
    ribbons: field.ribbons.map((ribbon) => [
      ribbon.index, ribbon.radius, ribbon.height, ribbon.curve, ribbon.lift,
      ribbon.phase, ribbon.width, ribbon.depth
    ])
  });
}

function safeOffer(side, amount) {
  return {
    side: side === 'right' ? 'right' : 'left',
    amount: rounded(clamp(Number(amount) || 0, 0, 1))
  };
}

export function armSide(field, { side = 'left', amount = 0.7 } = {}) {
  const next = clone(field);
  const offer = safeOffer(side, amount);
  const others = next.offers.filter((entry) => entry.side !== offer.side);
  next.offers = [...others, offer].sort((a, b) => (a.side === 'left' ? -1 : 1));
  next.ledger[offer.side] = offer.amount;
  next.interaction = next.offers.length === 2 ? 'paired / ready' : `armed / ${offer.side}`;
  return next;
}

function mutateRibbon(ribbon, bias, revision) {
  const wave = Math.sin(ribbon.phase * 1.7 + revision * 0.45);
  const counterwave = Math.cos(ribbon.phase * 0.83 - revision * 0.2);
  return {
    ...ribbon,
    curve: rounded(ribbon.curve + bias * (0.13 + Math.abs(wave) * 0.055)),
    lift: rounded(ribbon.lift + bias * (0.08 * wave + 0.035)),
    phase: rounded(ribbon.phase + bias * (0.08 + counterwave * 0.018)),
    radius: rounded(clamp(ribbon.radius + bias * 0.045 * counterwave, 0.18, 0.94)),
    width: rounded(clamp(ribbon.width + Math.abs(bias) * (0.004 + Math.abs(wave) * 0.003), 0.012, 0.06)),
    depth: rounded(clamp(ribbon.depth + bias * 0.05 * wave, 0.16, 1))
  };
}

export function commitCounterfield(field) {
  const left = field.offers.find((offer) => offer.side === 'left');
  const right = field.offers.find((offer) => offer.side === 'right');
  if (!left || !right) return { accepted: false, field: clone(field), event: null };

  const next = clone(field);
  const revision = field.revision + 1;
  const bias = rounded(right.amount - left.amount);
  const event = {
    kind: 'counterfield-production',
    relation: 'global-production',
    left: left.amount,
    right: right.amount,
    bias,
    revision
  };
  next.revision = revision;
  next.ribbons = field.ribbons.map((ribbon) => mutateRibbon(ribbon, bias, revision));
  next.volume = {
    ...field.volume,
    twist: rounded(field.volume.twist + bias * 0.18),
    fold: rounded(clamp(field.volume.fold + Math.abs(bias) * 0.07, 0.08, 0.46)),
    rise: rounded(field.volume.rise + bias * 0.09),
    yaw: rounded(field.volume.yaw + bias * 0.12),
    pitch: rounded(field.volume.pitch - bias * 0.08),
    scale: rounded(clamp(field.volume.scale + Math.abs(bias) * 0.035, 0.82, 1.08))
  };
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.ledger = {
    left: rounded(left.amount * 0.64 + right.amount * 0.1),
    right: rounded(right.amount * 0.64 + left.amount * 0.1)
  };
  next.offers = [];
  next.interaction = 'produced / counterfield';
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
  const pairs = [
    [{ side: 'left', amount: 0.18 }, { side: 'right', amount: 0.82 }],
    [{ side: 'left', amount: 0.76 }, { side: 'right', amount: 0.22 }],
    [{ side: 'left', amount: 0.31 }, { side: 'right', amount: 0.94 }],
    [{ side: 'left', amount: 0.88 }, { side: 'right', amount: 0.2 }]
  ];
  for (const pair of pairs) {
    field = armSide(armSide(field, pair[0]), pair[1]);
    field = commitCounterfield(field).field;
    timeline.push(field);
  }
  return timeline;
}
