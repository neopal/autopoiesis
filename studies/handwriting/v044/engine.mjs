export const TOKEN_COUNT = 12;
export const MATERIAL_BIN_COUNT = 5;
export const MEMORY_LIMIT = 4;
export const STAGES = 4;
export const MODE = 'material-carrier';

const TOKEN_TEXT = ['M', 'A', 'T', 'T', 'E', 'R', '/', 'R', 'O', 'U', 'T', 'E'];
const BASE_TOKENS = TOKEN_TEXT.map((glyph, id) => ({
  id,
  glyph,
  x: Number((0.08 + id * 0.076).toFixed(5)),
  y: Number((0.5 + Math.sin(id * 0.84) * 0.045).toFixed(5)),
  angle: Number((-7 + id * 1.2).toFixed(5)),
  scale: Number((0.88 + (id % 4) * 0.045).toFixed(5)),
  width: Number((0.7 + (id % 3) * 0.1).toFixed(5)),
  counter: Number((0.18 + (id % 2) * 0.07).toFixed(5)),
  load: 0,
  role: 'quiet'
}));

const BASE_CARRIER = {
  nodes: Array.from({ length: 13 }, (_, index) => ({
    x: Number((0.045 + index * 0.076).toFixed(5)),
    y: Number((0.55 + Math.sin(index * 0.72) * 0.052).toFixed(5)),
    radius: Number((0.012 + (index % 3) * 0.002).toFixed(5))
  })),
  tension: 0.48,
  signature: ''
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(5));
const baseField = () => ({ tokens: clone(BASE_TOKENS), carrier: withCarrierSignature(clone(BASE_CARRIER)) });
const withCarrierSignature = (carrier) => ({
  ...carrier,
  signature: JSON.stringify({
    nodes: carrier.nodes,
    tension: carrier.tension
  })
});
const withFieldSignature = (field) => ({
  ...field,
  signature: JSON.stringify({
    tokens: field.tokens,
    carrier: field.carrier.signature
  })
});
const makeFrame = (field, memory = [], pending = [], history = memory, serial = 0, lastEvent = 'quiet / carrier holding', changedTokenIds = []) => ({
  field: withFieldSignature(field),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedTokenIds
});

const classifyShape = (bins) => {
  if (bins[0] < bins[1] && bins[1] < bins[2]) return 'rising-load';
  if (bins[0] > bins[1] && bins[1] > bins[2]) return 'falling-load';
  return 'centered-load';
};

const eventHash = (bins, serial) => (bins[0] * 17 + bins[1] * 31 + bins[2] * 47 + serial * 59) % 97;

export const buildFrame = () => makeFrame(baseField());

export const loadMaterial = (frame, input) => {
  const bin = Number(input?.bin);
  if (!Number.isInteger(bin) || bin < 0 || bin >= MATERIAL_BIN_COUNT) {
    return { ...frame, pending: [], lastEvent: 'refused material load', changedTokenIds: [] };
  }
  if (frame.pending.includes(bin) || frame.pending.length >= 3) {
    return { ...frame, lastEvent: 'refused duplicate load', changedTokenIds: [] };
  }
  return { ...frame, pending: [...frame.pending, bin], lastEvent: 'material load held', changedTokenIds: [] };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const [first, middle, last] = event.bins;
  const shape = event.loadShape;
  const direction = shape === 'falling-load' ? -1 : shape === 'rising-load' ? 1 : (event.serial % 2 ? -1 : 1);
  const center = (first + middle + last) / 3;
  const spread = Math.abs(last - first) + 1;
  const hash = eventHash(event.bins, event.serial);
  const changedTokenIds = [];

  next.carrier.nodes = next.carrier.nodes.map((node, index) => {
    const t = index / 12;
    const pressure = Math.sin((t * 2.8 + center * 0.21 + event.serial * 0.17) * Math.PI);
    const fold = Math.cos((t - center / 5) * Math.PI * 1.7) * (0.014 + spread * 0.004);
    return {
      x: node.x,
      y: round(clamp(node.y + direction * pressure * (0.014 + spread * 0.003) + fold, 0.25, 0.78)),
      radius: round(clamp(node.radius + 0.0015 * direction * Math.sin(index + hash), 0.008, 0.028))
    };
  });
  next.carrier.tension = round(clamp(next.carrier.tension + direction * (0.06 + event.serial * 0.008), 0.18, 0.86));
  next.carrier = withCarrierSignature(next.carrier);

  next.tokens = next.tokens.map((token, index) => {
    const t = index / (TOKEN_COUNT - 1);
    const carrierNode = next.carrier.nodes[index];
    const wave = Math.sin((t * 3.1 + center * 0.42 + event.serial * 0.2) * Math.PI);
    const hinge = Math.exp(-Math.abs(t - center / 5) * 3.2);
    const amount = 0.018 + spread * 0.006;
    changedTokenIds.push(token.id);
    return {
      ...token,
      y: round(clamp(carrierNode.y - 0.058 + wave * 0.011, 0.12, 0.86)),
      angle: round(token.angle + direction * (3.2 + hinge * 4.4) + (index % 2 ? -1 : 1) * event.serial * 0.45),
      scale: round(clamp(token.scale + direction * (0.018 + hinge * 0.022), 0.68, 1.34)),
      width: round(clamp(token.width + direction * amount * (0.55 + ((index + hash) % 3) * 0.12), 0.45, 1.16)),
      counter: round(clamp(token.counter + (index % 3 === event.serial % 3 ? 0.035 : -0.012) + direction * hinge * 0.026, 0.06, 0.42)),
      load: token.load + 1,
      role: index === Math.round(center * 2) % TOKEN_COUNT ? 'hinge' : 'cast'
    };
  });
  return { field: next, changedTokenIds };
};

const replay = (history) => {
  let field = baseField();
  let changedTokenIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedTokenIds = applied.changedTokenIds;
  }
  return { field, changedTokenIds };
};

export const castMaterial = (frame) => {
  if (!frame.pending || frame.pending.length !== 3) {
    return { ...frame, pending: [], lastEvent: 'refused incomplete cast', changedTokenIds: [] };
  }
  const event = {
    type: 'material-cast',
    bins: [...frame.pending],
    loadShape: classifyShape(frame.pending),
    serial: frame.serial + 1,
    mode: MODE
  };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_LIMIT),
    [],
    history,
    event.serial,
    `${event.loadShape} cast / carrier re-formed`,
    replayed.changedTokenIds
  );
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest cast' };
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_LIMIT),
    [],
    history,
    frame.serial,
    'lifted latest cast',
    replayed.changedTokenIds
  );
};

export const releaseArchive = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });

export const buildTimeline = () => {
  const sequences = [[0, 2, 4], [4, 1, 3], [1, 3, 0], [2, 4, 1]];
  let frame = buildFrame();
  return sequences.map((bins) => {
    for (const bin of bins) frame = loadMaterial(frame, { bin });
    frame = castMaterial(frame);
    return frame;
  });
};
