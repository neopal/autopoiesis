const VIEWBOX = { width: 1000, height: 760 };

const SHELL_LAYOUT = [
  { x: 126, y: 308 }, { x: 166, y: 214 }, { x: 270, y: 132 },
  { x: 408, y: 108 }, { x: 552, y: 130 }, { x: 706, y: 174 },
  { x: 846, y: 278 }, { x: 882, y: 398 }, { x: 822, y: 532 },
  { x: 686, y: 624 }, { x: 530, y: 654 }, { x: 378, y: 640 },
  { x: 222, y: 590 }, { x: 138, y: 470 }
];

const APERTURE_LAYOUT = [
  { index: 0, x: 302, y: 262, rx: 52, ry: 34, rotation: -18 },
  { index: 1, x: 500, y: 216, rx: 42, ry: 58, rotation: 8 },
  { index: 2, x: 696, y: 286, rx: 58, ry: 38, rotation: 22 },
  { index: 3, x: 646, y: 486, rx: 45, ry: 66, rotation: -12 },
  { index: 4, x: 430, y: 522, rx: 60, ry: 36, rotation: 14 },
  { index: 5, x: 258, y: 438, rx: 40, ry: 56, rotation: -28 }
];

export const VIEWBOX_SIZE = VIEWBOX;
export const APERTURE_COUNT = APERTURE_LAYOUT.length;
export const RIM_COUNT = 4;
export const MEMORY_WINDOW = 4;

const round = (value) => Math.round(value * 1000) / 1000;

function pointPath(points) {
  return `M ${points.map(({ x, y }) => `${round(x)} ${round(y)}`).join(' L ')} Z`;
}

function aperturePath(layout, mutation = null) {
  const count = mutation?.kind === 'topology-split' ? 12 : 10;
  const points = Array.from({ length: count }, (_, step) => {
    const angle = (Math.PI * 2 * step) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotation = (layout.rotation * Math.PI) / 180;
    const notch = mutation?.kind === 'topology-split' && step % 4 === 0 ? mutation.depth * 0.7 : 0;
    return {
      x: layout.x + cos * (layout.rx + notch) * Math.cos(rotation) - sin * layout.ry * Math.sin(rotation),
      y: layout.y + cos * (layout.rx + notch) * Math.sin(rotation) + sin * layout.ry * Math.cos(rotation)
    };
  });
  return pointPath(points);
}

function normalizeMemory(memory) {
  return Array.isArray(memory) ? memory.slice(-MEMORY_WINDOW).map((event) => ({
    type: event.type,
    kind: event.kind,
    sourceAperture: event.sourceAperture,
    rim: event.rim,
    receiverAperture: event.receiverAperture,
    depth: event.depth
  })) : [];
}

function mutationFor(apertureIndex, memory) {
  const events = memory.filter((event) => event.receiverAperture === apertureIndex);
  return events.at(-1) ?? null;
}

function buildApertures(memory = []) {
  return APERTURE_LAYOUT.map((layout) => {
    const mutation = mutationFor(layout.index, memory);
    const path = aperturePath(layout, mutation);
    const topology = mutation?.kind === 'topology-split' ? 'split' : 'closed';
    return {
      ...layout,
      path,
      topology,
      secondaryPath: topology === 'split' ? aperturePath({ ...layout, x: layout.x + mutation.depth * 0.32, y: layout.y - mutation.depth * 0.18 }, mutation) : null,
      signature: `${layout.index}:${topology}:${path}:${topology === 'split' ? mutation.depth : 'sealed'}`
    };
  });
}

export function geometrySignature(frame) {
  return `${pointPath(frame.shell)}|${frame.apertures.map((aperture) => aperture.signature).join('|')}`;
}

export function buildFrame(memory = []) {
  const normalizedMemory = normalizeMemory(memory);
  const shell = SHELL_LAYOUT.map((point) => ({ ...point }));
  const apertures = buildApertures(normalizedMemory);
  return {
    grammar: 'topology-skin',
    shell,
    apertures,
    memory: normalizedMemory,
    pending: [],
    interaction: normalizedMemory.length ? 'settled' : 'quiet',
    event: null,
    state: { cutCount: normalizedMemory.length }
  };
}

export function beginCut(frame, apertureIndex) {
  if (!Number.isInteger(apertureIndex) || apertureIndex < 0 || apertureIndex >= APERTURE_COUNT) return frame;
  return { ...frame, pending: [apertureIndex], interaction: 'cut-started', event: null };
}

export function escapeSurface(frame, rimIndex) {
  if (!Number.isInteger(rimIndex) || rimIndex < 0 || rimIndex >= RIM_COUNT || frame.pending.length !== 1) return frame;
  return { ...frame, pending: [...frame.pending, rimIndex], interaction: 'cut-ready', event: null };
}

export function reenterSurface(frame, apertureIndex) {
  if (frame.pending.length !== 2 || frame.pending[0] !== apertureIndex) return frame;
  return { ...frame, pending: [], interaction: 'cut-refused-reentry', event: { type: 'cut-refused-reentry', sourceAperture: apertureIndex } };
}

function depthFor(memoryLength) {
  return round(26 + memoryLength * 11);
}

export function commitCut(frame) {
  if (!Array.isArray(frame.pending) || frame.pending.length !== 2) {
    return { ...frame, interaction: 'cut-refused-incomplete', event: { type: 'cut-refused', pending: [...(frame.pending ?? [])] } };
  }
  const [sourceAperture, rim] = frame.pending;
  const receiverAperture = (sourceAperture + rim + 3 + frame.memory.length) % APERTURE_COUNT;
  if (receiverAperture === sourceAperture) {
    return { ...frame, interaction: 'cut-refused-local', event: { type: 'cut-refused-local', sourceAperture, rim } };
  }
  const event = {
    type: 'topology-split',
    kind: 'topology-split',
    sourceAperture,
    rim,
    receiverAperture,
    depth: depthFor(frame.memory.length)
  };
  const next = buildFrame([...frame.memory, event]);
  next.pending = [];
  next.interaction = 'cut-committed';
  next.event = event;
  return next;
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (let count = 0; count < MEMORY_WINDOW; count += 1) {
    let next = beginCut(timeline.at(-1), 0);
    next = escapeSurface(next, count === MEMORY_WINDOW - 1 ? 1 : 0);
    timeline.push(commitCut(next));
  }
  return timeline;
}

export function liftLatestCut(frame) {
  if (!frame.memory.length) return frame;
  const lifted = buildFrame(frame.memory.slice(0, -1));
  lifted.interaction = 'cut-lifted';
  return lifted;
}

export function releaseSkin() {
  return buildFrame();
}
