export const SEED = 0x4e413137;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 39;
export const MEMORY_WINDOW = 4;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const BLOCK_LAYOUT = [
  { id: 'brick-01', x: 0.25, y: 0.64, w: 0.28, h: 0.15, color: '#d85d4c', motif: 'loop' },
  { id: 'brick-02', x: 0.44, y: 0.58, w: 0.29, h: 0.17, color: '#173247', motif: 'ladder' },
  { id: 'brick-03', x: 0.64, y: 0.62, w: 0.27, h: 0.15, color: '#e6b949', motif: 'star' },
  { id: 'brick-04', x: 0.35, y: 0.46, w: 0.25, h: 0.16, color: '#6f8f80', motif: 'cup' },
  { id: 'brick-05', x: 0.55, y: 0.45, w: 0.28, h: 0.16, color: '#a58ab0', motif: 'knot' },
  { id: 'brick-06', x: 0.46, y: 0.32, w: 0.24, h: 0.15, color: '#77aeb0', motif: 'step' },
  { id: 'brick-07', x: 0.67, y: 0.37, w: 0.20, h: 0.13, color: '#c96959', motif: 'crumb' },
  { id: 'brick-08', x: 0.20, y: 0.43, w: 0.18, h: 0.12, color: '#3e5968', motif: 'eyelet' },
  { id: 'brick-09', x: 0.78, y: 0.50, w: 0.16, h: 0.12, color: '#d3a76f', motif: 'stripe' },
  { id: 'brick-10', x: 0.52, y: 0.76, w: 0.20, h: 0.12, color: '#8e5d57', motif: 'slash' }
];

const MOTIFS = BLOCK_LAYOUT.map((block) => block.motif);

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyEvent(event) {
  return {
    ...event,
    point: event.point ? copyPoint(event.point) : null,
    targetIndex: Number(event.targetIndex),
    receiverIndex: Number(event.receiverIndex),
    supportIndex: Number(event.supportIndex),
    dwell: Number(event.dwell),
    skew: Number(event.skew),
    wobble: Number(event.wobble)
  };
}

function copyBlock(block) {
  return {
    ...block,
    angle: Number(block.angle),
    lift: Number(block.lift),
    scaleX: Number(block.scaleX),
    scaleY: Number(block.scaleY),
    shift: { ...block.shift },
    falseFaces: (block.falseFaces ?? []).map((face) => ({ ...face })),
    inheritedFaces: (block.inheritedFaces ?? []).map((face) => ({ ...face })),
    chips: (block.chips ?? []).map((chip) => ({ ...chip }))
  };
}

function centerOf(block) {
  return { x: block.x + block.shift.x, y: block.y + block.shift.y - block.lift };
}

function nearestBlock(point) {
  return BLOCK_LAYOUT.reduce((closest, block, index) => {
    const distance = Math.hypot(point.x - block.x, point.y - block.y);
    return distance < closest.distance ? { index, distance } : closest;
  }, { index: 0, distance: Infinity }).index;
}

function attentionForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const point = { x: 0.20 + random() * 0.58, y: 0.29 + random() * 0.48 };
  const targetIndex = nearestBlock(point);
  return {
    stage,
    source: 'autonomous-attention',
    point,
    targetIndex,
    receiverIndex: (targetIndex + 3 + Math.floor(random() * 3)) % BLOCK_LAYOUT.length,
    supportIndex: (targetIndex + 1 + Math.floor(random() * 2)) % BLOCK_LAYOUT.length,
    dwell: 0.72 + random() * 0.46,
    skew: (random() - 0.5) * 0.9,
    wobble: (random() - 0.5) * 0.8,
    reason: 'the pile thought the visitor belonged to the wrong block'
  };
}

function attentionsForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((event, order) => ({ ...copyEvent(event), order }));
}

function baseBlocks(random) {
  return BLOCK_LAYOUT.map((block, index) => ({
    ...block,
    angle: (index % 2 ? -1 : 1) * (0.02 + random() * 0.08),
    lift: random() * 0.012,
    scaleX: 0.94 + random() * 0.10,
    scaleY: 0.94 + random() * 0.10,
    shift: { x: (random() - 0.5) * 0.012, y: (random() - 0.5) * 0.012 },
    falseFaces: [],
    inheritedFaces: [],
    chips: [{ kind: block.motif, offset: (random() - 0.5) * 0.16 }]
  }));
}

