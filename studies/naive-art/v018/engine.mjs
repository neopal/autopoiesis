export const SEED = 0x4e413138;
export const STAGES = 17;
export const PRIMITIVE_BUDGET = 31;
export const MEMORY_WINDOW = 4;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const PANEL_LAYOUT = [
  { id: 'leaf-01', x: 0.22, y: 0.30, w: 0.22, h: 0.34, color: '#f3c85b', motif: 'sun' },
  { id: 'leaf-02', x: 0.41, y: 0.22, w: 0.22, h: 0.40, color: '#e26d5a', motif: 'ladder' },
  { id: 'leaf-03', x: 0.60, y: 0.29, w: 0.20, h: 0.35, color: '#7ea89b', motif: 'knot' },
  { id: 'leaf-04', x: 0.27, y: 0.58, w: 0.22, h: 0.25, color: '#a88ab7', motif: 'cup' },
  { id: 'leaf-05', x: 0.47, y: 0.62, w: 0.22, h: 0.24, color: '#5d91aa', motif: 'eyelet' },
  { id: 'leaf-06', x: 0.67, y: 0.56, w: 0.17, h: 0.26, color: '#d8a36b', motif: 'slash' }
];

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
    start: event.start ? copyPoint(event.start) : null,
    end: event.end ? copyPoint(event.end) : null,
    sourceIndex: Number(event.sourceIndex),
    receiverIndex: Number(event.receiverIndex),
    jointIndex: Number(event.jointIndex),
    wrongJointIndex: Number(event.wrongJointIndex),
    distance: Number(event.distance),
    tilt: Number(event.tilt),
    offset: Number(event.offset)
  };
}

function copyPanel(panel) {
  return {
    ...panel,
    angle: Number(panel.angle),
    drift: Number(panel.drift),
    fold: Number(panel.fold),
    shift: { ...panel.shift },
    borrowedMarks: (panel.borrowedMarks ?? []).map((mark) => ({ ...mark })),
    seams: (panel.seams ?? []).map((seam) => ({ ...seam }))
  };
}

function copyJoint(joint) {
  return { ...joint, gap: Number(joint.gap), bridge: Number(joint.bridge), twist: Number(joint.twist) };
}

function nearestPanel(point) {
  return PANEL_LAYOUT.reduce((closest, panel, index) => {
    const distance = Math.hypot(point.x - panel.x, point.y - panel.y);
    return distance < closest.distance ? { index, distance } : closest;
  }, { index: 0, distance: Infinity }).index;
}

function basePanels(random) {
  return PANEL_LAYOUT.map((panel, index) => ({
    ...panel,
    angle: (index % 2 ? -1 : 1) * (0.05 + random() * 0.10),
    drift: 0,
    fold: 0.08 + random() * 0.08,
    shift: { x: (random() - 0.5) * 0.014, y: (random() - 0.5) * 0.014 },
    borrowedMarks: [],
    seams: [{ kind: panel.motif, offset: (random() - 0.5) * 0.12 }]
  }));
}

function baseJoints() {
  return PANEL_LAYOUT.slice(0, -1).map((panel, index) => ({
    id: `hinge-${index + 1}`,
    a: index,
    b: index + 1,
    state: 'true-hinge',
    gap: 0,
    bridge: 0,
    twist: 0
  }));
}

function eventForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const start = { x: 0.19 + random() * 0.57, y: 0.25 + random() * 0.47 };
  const end = { x: 0.28 + random() * 0.55, y: 0.29 + random() * 0.44 };
  const sourceIndex = nearestPanel(start);
  let receiverIndex = (sourceIndex + 2 + Math.floor(random() * 3)) % PANEL_LAYOUT.length;
  if (receiverIndex === sourceIndex) receiverIndex = (receiverIndex + 1) % PANEL_LAYOUT.length;
  const jointIndex = Math.min(sourceIndex, PANEL_LAYOUT.length - 2);
  let wrongJointIndex = Math.min(receiverIndex, PANEL_LAYOUT.length - 2);
  if (wrongJointIndex === jointIndex) wrongJointIndex = (wrongJointIndex + 2) % (PANEL_LAYOUT.length - 1);
  return {
    stage,
    source: 'autonomous-fold',
    start,
    end,
    sourceIndex,
    receiverIndex,
    jointIndex,
    wrongJointIndex,
    distance: Math.hypot(end.x - start.x, end.y - start.y),
    tilt: (random() - 0.5) * 1.1,
    offset: (random() - 0.5) * 0.9,
    reason: 'the sculpture remembered the wrong neighbour'
  };
}

