export const SEED = 0x42523532;
export const CELL_COUNT = 35;
export const CUT_LIMIT = 4;
export const ROWS = 5;
export const COLS = 7;

const TAU = Math.PI * 2;

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result ^= result + Math.imul(result ^ result >>> 7, 61 | result);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeBaseCells() {
  const random = createRng(SEED);
  const cells = [];
  const left = 0.11;
  const top = 0.13;
  const width = 0.78;
  const height = 0.72;
  const slotWidth = width / COLS;
  const slotHeight = height / ROWS;

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) {
      const index = row * COLS + column;
      const jitterX = (random() - 0.5) * slotWidth * 0.2;
      const jitterY = (random() - 0.5) * slotHeight * 0.2;
      const cellWidth = slotWidth * (0.84 + random() * 0.12);
      const cellHeight = slotHeight * (0.82 + random() * 0.14);
      cells.push({
        index,
        row,
        column,
        baseX: left + column * slotWidth + slotWidth * 0.5 + jitterX,
        baseY: top + row * slotHeight + slotHeight * 0.5 + jitterY,
        baseW: cellWidth,
        baseH: cellHeight,
        baseAngle: (random() - 0.5) * 0.16,
        baseSkew: (random() - 0.5) * 0.08,
        tone: index % 7,
        present: true,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        angle: 0,
        skew: 0
      });
    }
  }
  return cells;
}

const BASE_CELLS = makeBaseCells();

function pointFor(cell, x, y, w, h, angle, skew) {
  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const corners = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW * (1 + skew), halfH],
    [-halfW * (1 - skew), halfH]
  ];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return corners.map(([px, py]) => ({
    x: x + px * cos - py * sin,
    y: y + px * sin + py * cos
  }));
}

function rebuildCells(memory) {
  const cells = clone(BASE_CELLS);
  cells.forEach((cell) => {
    cell.x = cell.baseX;
    cell.y = cell.baseY;
    cell.w = cell.baseW;
    cell.h = cell.baseH;
    cell.angle = cell.baseAngle;
    cell.skew = cell.baseSkew;
  });

  memory.forEach((event, order) => {
    const cut = cells[event.index];
    if (!cut) return;
    cut.present = false;
    cut.x = event.x;
    cut.y = event.y;
    cut.w = 0;
    cut.h = 0;
    cut.points = [];

    cells.forEach((cell) => {
      if (!cell.present) return;
      const dx = event.x - cell.baseX;
      const dy = event.y - cell.baseY;
      const distance = Math.hypot(dx, dy);
      const influence = Math.pow(Math.max(0, 1 - distance / 0.72), 2);
      if (influence <= 0) return;
      const length = Math.max(0.001, distance);
      const direction = order % 2 === 0 ? 1 : -1;
      const pull = 0.065 + order * 0.012;
      const tangentX = -dy / length;
      const tangentY = dx / length;
      cell.x += (dx / length * pull + tangentX * 0.018 * direction) * influence;
      cell.y += (dy / length * pull + tangentY * 0.018 * direction) * influence;
      cell.w *= 1 + influence * (0.06 + order * 0.008) * direction;
      cell.h *= 1 - influence * (0.035 + order * 0.006) * direction;
      cell.angle += influence * (0.08 + order * 0.014) * direction;
      cell.skew += influence * 0.08 * direction;
    });
  });

  cells.forEach((cell) => {
    if (cell.present) cell.points = pointFor(cell, cell.x, cell.y, cell.w, cell.h, cell.angle, cell.skew);
  });
  return cells;
}

function frameFromMemory(memory, interaction = 'quiet substrate') {
  const safeMemory = clone(memory);
  const cells = rebuildCells(safeMemory);
  return {
    composition: 'vacancy-register',
    renderer: 'canvas-2d',
    seed: SEED,
    stage: safeMemory.length,
    interaction,
    selectedIndex: 7,
    memory: safeMemory,
    body: {
      cells,
      vacancyCount: safeMemory.length,
      substrate: 'compressed register'
    }
  };
}

export function buildFrame() {
  return frameFromMemory([]);
}

export function geometrySignature(field) {
  return JSON.stringify({
    memory: field.memory.map(({ index, order, x, y }) => ({ index, order, x, y })),
    cells: field.body.cells.map((cell) => ({
      index: cell.index,
      present: cell.present,
      x: Number(cell.x.toFixed(7)),
      y: Number(cell.y.toFixed(7)),
      w: Number(cell.w.toFixed(7)),
      h: Number(cell.h.toFixed(7)),
      angle: Number(cell.angle.toFixed(7)),
      skew: Number(cell.skew.toFixed(7))
    }))
  });
}

export function cutCell(field, index) {
  const current = clone(field);
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    current.interaction = 'refused / outside register';
    return { accepted: false, event: null, field: current };
  }
  if (current.memory.some((event) => event.index === index)) {
    current.interaction = 'refused / vacancy already cut';
    return { accepted: false, event: null, field: current };
  }
  if (current.memory.length >= CUT_LIMIT) {
    current.interaction = 'refused / register is full';
    return { accepted: false, event: null, field: current };
  }

  const base = BASE_CELLS[index];
  const event = {
    kind: 'vacancy-cut',
    index,
    order: current.memory.length,
    x: base.baseX,
    y: base.baseY
  };
  const memory = [...current.memory, event];
  return {
    accepted: true,
    event,
    field: frameFromMemory(memory, 'cut committed')
  };
}

export function liftLatest(field) {
  if (!field.memory.length) {
    return frameFromMemory([], 'lift refused / register is quiet');
  }
  return frameFromMemory(field.memory.slice(0, -1), 'lifted / exact');
}

export function releaseField() {
  return frameFromMemory([], 'quiet substrate');
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  let frame = timeline[0];
  for (const index of [7, 23, 10, 31]) {
    const result = cutCell(frame, index);
    if (!result.accepted) throw new Error(`Unable to build v052 timeline at cell ${index}`);
    frame = result.field;
    timeline.push(frame);
  }
  return timeline;
}
