const BASE_SEED = 0x53564728;
export const PLATE_COUNT = 7;
export const MEMORY_WINDOW = 4;

const PLATE_LAYOUT = [
  { x: 0.16, y: 0.24, w: 0.2, h: 0.34, angle: -13, phase: 0.08 },
  { x: 0.37, y: 0.18, w: 0.2, h: 0.42, angle: 7, phase: 0.31 },
  { x: 0.61, y: 0.22, w: 0.22, h: 0.34, angle: -5, phase: 0.57 },
  { x: 0.82, y: 0.29, w: 0.17, h: 0.4, angle: 16, phase: 0.79 },
  { x: 0.22, y: 0.68, w: 0.24, h: 0.36, angle: 9, phase: 0.19 },
  { x: 0.51, y: 0.76, w: 0.23, h: 0.28, angle: -11, phase: 0.43 },
  { x: 0.78, y: 0.7, w: 0.2, h: 0.34, angle: 4, phase: 0.68 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function basePlate(index) {
  const source = PLATE_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    w: source.w,
    h: source.h,
    angle: source.angle,
    phase: source.phase,
    fold: 0,
    aperture: {
      x: 0.5 + (source.phase - 0.5) * 0.18,
      y: 0.5 - (source.phase - 0.5) * 0.22,
      radius: 0.095 + (index % 3) * 0.014
    }
  };
}

function polygonPath(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ')} Z`;
}

function localPath(plate) {
  const { w, h, aperture, fold } = plate;
  const halfW = w * 500;
  const halfH = h * 340;
  const bevel = Math.min(w * 1000, h * 680) * (0.12 + fold * 0.018);
  const outer = polygonPath([
    [-halfW + bevel, -halfH], [halfW - bevel, -halfH], [halfW, -halfH + bevel],
    [halfW, halfH - bevel], [halfW - bevel, halfH], [-halfW + bevel, halfH],
    [-halfW, halfH - bevel], [-halfW, -halfH + bevel]
  ]);
  const apertureWidth = aperture.radius * 500 * (1 + fold * 0.1);
  const apertureHeight = aperture.radius * 340 * (0.78 + Math.abs(Math.sin(plate.phase * Math.PI)) * 0.22);
  const cx = (aperture.x - 0.5) * w * 1000;
  const cy = (aperture.y - 0.5) * h * 680;
  const notch = Math.min(apertureWidth, apertureHeight) * (0.18 + fold * 0.025);
  const inner = polygonPath([
    [cx - apertureWidth, cy - apertureHeight + notch], [cx - notch, cy - apertureHeight],
    [cx + apertureWidth - notch, cy - apertureHeight], [cx + apertureWidth, cy - apertureHeight + notch],
    [cx + apertureWidth, cy + apertureHeight - notch], [cx + notch, cy + apertureHeight],
    [cx - apertureWidth + notch, cy + apertureHeight], [cx - apertureWidth, cy + apertureHeight - notch]
  ]);
  return `${outer} ${inner}`;
}

function plateSignature(plate) {
  return `${localPath(plate)}|translate(${(plate.x * 1000).toFixed(3)} ${(plate.y * 680).toFixed(3)}) rotate(${plate.angle.toFixed(3)})`;
}

function materialState(memory) {
  const plates = PLATE_LAYOUT.map((_, index) => basePlate(index));
  for (const event of memory) applyEvent(plates, event);
  return plates;
}

function applyEvent(plates, event) {
  const source = plates[event.source];
  const target = plates[event.target];
  const relay = plates[event.relay];
  const direction = event.source < event.target ? 1 : -1;
  source.aperture.radius = clamp(source.aperture.radius * 0.6, 0.035, 0.2);
  source.aperture.x = clamp(source.aperture.x + direction * 0.035, 0.18, 0.82);
  source.aperture.y = clamp(source.aperture.y - 0.026, 0.18, 0.82);
  source.angle += direction * 3.4;
  source.fold += 1;

  target.aperture.radius = clamp(target.aperture.radius + 0.047 + event.index * 0.004, 0.075, 0.22);
  target.aperture.x = clamp(target.aperture.x - direction * 0.046, 0.16, 0.84);
  target.aperture.y = clamp(target.aperture.y + 0.032, 0.16, 0.84);
  target.angle -= direction * 4.2;
  target.fold += 1;

  relay.aperture.x = clamp(relay.aperture.x + (event.index % 2 ? -0.033 : 0.033), 0.16, 0.84);
  relay.aperture.y = clamp(relay.aperture.y + (direction * 0.028), 0.16, 0.84);
  relay.angle += direction * 2.1;
  relay.fold += 1;
}

function nearestPlate(plates, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  for (const plate of plates) {
    const distance = (plate.x - x) ** 2 + (plate.y - y) ** 2;
    if (distance < score) {
      score = distance;
      winner = plate.id;
    }
  }
  return winner;
}

function chooseEvent(plates, point, memory) {
  const source = nearestPlate(plates, point);
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  const offset = 2 + (Math.floor((x + y) * 10) + memory.length) % (PLATE_COUNT - 2);
  const target = wrap(source + offset, PLATE_COUNT);
  const relay = wrap(target + 2 + (Math.floor(x * 7) % 2), PLATE_COUNT);
  const safeRelay = relay === source || relay === target ? wrap(relay + 1, PLATE_COUNT) : relay;
  return { source, target, relay: safeRelay, x, y, index: memory.length, committed: true, type: 'departure-relay' };
}

function frameFrom(stage, memory, interaction, event, armedSource) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const plates = materialState(safeMemory);
  for (const plate of plates) plate.pathSignature = plateSignature(plate);
  const frame = {
    grammar: 'aperture-array',
    stage: clamp(Number(stage) || 0, 0, 12),
    memory: safeMemory,
    plates,
    interaction,
    event: event ?? { committed: false },
    armedSource: armedSource ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null, null);
}

