export const SEED = 0x53564747;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 12;
export const MEMORY_LIMIT = 4;
export const ANCHOR_COUNT = 8;

const AUTO_RELAYS = [
  { source: 0, target: 4 },
  { source: 2, target: 6 },
  { source: 4, target: 1 },
  { source: 6, target: 3 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function point(value) {
  return { x: Number(value.x), y: Number(value.y) };
}

function copyAnchor(anchor) {
  return { ...anchor, center: point(anchor.center) };
}

function copyLink(link) {
  return {
    ...link,
    fromPoint: point(link.fromPoint),
    toPoint: point(link.toPoint),
    bendPoint: point(link.bendPoint)
  };
}

function copyRelay(relay) {
  return { ...relay, source: point(relay.source), target: point(relay.target) };
}

function copyMemory(memory) {
  return memory.map(copyRelay);
}

function baseAnchors(stage) {
  const random = rng(SEED + stage * 997);
  return Array.from({ length: ANCHOR_COUNT }, (_, index) => {
    const angle = -Math.PI / 2 + (index / ANCHOR_COUNT) * Math.PI * 2;
    const radiusX = 0.31 + random() * 0.035 + Math.sin(stage * 0.17 + index) * 0.012;
    const radiusY = 0.28 + random() * 0.045 + Math.cos(stage * 0.13 + index * 0.7) * 0.014;
    return {
      id: `anchor-${String(index).padStart(2, '0')}`,
      index,
      center: {
        x: clamp(0.5 + Math.cos(angle) * radiusX, 0.12, 0.88),
        y: clamp(0.5 + Math.sin(angle) * radiusY, 0.14, 0.86)
      },
      angle,
      role: 'idle',
      aperture: 0.055 + random() * 0.014
    };
  });
}

function linkBend(a, b, index, stage) {
  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const amount = 0.035 + ((index + stage) % 3) * 0.012;
  return {
    x: midpoint.x + normal.x * amount,
    y: midpoint.y + normal.y * amount
  };
}

function makeBaseLinks(anchors, stage) {
  return anchors.map((anchor, index) => {
    const next = anchors[(index + 1) % ANCHOR_COUNT];
    return {
      id: `link-${String(index).padStart(2, '0')}`,
      from: index,
      to: (index + 1) % ANCHOR_COUNT,
      fromPoint: point(anchor.center),
      toPoint: point(next.center),
      bendPoint: linkBend(anchor.center, next.center, index, stage),
      visible: true,
      role: 'base'
    };
  });
}

function safeIndex(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(Math.floor(numeric), 0, ANCHOR_COUNT - 1) : fallback;
}

function normalizePair(pair, stage = 0) {
  const sourceIndex = safeIndex(pair?.source, stage % ANCHOR_COUNT);
  let targetIndex = safeIndex(pair?.target, (sourceIndex + 4) % ANCHOR_COUNT);
  if (targetIndex === sourceIndex) targetIndex = (sourceIndex + 4) % ANCHOR_COUNT;
  return { sourceIndex, targetIndex };
}

function makeRelay(anchors, stage, pair, source = 'auto-relay') {
  const { sourceIndex, targetIndex } = normalizePair(pair, stage);
  const sourceAnchor = anchors[sourceIndex];
  const targetAnchor = anchors[targetIndex];
  return {
    kind: 'relay',
    mode: 'two-point-relay',
    sourceIndex,
    targetIndex,
    source: point(sourceAnchor.center),
    target: point(targetAnchor.center),
    sourceName: sourceAnchor.id,
    targetName: targetAnchor.id,
    sourceLabel: source,
    stage
  };
}

function applyMemory(anchors, links, memory) {
  const nextAnchors = anchors.map(copyAnchor);
  const nextLinks = links.map(copyLink);
  const bridges = [];

  for (const [memoryIndex, relay] of memory.entries()) {
    const source = nextAnchors[relay.sourceIndex];
    const target = nextAnchors[relay.targetIndex];
    const baseLink = nextLinks[relay.sourceIndex];
    if (!source || !target || !baseLink) continue;

    source.role = 'cut-source';
    source.aperture = Math.max(0.028, source.aperture * (0.72 - memoryIndex * 0.02));
    source.center.x = clamp(source.center.x + (target.center.x - source.center.x) * 0.035, 0.10, 0.90);
    source.center.y = clamp(source.center.y + (target.center.y - source.center.y) * 0.035, 0.12, 0.88);

    target.role = 'wrong-return';
    target.aperture = Math.min(0.11, target.aperture + 0.012 + memoryIndex * 0.003);
    target.center.x = clamp(target.center.x + (source.center.x - target.center.x) * 0.028, 0.10, 0.90);
    target.center.y = clamp(target.center.y + (source.center.y - target.center.y) * 0.028, 0.12, 0.88);

    baseLink.visible = false;
    baseLink.role = 'cut';
    baseLink.cutBy = relay.targetIndex;

    const bridge = {
      id: `bridge-${String(memoryIndex).padStart(2, '0')}`,
      from: relay.sourceIndex,
      to: relay.targetIndex,
      fromPoint: point(source.center),
      toPoint: point(target.center),
      bendPoint: {
        x: (source.center.x + target.center.x) / 2,
        y: clamp((source.center.y + target.center.y) / 2 + (memoryIndex % 2 ? 0.07 : -0.07), 0.10, 0.90)
      },
      visible: true,
      role: 'wrong-return',
      memoryIndex
    };
    bridges.push(bridge);
  }

  return { anchors: nextAnchors, links: [...nextLinks, ...bridges] };
}

function topologySignature(anchors, links) {
  return [
    anchors.map((anchor) => `${anchor.role[0]}:${anchor.center.x.toFixed(4)}:${anchor.center.y.toFixed(4)}`).join('|'),
    links.map((link) => `${link.id}:${link.from}>${link.to}:${link.visible ? '1' : '0'}:${link.role[0]}`).join('|')
  ].join('||');
}

export function buildFrame(stage, memory = []) {
  const boundedStage = clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const base = baseAnchors(boundedStage);
  const applied = applyMemory(base, makeBaseLinks(base, boundedStage), inherited);
  return {
    stage: boundedStage,
    grammar: 'misremembered-loop',
    anchors: applied.anchors,
    links: applied.links,
    memory: inherited,
    cutCount: applied.links.filter((link) => !link.visible && link.role === 'cut').length,
    bridgeCount: applied.links.filter((link) => link.visible && link.role === 'wrong-return').length,
    primitiveBudget: PRIMITIVE_BUDGET,
    topologySignature: topologySignature(applied.anchors, applied.links)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const pair = AUTO_RELAYS[((stage - 1) / 2) % AUTO_RELAYS.length];
      memory = [...memory, makeRelay(frame.anchors, stage, pair, 'timeline')].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyRelay(frame, pair) {
  const relay = makeRelay(frame.anchors, frame.stage, pair, 'visitor-relay');
  const priorMemory = copyMemory(frame.memory);
  const next = buildFrame(frame.stage, [...frame.memory, relay]);
  return { ...next, relay, priorMemory, interaction: 'visitor-relay' };
}

export function removeLatestRelay(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  if (!frame.memory.length) return buildFrame(frame.stage, []);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseRelay() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  return frame.topologySignature;
}
