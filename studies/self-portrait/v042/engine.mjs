export const NODE_COUNT = 17;
export const MEMORY_LIMIT = 4;
export const DEPARTURE_THRESHOLD = 0.62;
export const SEED = 0x503042;

const LAYOUT = [
  [-0.56, -0.86, 0.11, 0.16, -0.52], [-0.18, -0.78, 0.15, 0.10, 0.18], [0.26, -0.86, 0.12, 0.15, -0.28],
  [-0.70, -0.59, 0.14, 0.10, 0.36], [-0.34, -0.49, 0.10, 0.15, -0.12], [0.08, -0.56, 0.14, 0.11, 0.48], [0.52, -0.51, 0.11, 0.16, -0.42],
  [-0.58, -0.27, 0.12, 0.14, 0.22], [-0.16, -0.22, 0.15, 0.10, -0.48], [0.25, -0.29, 0.10, 0.15, 0.28], [0.64, -0.21, 0.13, 0.11, -0.24],
  [-0.67, 0.03, 0.11, 0.16, -0.34], [-0.30, 0.11, 0.14, 0.10, 0.24], [0.13, 0.04, 0.11, 0.15, -0.18], [0.52, 0.10, 0.14, 0.10, 0.44],
  [-0.40, 0.40, 0.15, 0.11, -0.26], [0.22, 0.46, 0.11, 0.15, 0.34]
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 17.413 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createNode(index) {
  const [x, y, width, height, angle] = LAYOUT[index];
  return {
    index,
    x: rounded(x + (seeded(index + 7) - 0.5) * 0.025),
    y: rounded(y + (seeded(index + 17) - 0.5) * 0.025),
    width: rounded(width * (0.9 + seeded(index + 27) * 0.16)),
    height: rounded(height * (0.9 + seeded(index + 37) * 0.16)),
    angle: rounded(angle + (seeded(index + 47) - 0.5) * 0.26),
    voidScale: rounded(0.36 + seeded(index + 57) * 0.24),
    notch: rounded(0.18 + seeded(index + 67) * 0.64),
    tone: index % 4,
    state: 'quiet'
  };
}

export function buildField() {
  return {
    composition: 'absence-ledger',
    renderer: 'p5-canvas',
    revision: 0,
    nodes: Array.from({ length: NODE_COUNT }, (_, index) => createNode(index)),
    presence: null,
    memory: [],
    snapshots: [],
    interaction: 'quiet field'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    nodes: field.nodes.map((node) => ({
      index: node.index,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      angle: node.angle,
      voidScale: node.voidScale,
      notch: node.notch,
      tone: node.tone,
      state: node.state
    }))
  });
}

function safeSite(site) {
  return clamp(Math.floor(Number(site) || 0), 0, NODE_COUNT - 1);
}

function safeLoad(load) {
  return rounded(clamp(Number(load) || 0, 0, 1));
}

export function approach(field, { site = 0, load = 0 } = {}) {
  const next = clone(field);
  const safe = safeSite(site);
  next.presence = { site: safe, load: safeLoad(load) };
  next.interaction = `present / ${safe}`;
  return next;
}

function chooseReceiver(source, revision) {
  let receiver = (source * 7 + revision * 5 + 3) % NODE_COUNT;
  if (receiver === source) receiver = (receiver + 1) % NODE_COUNT;
  return receiver;
}

function mutateRemote(node, load, revision) {
  const direction = revision % 2 === 0 ? 1 : -1;
  const intensity = clamp((load - DEPARTURE_THRESHOLD) / 0.38, 0.16, 1);
  return {
    ...node,
    x: rounded(node.x + direction * (0.025 + intensity * 0.046)),
    y: rounded(node.y - intensity * 0.034),
    width: rounded(clamp(node.width + intensity * 0.042, 0.07, 0.22)),
    height: rounded(clamp(node.height + direction * intensity * 0.022, 0.07, 0.22)),
    angle: rounded(node.angle + direction * (0.12 + intensity * 0.34)),
    voidScale: rounded(clamp(node.voidScale + 0.16 + intensity * 0.28, 0.2, 1.18)),
    notch: rounded((node.notch + direction * (0.08 + intensity * 0.16) + 1) % 1),
    state: 'hollow'
  };
}

export function commitDeparture(field) {
  const current = field.presence;
  if (!current || current.load < DEPARTURE_THRESHOLD) {
    return {
      accepted: false,
      field: { ...clone(field), presence: null, interaction: 'stayed / no departure' },
      event: null
    };
  }

  const next = clone(field);
  const revision = field.revision + 1;
  const source = current.site;
  const receiver = chooseReceiver(source, revision);
  const event = {
    kind: 'departure-recomposition',
    relation: 'absence-remembers-remotely',
    source,
    receiver,
    load: current.load,
    revision
  };

  next.revision = revision;
  next.nodes[receiver] = mutateRemote(field.nodes[receiver], current.load, revision);
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.presence = null;
  next.interaction = 'left / remote';
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
  const visits = [
    { site: 2, load: DEPARTURE_THRESHOLD + 0.18 },
    { site: 9, load: DEPARTURE_THRESHOLD + 0.28 },
    { site: 14, load: DEPARTURE_THRESHOLD + 0.12 },
    { site: 5, load: DEPARTURE_THRESHOLD + 0.34 }
  ];
  const timeline = [field];
  for (const visit of visits) {
    field = approach(field, visit);
    field = commitDeparture(field).field;
    timeline.push(field);
  }
  return timeline;
}
