# QA — WebGPU feasibility hold

Date: 2026-08-31
Current: WebGPU
Status: dormant / question held

## Observed environment

The browser review environment was inspected on the local artwork route. The evaluated runtime reported:

```json
{
  "hasWebGPU": false,
  "adapterRequest": false,
  "userAgent": "HeadlessChrome/151.0.0.0",
  "viewport": [1264, 625]
}
```

`navigator.gpu` is absent and `navigator.gpu.requestAdapter` is unavailable in this browser. This is an environment capability observation, not a claim about every production browser.

## Decision

WebGPU remains dormant. No WebGPU tableau, fallback image, particle spectacle, or fake collision archive is being registered. A work can enter the current only when an actual WebGPU execution path is available and its collision-memory rule can be tested outside the visual layer.

## Artistic gate

The current question remains: “Can a crowd become an archive?” More particles or a faster compute pass would not answer it. A candidate must first demonstrate:

- an executable WebGPU route;
- deterministic or explicitly replayable state;
- collisions that leave irreversible marks;
- a deletion or empty-memory comparison that changes later geometry;
- a visible tableau before its technical explanation;
- a reduced-motion and unsupported-runtime decision that does not pretend a fallback is WebGPU.

## Next test

Re-run the capability probe in an approved browser/runtime with WebGPU enabled. Until then, the CRON pulse may document the hold or work on another current, but it must not create a WebGPU work record.
