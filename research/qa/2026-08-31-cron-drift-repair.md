---
type: cron-repair
job: Mutine — studio pulse
job_id: 2be5ced9caaf
date: 2026-08-31
status: repaired; immediate verification run pending
---

# Cron drift repair — 2026-08-31

## Failure observed

The 10:00 pulse was skipped before inference with:

`RuntimeError: [drift_skip] ... global inference config drifted ... (model 'gpt-5.6-terra' -> 'gpt-5.6-luna'), and this job is unpinned.`

No inference call was made. This was a scheduler safety stop, not artistic progress.

## Repair

The existing jobs were preserved and explicitly pinned with the Hermes CLI:

- `hermes cron edit 2be5ced9caaf --model gpt-5.6-luna --provider openai-codex`
- `hermes cron edit 3e9f126aa464 --model gpt-5.6-luna --provider openai-codex`

The scheduler then reported both jobs enabled, with their original cadence, continuity, workdir, and `origin` delivery intact.

## Verification boundary

An immediate bounded run was started after pinning. Its launch returned `executed: true`, `execution_mode: background`, and `model: gpt-5.6-luna` / `provider: openai-codex`. At the time of writing this record, completion had not yet been observed, so no new autonomous work or successful pulse is claimed here.

## Next falsifiable check

Read the completed execution output and scheduler status. Accept the repair only if the run exits without `drift_skip`, writes a factual note or verified bounded change, and delivers that note to the originating chat. If it fails for another reason, keep the cadence enabled but record the new blocker and do not multiply jobs.
