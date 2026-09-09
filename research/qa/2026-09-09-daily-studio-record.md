# Daily studio record - 2026-09-09

## Scope and stop conditions

Audit run at `2026-09-09 09:00:53 +0200` in `C:/Users/ASUS/autopoiesis`.
The only catalogue sources read were `studio/data/studio.json` and
`studio/data/works.json`. Field tests and stimuli were not treated as works.

Both registers parsed as valid JSON with schemas `mutine-studio/v2` and
`mutine-works/v1`. The studio register contains six currents; the works
register contains 31 records. There are no unknown `currentId` values, no work
record contains `fieldTests`, and `studio/data/stimuli.json` remains a separate
file.

A lifecycle/schema conformance anomaly remains in seven historical records:
their `lifecycle` field is absent/null rather than `active` or `complete`. The
lifecycle audit is held for those records and is not reported as a pass. No
missing tableau, raw-path failure, journal mismatch, or duplicate current/date
slot was found.

No auth, throttling, challenge, or network retrieval was used or encountered.

## Today's coverage — 2026-09-09

| Current | Record in today's slot | Status / lifecycle | Tableau |
|---|---|---|---|
| Handwriting (`typography`) | `typography-2026-09-09` | `candidate / held` / `active` | `/studies/handwriting/v005/` |
| Self portrait (`portrait`) | `portrait-2026-09-09` | `candidate / held` / `active` | `/studies/self-portrait/v005/` |
| Pure SVG (`svg`) | none | held / no record | — |
| Brush (`brush`) | none | held / no record | — |
| Naive art (`naive`) | none | held / no record | — |
| WebGPU (`webgpu`) | none | held / no record; current is `dormant` | — |

Today's two real records are explicitly held candidates. Four current/date
slots have no work record; no catalogue entry was invented for them. No current
has more than one record for today's date.

Across all 31 records, occupied date counts by current are: Handwriting 5,
Self portrait 5, Pure SVG 6, Brush 6, Naive art 5, and WebGPU 4. The parsed
`currentId/date` key set has 31 entries for 31 records: duplicate check **pass**.

## Catalogue and route evidence

The following repository checks were run against every one of the 31 records:

- Canonical page `works/<id>/index.html`: **31/31 present**.
- Canonical data marker `data-catalog-work-detail="<id>"`: **31/31 present**.
- Raw tableau `studies/<rawPath>/index.html`: **31/31 present**.
- Every `rawPath` starts under `/studies/`: **31/31 pass**.
- Journal record anchor `journal-<workId>`: **31/31 exact matches**.
- Canonical page link to `/journal/#journal-<workId>`: **31/31 present**.
- Journal renderer emits the recorded anchor and `#journal` relation: **pass** in
  `studio/catalog.js`.
- Critique or explicit no-critique hold: **31/31 pass**; every record has 3 or
  4 critique entries, and no explicit no-critique hold was needed.
- Lifecycle: **24 `active`, 0 `complete`, 7 null/missing**. The seven null
  values are nonconforming and are listed below.

Nonconforming lifecycle records:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

Complete-work mutation check: **N/A / no complete records are present in the
active register**. A repository history search also found no explicit complete
lifecycle record in `studio/data/works.json`. There is therefore no complete
record set against which to verify immutability; this is not evidence that an
unregistered or previously complete work was unchanged.

## Automated verification evidence

- `npm run test`: **PASS — 157/157 tests, 0 failed, 0 skipped, 0 todo**.
- JSON register parsing: **PASS** for both active catalogue files.
- Changed JavaScript syntax: **not applicable** — Git reported no changed or
  staged `.js`, `.mjs`, or `.cjs` files, so there was no changed JavaScript file
  to pass to `node --check`.
- `git diff --check`: **PASS** — no whitespace errors.
- Initial Git status: clean; no commit, push, or deployment was performed.

## Browser, visual, and interaction gate

No browser automation, CUA, Chrome, DevTools, CDP, GUI, or remote debugging was
used. Consequently, this unattended run obtained no fresh browser evidence for
the two 2026-09-09 tableaus. The following gates remain blocked/held rather
than inferred from source or tests:

- canonical rendered appearance and tableau-before-prose ordering;
- pointer and keyboard interaction state changes and reversibility;
- `320x568`, `390x844`, `768x1024`, `1280x800`, and `1920x1080` viewport checks;
- reduced-motion rendering;
- browser console and network-failure probes;
- independent caption-free perceptual critique.

Existing `metrics.browserEvidence` fields were not treated as fresh evidence
for this run. This audit made no browser claim.

## Gaps and next actions

1. Fill or explicitly leave held the four unrecorded 2026-09-09 slots according
   to the studio cadence; do not treat an empty slot as a work.
2. Add a valid `lifecycle` value (`active` or `complete`) to the seven listed
   historical records, or document a schema migration that defines their
   status, then rerun the lifecycle audit.
3. Preserve the two 2026-09-09 records as held until browser, responsive,
   reduced-motion, and independent caption-free perceptual gates have real
   evidence.
4. If any work is later marked `complete`, record its baseline and verify that
   subsequent catalogue or generated-page changes do not mutate its canonical
   content.

## Archive decision

**Record the audit; do not promote either today's candidate.** Catalogue
parsing, current/date uniqueness, canonical pages, raw tableaus, Journal
relations, critique coverage, tests, and whitespace checks are green. Today's
coverage is incomplete, seven historical lifecycle fields are nonconforming,
and all visual/interaction acceptance gates are held because this unattended
run cannot honestly obtain browser evidence.
