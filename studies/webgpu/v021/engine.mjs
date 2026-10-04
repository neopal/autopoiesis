export const SEED = 0x57473231;
export const STAGES = 17;
export const ROWS = 6;
export const COLS = 10;
export const LAYERS = 3;
export const NODE_COUNT = ROWS * COLS * LAYERS;
export const CARRIERS = 4;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 72;

const TAU = Math.PI * 2;
const CARRIER_PHASES = [0.18, 1.72, 3.18, 4.62];
const AUTO_CALLS = [
  { node: 31, carrier: 1 },
  { node: 118, carrier: 3 },
  { node: 76, carrier: 0 },
  { node: 154, carrier: 2 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampInt = (value, min, max) => Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : min, min, max));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copy = (value) => JSON.parse(JSON.stringify(value));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const nodeAddress = (id) => {
  const layer = Math.floor(id / (ROWS * COLS));
  const rest = id % (ROWS * COLS);
  const row = Math.floor(rest / COLS);
  const col = rest % COLS;
  return { layer, row, col };
};

const baseNodes = () => Array.from({ length: NODE_COUNT }, (_, id) => {
  const { layer, row, col } = nodeAddress(id);
  return {
    id,
    layer,
    row,
    col,
    x: Number(((col - (COLS - 1) / 2) / (COLS - 1)).toFixed(5)),
    y: Number(((row - (ROWS - 1) / 2) / (ROWS - 1)).toFixed(5)),
    z: Number(((layer - 1) * 0.64).toFixed(5)),
    phase: Number((pseudo(id + 1) * TAU).toFixed(5)),
    lift: 0,
    tilt: 0,
    twist: 0,
    gap: 0,
    load: 0,
    active: 1,
    mode: 'quiet'
  };
});

