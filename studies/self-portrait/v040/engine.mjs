export const APERTURE_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503040;

const LAYOUT = [
  [-0.56, -0.54, 0.12, -0.14], [-0.18, -0.64, 0.16, 0.06], [0.24, -0.57, 0.11, -0.2],
  [0.58, -0.34, 0.14, 0.15], [-0.61, -0.08, 0.15, 0.2], [0.02, -0.12, 0.19, -0.1],
  [0.53, 0.07, 0.12, -0.08], [-0.46, 0.31, 0.16, 0.12], [-0.05, 0.34, 0.13, -0.22],
  [0.39, 0.36, 0.18, 0.1], [-0.31, 0.61, 0.12, 0.17], [0.18, 0.62, 0.15, -0.08]
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 23.719 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createAperture(index) {
  const [x, y, radius, angle] = LAYOUT[index];
  return {
    index,
    x: rounded(x + (seeded(index + 11) - 0.5) * 0.035),
    y: rounded(y + (seeded(index + 21) - 0.5) * 0.035),
    radius: rounded(radius * (0.88 + seeded(index + 31) * 0.22)),
    angle: rounded(angle + (seeded(index + 41) - 0.5) * 0.18),
    cut: rounded(0.22 + seeded(index + 51) * 0.42),
    depth: rounded(0.3 + seeded(index + 61) * 0.55),
    state: 'quiet'
  };
}

export function buildField() {
  return {
    composition: 'return-mask',
    renderer: 'canvas2d',
    revision: 0,
    mask: {
      seam: rounded(-0.08 + seeded(71) * 0.16),
      tilt: rounded(-0.12 + seeded(72) * 0.24),
      bulge: rounded(0.82 + seeded(73) * 0.18),
      scale: rounded(0.92 + seeded(74) * 0.12),
      offsetX: rounded(-0.03 + seeded(75) * 0.06),
      offsetY: rounded(-0.02 + seeded(76) * 0.04)
    },
    apertures: Array.from({ length: APERTURE_COUNT }, (_, index) => createAperture(index)),
    ledger: Array.from({ length: APERTURE_COUNT }, () => 0),
    pulses: [],
    memory: [],
    snapshots: [],
    interaction: 'quiet'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    mask: field.mask,
    apertures: field.apertures.map((aperture) => [
      aperture.index, aperture.x, aperture.y, aperture.radius, aperture.angle,
      aperture.cut, aperture.depth, aperture.state
    ])
  });
}

function safeSite(site) {
  return clamp(Math.floor(Number(site) || 0), 0, APERTURE_COUNT - 1);
}

function safeGap(gap) {
  return rounded(clamp(Number(gap) || 0, 0.01, 2));
}

export function pulse(field, { site = 0, gap = 0.42 } = {}) {
  const next = clone(field);
  const safe = safeSite(site);
  const entry = { site: safe, gap: safeGap(gap) };
  next.pulses = [...next.pulses, entry].slice(-3);
  next.ledger[safe] = 1;
  next.interaction = `pulse / ${next.pulses.length}`;
  return next;
}

function nextRemote(candidate, forbidden) {
  let index = ((candidate % APERTURE_COUNT) + APERTURE_COUNT) % APERTURE_COUNT;
  while (forbidden.has(index)) index = (index + 1) % APERTURE_COUNT;
  return index;
}

function mutateAperture(aperture, role, intensity, cadence, revision) {
  const next = { ...aperture, state: role };
  if (role === 'hollow') {
    next.radius = rounded(clamp(aperture.radius + 0.035 + intensity * 0.05, 0.06, 0.24));
    next.cut = rounded(clamp(aperture.cut + cadence * 0.16, 0.08, 0.92));
  } else if (role === 'scar') {
    next.x = rounded(aperture.x + (revision % 2 ? 0.055 : -0.055) * (0.7 + cadence));
    next.y = rounded(aperture.y - 0.035 * intensity);
    next.depth = rounded(clamp(aperture.depth + 0.17, 0.1, 1));
  } else if (role === 'lean') {
    next.angle = rounded(aperture.angle + (revision % 2 ? 0.22 : -0.22) * (0.8 + intensity));
    next.cut = rounded(clamp(aperture.cut - 0.12 - cadence * 0.08, 0.06, 0.92));
    next.depth = rounded(clamp(aperture.depth + 0.06 * intensity, 0.1, 1));
  }
  return next;
}

