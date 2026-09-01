import { STAGES, buildFrame, buildTimeline } from './engine.mjs';

export const STUDY_STAGE = 5;
export const DOOR_AMPLIFICATION = 3;
export const PATH_AMPLIFICATION = 2.6;
const DOOR_CLEARANCE = 0.042;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function recomposeScene(scene, anchor) {
  const left = anchor.houseX - anchor.houseWidth / 2 + DOOR_CLEARANCE;
  const right = anchor.houseX + anchor.houseWidth / 2 - DOOR_CLEARANCE;
  const door = clamp(
    anchor.door.x + (scene.door.x - anchor.door.x) * DOOR_AMPLIFICATION,
    left,
    right
  );
  const pathBend = clamp(
    anchor.pathBend + (scene.pathBend - anchor.pathBend) * PATH_AMPLIFICATION,
    0.12,
    0.88
  );
  return {
    ...scene,
    door: { ...scene.door, x: door },
    pathBend,
    decisionTrace: {
      ...scene.decisionTrace,
      doorGap: Math.abs(scene.door.x - door),
      pathGap: Math.abs(scene.pathBend - pathBend)
    }
  };
}

function freezeNonMemory(frame, anchor) {
  const structure = {
    houseX: anchor.houseX,
    houseY: anchor.houseY,
    houseWidth: anchor.houseWidth,
    houseHeight: anchor.houseHeight,
    sun: { ...anchor.sun },
    tree: { ...anchor.tree }
  };
  return {
    ...frame,
    draft: { ...frame.draft, ...structure },
    scene: { ...frame.scene, ...structure }
  };
}

export function buildRecomposedPair(stage = STUDY_STAGE) {
  const timeline = buildTimeline(STAGES);
  const intact = timeline[stage];
  if (!intact) throw new RangeError(`Study stage must be between 0 and ${STAGES - 1}`);
  const deletedSource = freezeNonMemory(buildFrame(stage, intact.memory.slice(0, -1)), intact.scene);
  const deleted = {
    ...deletedSource,
    scene: recomposeScene(deletedSource.scene, intact.scene)
  };
  return { intact, deleted };
}