function composeScene(events, random) {
  const blocks = baseBlocks(random);
  const attentionRecords = [];
  const gaps = [];
  const shadow = { x: 0.03, y: 0.05, scale: 1, tilt: 0 };

  for (const [order, event] of events.entries()) {
    const target = blocks[event.targetIndex];
    const receiver = blocks[event.receiverIndex];
    const support = blocks[event.supportIndex];
    const impulse = 0.045 + event.dwell * 0.026 + order * 0.008;

    target.angle += event.skew * 0.18;
    target.lift += impulse * 0.80;
    target.scaleX = clamp(target.scaleX - impulse * 0.10, 0.76, 1.12);
    target.scaleY = clamp(target.scaleY + impulse * 0.06, 0.82, 1.12);
    target.falseFaces.push({
      source: event.source,
      from: target.motif,
      to: MOTIFS[event.receiverIndex],
      color: BLOCK_LAYOUT[event.receiverIndex].color,
      x: event.skew * 0.16,
      y: -0.05 - order * 0.012,
      scale: 0.70 + event.dwell * 0.11,
      rotation: event.skew * 0.28
    });
    target.chips.push({ kind: 'wrong-edge', offset: event.skew * 0.22 });

    receiver.angle -= event.skew * 0.16;
    receiver.lift += impulse * 0.34;
    receiver.inheritedFaces.push({
      source: event.source,
      from: MOTIFS[event.targetIndex],
      to: MOTIFS[event.receiverIndex],
      color: BLOCK_LAYOUT[event.targetIndex].color,
      x: (order % 2 ? -0.12 : 0.12) + event.wobble * 0.08,
      y: -0.03,
      scale: 0.52 + event.dwell * 0.08,
      rotation: event.wobble * 0.30
    });

    support.shift.x += event.wobble * 0.025 + (order % 2 ? -0.009 : 0.009);
    support.shift.y += 0.018 + event.skew * 0.008;
    support.angle -= event.wobble * 0.10;
    gaps.push({
      source: event.source,
      order,
      x: (target.x + support.x) * 0.5 + event.wobble * 0.035,
      y: (target.y + support.y) * 0.5 - 0.035,
      w: 0.10 + event.dwell * 0.02,
      h: 0.045 + order * 0.006,
      angle: event.skew * 0.20
    });

    shadow.x += event.wobble * 0.018;
    shadow.y += 0.008;
    shadow.scale += 0.014;
    shadow.tilt += event.skew * 0.08;
    attentionRecords.push({ ...copyEvent(event), order });
  }

  return {
    attentionRecords,
    blocks,
    gaps,
    shadow,
    materialTrace: {
      attentionCount: events.length,
      immediatePresenceChanges: 0,
      sustainedAttentionChanges: events.length * 4,
      falseFaceCount: blocks.reduce((sum, block) => sum + block.falseFaces.length, 0),
      inheritedFaceCount: blocks.reduce((sum, block) => sum + block.inheritedFaces.length, 0),
      gapCount: gaps.length,
      grammar: 'presence arms a witness → sustained attention misaddresses a block → a wrong face arrives → the pile exposes a gap'
    }
  };
}

export function attentionSignature(frame) {
  return frame.scene.blocks.map((block) => [
    block.id,
    Number(block.angle).toFixed(4),
    Number(block.lift).toFixed(4),
    Number(block.scaleX).toFixed(4),
    Number(block.scaleY).toFixed(4),
    Number(block.shift.x).toFixed(4),
    Number(block.shift.y).toFixed(4),
    ...block.falseFaces.map((face) => `false:${face.to}:${Number(face.x).toFixed(4)},${Number(face.y).toFixed(4)}`),
    ...block.inheritedFaces.map((face) => `inherited:${face.from}:${Number(face.x).toFixed(4)},${Number(face.y).toFixed(4)}`)
  ].join('|')).join('||');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent) : [];
  return {
    stage: safeStage,
    memory: inherited,
    correction: attentionForStage(safeStage),
    primitiveCount: PRIMITIVE_BUDGET,
    draft: { blocks: BLOCK_LAYOUT.map((block) => ({ ...block })) },
    scene: composeScene(attentionsForMemory(inherited), random)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(Math.max(0, stageCount), STAGES) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.correction];
    return frame;
  });
}

export function applyAttention(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.10, 0.90),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.18, 0.86)
  };
  const random = rng(SEED + frame.stage * 97 + frame.memory.length * 131);
  const targetIndex = nearestBlock(bounded);
  const event = {
    stage: frame.stage,
    source: 'visitor-attention',
    point: bounded,
    targetIndex,
    receiverIndex: (targetIndex + 3 + Math.floor(random() * 3)) % BLOCK_LAYOUT.length,
    supportIndex: (targetIndex + 1 + Math.floor(random() * 2)) % BLOCK_LAYOUT.length,
    dwell: 0.76 + bounded.y * 0.32,
    skew: (bounded.x - 0.5) * 1.2,
    wobble: (bounded.y - 0.5) * 1.1,
    reason: 'the pile thought the visitor belonged to the wrong block'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, event]), interaction: 'visitor-attention' };
}

export function deleteLatestAttention(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'attention-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'attention-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    field: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }
  };
}

export { MOTIFS };