export function sealCadence(field) {
  if (field.pulses.length < 3) return { accepted: false, field: clone(field), event: null };
  const sequence = field.pulses.slice(-3);
  const [first, middle, last] = sequence;
  if (first.site !== last.site || first.site === middle.site) {
    return { accepted: false, field: clone(field), event: null };
  }

  const next = clone(field);
  const revision = field.revision + 1;
  const cadence = rounded(Math.abs(middle.gap - first.gap) + Math.abs(last.gap - middle.gap));
  const intensity = rounded(clamp((first.gap + middle.gap + last.gap) / 3, 0.01, 2));
  const forbidden = new Set([first.site, middle.site]);
  const hollowSite = nextRemote(first.site + revision * 2 + 1, forbidden);
  forbidden.add(hollowSite);
  const scarSite = nextRemote(middle.site + revision * 3 + 2, forbidden);
  forbidden.add(scarSite);
  const leanSite = nextRemote(first.site + middle.site + revision * 4 + 3, forbidden);
  const remoteSites = [hollowSite, scarSite, leanSite];
  const event = {
    kind: 'return-cadence',
    relation: 'remote-recut',
    sequence: sequence.map((entry) => entry.site),
    gaps: sequence.map((entry) => entry.gap),
    remoteSites,
    roles: ['hollow', 'scar', 'lean'],
    cadence,
    intensity,
    revision
  };

  next.revision = revision;
  next.apertures = field.apertures.map((aperture) => {
    if (aperture.index === hollowSite) return mutateAperture(aperture, 'hollow', intensity, cadence, revision);
    if (aperture.index === scarSite) return mutateAperture(aperture, 'scar', intensity, cadence, revision);
    if (aperture.index === leanSite) return mutateAperture(aperture, 'lean', intensity, cadence, revision);
    return aperture;
  });
  next.mask = {
    ...field.mask,
    seam: rounded(field.mask.seam + (revision % 2 ? 1 : -1) * (0.045 + cadence * 0.018)),
    tilt: rounded(field.mask.tilt + (middle.site > first.site ? 1 : -1) * (0.06 + intensity * 0.012)),
    bulge: rounded(clamp(field.mask.bulge + 0.035 + cadence * 0.01, 0.72, 1.18)),
    offsetX: rounded(field.mask.offsetX + (first.site % 2 ? -1 : 1) * 0.018),
    offsetY: rounded(field.mask.offsetY + 0.012 * (revision % 2 ? 1 : -1))
  };
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.ledger = field.ledger.map((value, index) => rounded(value * 0.74 + (index === middle.site ? 0.12 : 0)));
  next.pulses = [];
  next.interaction = 'sealed / return';
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
  const returns = [
    [{ site: 2, gap: 0.22 }, { site: 8, gap: 0.61 }, { site: 2, gap: 0.24 }],
    [{ site: 7, gap: 0.76 }, { site: 3, gap: 0.31 }, { site: 7, gap: 0.54 }],
    [{ site: 10, gap: 0.19 }, { site: 1, gap: 0.83 }, { site: 10, gap: 0.4 }],
    [{ site: 5, gap: 0.91 }, { site: 11, gap: 0.28 }, { site: 5, gap: 0.72 }]
  ];
  for (const sequence of returns) {
    for (const entry of sequence) field = pulse(field, entry);
    field = sealCadence(field).field;
    timeline.push(field);
  }
  return timeline;
}
