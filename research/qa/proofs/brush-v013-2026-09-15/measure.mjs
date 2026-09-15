import { buildTimeline, buildFrame, applyRemoval, removeLatestRemoval, SEED, STAGES, STROKE_COUNT, POINT_COUNT, MEMORY_LIMIT, PRIMITIVE_BUDGET } from '../../../../studies/p5-brush/v013/engine.mjs';

const timeline = buildTimeline();
const final = timeline.at(-1);
const plain = buildFrame(final.stage, []);
const visitor = applyRemoval(buildFrame(8, []), { x: .71, y: .44 });
const lifted = removeLatestRemoval(visitor);
const mean = (key) => final.strokes.reduce((sum, stroke) => sum + stroke[key], 0) / final.strokes.length;
const result = {
  visitorInput: true,
  seed: `0x${SEED.toString(16).toUpperCase()}`,
  stages: STAGES,
  strokesPerStage: STROKE_COUNT,
  pointsPerStroke: POINT_COUNT,
  primitiveBudget: PRIMITIVE_BUDGET,
  memoryWindow: MEMORY_LIMIT,
  finalMemory: final.memory.length,
  finalApproachStrokes: final.strokes.filter((stroke) => stroke.approachMass > 0).length,
  finalBridgeStrokes: final.strokes.filter((stroke) => stroke.bridgeMass > 0).length,
  finalReturnStrokes: final.strokes.filter((stroke) => stroke.returnMass > 0).length,
  finalGapStrokes: final.strokes.filter((stroke) => stroke.dryGap > .01).length,
  finalMeanApproachMass: mean('approachMass'),
  finalMeanBridgeMass: mean('bridgeMass'),
  finalMeanReturnMass: mean('returnMass'),
  finalMeanDryGap: mean('dryGap'),
  finalMeanWetLoad: mean('wetLoad'),
  finalMaxGapWidth: Math.max(...final.strokes.map((stroke) => stroke.gapWidth)),
  finalMaxReentryShift: Math.max(...final.strokes.map((stroke) => stroke.reentryShift)),
  finalRouteDeltaAgainstPlain: final.strokes.reduce((sum, stroke, index) => sum + Math.abs(stroke.routeShift - plain.strokes[index].routeShift), 0),
  visitorPoint: visitor.memory.at(-1).point,
  visitorGapWidth: Math.max(...visitor.strokes.map((stroke) => stroke.gapWidth)),
  visitorReentryShift: Math.max(...visitor.strokes.map((stroke) => stroke.reentryShift)),
  memoryRule: 'a remembered removal becomes a drying seam; wet routes approach both banks, leave a finite gap, and re-enter downstream with a quieter offset',
  interactionRule: 'a visitor seam changes bank, gap, re-entry, width, and wet load; lifting it restores the exact prior field',
  replay: JSON.stringify(lifted) === JSON.stringify({ ...buildFrame(8, []), interaction: 'dry-seam-lifted' }),
  renderer: 'deterministic Canvas 2D',
  measured: true,
  promotion: 'candidate / held pending browser matrix, production readback, and independent caption-free perceptual review'
};
console.log(JSON.stringify(result, null, 2));