const normalizeCall = (event = {}, serial = 0) => ({
  id: `call-${serial}`,
  source: event.source || 'replayed-call',
  mode: 'chorus-call',
  node: clampInt(event.node, 0, NODE_COUNT - 1),
  carrier: clampInt(event.carrier, 0, CARRIERS - 1),
  serial
});

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeCall(event, index));
const phaseDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const buildField = (memory) => {
  const nodes = baseNodes();
  const responses = [];
  const vacancies = [];
  const bridges = [];
  const answeredLayers = new Set();
  let resistance = 0;

  memory.forEach((rawEvent, serial) => {
    const event = normalizeCall(rawEvent, serial);
    const source = nodes[event.node];
    const carrierPhase = CARRIER_PHASES[event.carrier];
    const sourceLayer = source.layer;
    const effective = 0.78 / (1 + resistance * 0.24 + serial * 0.1);
    const answerLayer = wrap(sourceLayer + 2 + serial, LAYERS);

    nodes.forEach((node) => {
      const dx = node.x - source.x;
      const dy = node.y - source.y;
      const dz = (node.layer - sourceLayer) * 0.46;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const resonance = Math.max(0, 1 - phaseDistance(node.phase, carrierPhase) / 1.62);
      const proximity = Math.max(0, 1 - distance / 1.12);
      const replyStrength = resonance * proximity * effective;
      const remote = node.layer === answerLayer && distance > 0.35;
      const isSource = node.id === source.id;
      const replies = isSource || replyStrength > 0.12 || (remote && resonance > 0.18);
      const withholds = !replies && distance < 1.04 && ((node.id + serial * 3) % 4 === 0);

      if (replies) {
        const direction = ((node.col + node.row + serial) % 2 === 0 ? 1 : -1);
        node.lift += Number((0.06 + replyStrength * 0.34 + (remote ? 0.08 : 0)).toFixed(5));
        node.tilt += Number((direction * (0.08 + replyStrength * 0.5)).toFixed(5));
        node.twist += Number((((event.carrier - 1.5) * 0.06) + (remote ? 0.1 : 0)).toFixed(5));
        node.load += Number((replyStrength * (remote ? 1.4 : 0.8)).toFixed(5));
        node.mode = remote ? 'distant-reply' : 'reply';
        if (remote) answeredLayers.add(node.layer);
        responses.push({
          node: node.id,
          source: source.id,
          carrier: event.carrier,
          layer: node.layer,
          strength: Number(replyStrength.toFixed(5)),
          distant: remote
        });
      } else if (withholds) {
        node.gap = Number((Math.min(0.78, node.gap + 0.22 + effective * 0.18)).toFixed(5));
        node.active = Number(Math.max(0.08, node.active - 0.24).toFixed(5));
        node.tilt += Number(((node.row % 2 ? -1 : 1) * 0.12).toFixed(5));
        node.mode = 'withheld';
        vacancies.push({ node: node.id, source: source.id, carrier: event.carrier, gap: node.gap });
      } else {
        node.twist += Number(((node.layer - 1) * 0.012 * effective).toFixed(5));
      }
    });

    source.mode = 'caller';
    source.gap = Number(Math.min(0.22, source.gap + 0.04).toFixed(5));
    const bridgeTarget = wrap(event.node + COLS * (1 + serial) + 7, NODE_COUNT);
    const target = nodes[bridgeTarget];
    target.lift += Number((0.11 + effective * 0.18).toFixed(5));
    target.twist += Number((0.16 + event.carrier * 0.03).toFixed(5));
    target.mode = 'relay';
    bridges.push({ from: source.id, to: target.id, carrier: event.carrier, serial });
    resistance += 0.42 + event.carrier * 0.08;
  });

  const signature = JSON.stringify({
    resistance: Number(resistance.toFixed(5)),
    nodes: nodes.map((node) => [
      node.id,
      Number(node.x.toFixed(5)),
      Number(node.y.toFixed(5)),
      Number(node.z.toFixed(5)),
      Number(node.lift.toFixed(5)),
      Number(node.tilt.toFixed(5)),
      Number(node.twist.toFixed(5)),
      Number(node.gap.toFixed(5)),
      Number(node.load.toFixed(5)),
      Number(node.active.toFixed(5)),
      node.mode
    ])
  });

  return {
    nodes,
    responses,
    vacancies,
    bridges,
    answeredLayers: [...answeredLayers].sort((a, b) => a - b),
    resistance: Number(resistance.toFixed(5)),
    signature
  };
};

export const buildFrame = (stage = 0, memory = [], armedNode = 0, carrier = 0) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armedNode: clampInt(armedNode, 0, NODE_COUNT - 1),
    carrier: clampInt(carrier, 0, CARRIERS - 1),
    field: buildField(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({ index, id: event.id, mode: event.mode, node: event.node, carrier: event.carrier }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_CALLS.slice(0, Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 4)));
  const last = memory.at(-1) ?? AUTO_CALLS[0];
  return buildFrame(stage, memory, last.node, last.carrier);
});

export const armNode = (frame, cue = { node: frame.armedNode }) => ({
  ...frame,
  armedNode: clampInt(cue.node, 0, NODE_COUNT - 1)
});

export const tuneCarrier = (frame, cue = { carrier: frame.carrier }) => ({
  ...frame,
  carrier: clampInt(cue.carrier, 0, CARRIERS - 1)
});

export const callField = (frame, cue = { node: frame.armedNode, carrier: frame.carrier }) => {
  if (frame.memory.length >= MEMORY_LIMIT) return frame;
  const event = normalizeCall({ ...cue, source: 'visitor-call' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], event.node, event.carrier);
};

export const liftLatestCall = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), frame.armedNode, frame.carrier);
export const releaseField = () => buildFrame(0, [], 0, 0);
export const defaultCall = () => copy(AUTO_CALLS[0]);
export const carrierPhase = (carrier) => CARRIER_PHASES[clampInt(carrier, 0, CARRIERS - 1)];
export const geometrySignature = (frame) => JSON.stringify({
  field: frame.field.signature,
  responses: frame.field.responses,
  vacancies: frame.field.vacancies,
  bridges: frame.field.bridges
});