export function geometrySignature(frame) {
  return frame.plates.map((plate) => `${plate.id}:${plate.pathSignature ?? plateSignature(plate)}`).join('||');
}

export function armPlate(frame, point) {
  const source = nearestPlate(frame.plates, point);
  return frameFrom(frame.stage, frame.memory, 'attention-armed', { committed: false, source }, source);
}

export function applyDeparture(frame, point) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'departure-memory-full', { committed: false, reason: 'memory-full' }, frame.armedSource);
  }
  const basePlates = materialState(frame.memory);
  const event = chooseEvent(basePlates, point, frame.memory);
  if (frame.armedSource !== null && frame.armedSource !== undefined) event.source = frame.armedSource;
  event.target = wrap(event.source + 2 + (event.index % (PLATE_COUNT - 2)), PLATE_COUNT);
  event.relay = wrap(event.target + 2 + (event.index % 2), PLATE_COUNT);
  if (event.relay === event.source || event.relay === event.target) event.relay = wrap(event.relay + 1, PLATE_COUNT);
  const nextMemory = [...frame.memory, event];
  return frameFrom(frame.stage + 1, nextMemory, 'departure-relay', event, null);
}

export function liftLatestDeparture(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false }, null);
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'departure-lifted', { committed: false, lifted: true }, null);
}

export function releaseArray() {
  return frameFrom(0, [], 'released', { committed: false, released: true }, null);
}

export function buildTimeline() {
  let frame = buildFrame(0, []);
  for (const point of [{ x: 0.16, y: 0.2 }, { x: 0.82, y: 0.23 }, { x: 0.28, y: 0.78 }, { x: 0.64, y: 0.72 }]) {
    frame = applyDeparture(frame, point);
  }
  return [buildFrame(0, []), ...frame.memory.map((_, index) => frameFrom(index + 1, frame.memory.slice(0, index + 1), 'departure-relay', frame.memory[index], null))];
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'aperture-array',
  rule: 'attention arms a plate; only departure closes a local aperture and relays an opening to non-local plates',
  memoryWindow: MEMORY_WINDOW
};