function composeScene(events, random) {
  const panels = basePanels(random);
  const joints = baseJoints();
  const foldRecords = [];

  for (const [order, event] of events.entries()) {
    const source = panels[event.sourceIndex];
    const receiver = panels[event.receiverIndex];
    const severed = joints[event.jointIndex];
    const wrong = joints[event.wrongJointIndex];
    const impulse = 0.08 + event.distance * 0.10 + order * 0.012;

    source.drift += impulse;
    source.angle += event.tilt * 0.22;
    source.fold += impulse * 0.45;
    source.shift.x += event.offset * 0.014;
    source.shift.y -= impulse * 0.018;
    source.seams.push({ kind: 'misremembered-edge', offset: event.offset * 0.20 });

    receiver.drift += impulse * 0.42;
    receiver.angle -= event.tilt * 0.16;
    receiver.fold -= impulse * 0.22;
    receiver.borrowedMarks.push({
      from: source.motif,
      color: source.color,
      offset: event.offset * 0.18,
      rotation: event.tilt * 0.32,
      order
    });

    severed.state = 'unhinged';
    severed.gap += 0.032 + impulse * 0.16;
    severed.twist += event.tilt * 0.20;

    wrong.state = 'wrong-hinge';
    wrong.bridge += 0.040 + impulse * 0.13;
    wrong.twist -= event.offset * 0.16;

    foldRecords.push({ ...copyEvent(event), order });
  }

  return {
    foldRecords,
    panels,
    joints,
    materialTrace: {
      foldCount: events.length,
      pointerOnlyChanges: 0,
      dragChanges: events.length * 5,
      unhingedCount: joints.filter((joint) => joint.state === 'unhinged').length,
      wrongHingeCount: joints.filter((joint) => joint.state === 'wrong-hinge').length,
      grammar: 'drag → wrong neighbour → true hinge opens → false hinge carries the remembered direction'
    }
  };
}

export function foldSignature(frame) {
  return [
    ...frame.scene.panels.map((panel) => [
      panel.id,
      Number(panel.angle).toFixed(4),
      Number(panel.drift).toFixed(4),
      Number(panel.fold).toFixed(4),
      Number(panel.shift.x).toFixed(4),
      Number(panel.shift.y).toFixed(4),
      ...panel.borrowedMarks.map((mark) => `borrowed:${mark.from}:${Number(mark.offset).toFixed(4)}`)
    ].join('|')),
    ...frame.scene.joints.map((joint) => [joint.id, joint.state, Number(joint.gap).toFixed(4), Number(joint.bridge).toFixed(4), Number(joint.twist).toFixed(4)].join('|'))
  ].join('||');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent) : [];
  return {
    stage: safeStage,
    memory: inherited,
    correction: eventForStage(safeStage),
    primitiveCount: PRIMITIVE_BUDGET,
    draft: { panels: PANEL_LAYOUT.map((panel) => ({ ...panel })), joints: baseJoints() },
    scene: composeScene(inherited.slice(-MEMORY_WINDOW), random)
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

export function applyFold(frame, gesture) {
  const start = {
    x: clamp(Number.isFinite(Number(gesture?.start?.x)) ? Number(gesture.start.x) : 0.45, 0.10, 0.90),
    y: clamp(Number.isFinite(Number(gesture?.start?.y)) ? Number(gesture.start.y) : 0.45, 0.16, 0.86)
  };
  const end = {
    x: clamp(Number.isFinite(Number(gesture?.end?.x)) ? Number(gesture.end.x) : 0.75, 0.10, 0.90),
    y: clamp(Number.isFinite(Number(gesture?.end?.y)) ? Number(gesture.end.y) : 0.52, 0.16, 0.86)
  };
  const computedDistance = Math.hypot(end.x - start.x, end.y - start.y);
  const distance = Math.max(computedDistance, Number.isFinite(Number(gesture?.distance)) ? Number(gesture.distance) : 0);
  const random = rng(SEED + frame.stage * 97 + frame.memory.length * 131);
  const sourceIndex = nearestPanel(start);
  let receiverIndex = nearestPanel(end);
  if (receiverIndex === sourceIndex) receiverIndex = (sourceIndex + 3) % PANEL_LAYOUT.length;
  const jointIndex = Math.min(sourceIndex, PANEL_LAYOUT.length - 2);
  let wrongJointIndex = Math.min(receiverIndex, PANEL_LAYOUT.length - 2);
  if (wrongJointIndex === jointIndex) wrongJointIndex = (wrongJointIndex + 2) % (PANEL_LAYOUT.length - 1);
  const event = {
    stage: frame.stage,
    source: 'visitor-drag',
    start,
    end,
    sourceIndex,
    receiverIndex,
    jointIndex,
    wrongJointIndex,
    distance,
    tilt: (end.y - start.y) * 1.8 + (random() - 0.5) * 0.14,
    offset: (end.x - start.x) * 1.2,
    reason: 'the sculpture remembered the wrong neighbour'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, event]), interaction: 'visitor-drag' };
}

export function deleteLatestFold(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'fold-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'fold-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    field: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }
  };
}
