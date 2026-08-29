# Mutine — Intent-First Design Process Plan

> **For Hermes:** Execute only with a fresh role packet per task. No public visual change until the intent gate and independent critique pass.

**Goal:** Make `DESIGN.md` the downstream expression of an earned artistic intention, not a decorative token file, and make every site/work change prove that it follows that intention.

**Architecture:** Introduce a three-document chain: `ART-DIRECTION.md` (why this period/site exists), `DESIGN.md` (visual/interaction constraints derived from it), and a per-change `brief.md` (what specific formal tension is being tested). Gate design implementation behind a written surface decision, an anti-slop diagnosis, and comparative spikes. The gallery remains an Explore/Inspect surface, but its composition must be re-earned from the selected work rather than treated as a permanent brand shell.

**Tech stack:** Static HTML/CSS/JS, Node tests, Chrome/CDP browser QA, `DESIGN.md` lint, Hermes role packets, Git/Vercel.

---

## Diagnosis

Current `DESIGN.md` successfully defines colors, type, sharp controls, and compatibility rules. It does **not yet state a singular visual intention with enough force to decide between two good layouts or reject a beautiful but wrong one.** Tokens are being used before the studio has selected its governing conflict.

The next system must therefore answer, before a mockup or a CSS token is written:

1. What encounter must the visitor have in the first 12 seconds?
2. What must be withheld until after the artwork has acted on them?
3. What formal danger is the interface permitted to introduce?
4. Which visual effects are forbidden because they make the work safe, pretty, or legible too early?
5. What visible event would prove the site has changed because the artist changed, rather than because a layout was refreshed?

## Task 1: Write an art-direction charter before touching design tokens

**Objective:** Establish a falsifiable, work-led direction for the next gallery iteration.

**Files:**
- Create: `ART-DIRECTION.md`
- Source: `CONSTITUTION.md`, `EVALUATION.md`, `research/qa/2026-08-28-live-exhibition-audit.md`, the selected spike README

**Required content:**
- One sentence naming the public encounter.
- One governing tension; e.g. *the image must be a consequence before it is an explanation*.
- Three compositional laws and three refusal laws.
- A list of “easy beauty” failure modes specific to Mutine.
- An anti-slop score for the current gallery, with cause-level repair, not recolouring.
- A falsifier: evidence that would prove this direction is just a new shell.

**Verification:** Formalist + hostile critic read the charter and independently answer whether it could reject a proposed page. If it cannot reject anything, rewrite it.

## Task 2: Select one work-led source of gravity

**Objective:** Decide whether the next gallery is governed by `Subtractive Ecology`, `Disobedient Writing`, or neither.

**Files:**
- Read: `spikes/001-subtractive-ecology/README.md`
- Read: `spikes/002-disobedient-writing/README.md`
- Create: `brain/Selection — first fracture.md`

**Method:**
- Artist writes the formal necessity each spike gains.
- Historian names an actual lineage/tension, without style borrowing.
- Cynic tries to classify it as “pleasant browser generative art.”
- A spike advances only when the cynic’s classification is materially defeated by its rule.

**Decision:** `advance`, `hold`, `merge`, or `kill`; no “both are promising.”

**Verification:** Run the chosen spike without its explanatory prose. Record whether the key causal rule remains visible.

## Task 3: Derive DESIGN.md from the charter

**Objective:** Make tokens and components consequences of the selected direction.

**Files:**
- Modify: `DESIGN.md`
- Create: `design/intent-to-system.md`

**Rules:**
- Every non-neutral token must cite an action in the work (not an aesthetic adjective).
- Every component must answer a visitor need: enter, intervene, inspect consequence, leave.
- Delete components that only frame, badge, decorate, or explain.
- State primary surface as one of Explore, Inspect, or an intentional new hybrid; explain why other surface archetypes are rejected.
- Maintain the 320/390/768/1280/1920 compatibility contract.

**Verification:** Run `npx -y -p @google/design.md designmd lint DESIGN.md`; require zero errors/warnings. The experience director must map every visible component in the prototype to an intent-to-system row.

## Task 4: Build three genuinely different throwaway gallery compositions

**Objective:** Test composition before production implementation.

**Files:**
- Create: `spikes/003-gallery-conservative/`
- Create: `spikes/004-gallery-strong-fit/`
- Create: `spikes/005-gallery-divergent/`

**Directions:**
1. **Conservative:** a quiet entry that sacrifices metadata for first encounter.
2. **Strong-fit:** artwork and consequence share a field; source/critique occur only after an irreversible event.
3. **Divergent:** the studio has no default gallery view; it resumes from an unresolved previous state.

**Hard constraints:** No cards, marketing hero, product dashboard, default gradients, fake stats, icon tiles, or copied proprietary patterns. Do not vary only color/type.

**Verification:** Each direction must be rendered at 390px and 1920px with an explicit 12-second encounter test. The critic must say which direction fails first and why. Delete at least two.

## Task 5: Implement only the selected composition through TDD

**Objective:** Replace the current root surface with the chosen direction, not layer another feature onto it.

**Files likely to change:**
- `galerie/index.html`
- `galerie/field.css`
- `galerie/field.js`
- `tests/evolution-catalog.test.mjs`
- Create: `tests/viewport-contract.mjs` when browser-runner support is available

**Steps:**
1. Write a behavioural regression test for the chosen entry/inspection path.
2. Observe RED.
3. Implement one vertical slice only.
4. Run all Node tests and syntax checks.
5. Run browser matrix at 320×568, 390×844, 768×1024, 1280×800, 1920×1080.
6. Obtain independent QA + art-direction review.
7. Commit only after both approve.

## Task 6: Promote one spike to v002—or document refusal

**Objective:** Turn the selection into a work only if its rule survives an observed encounter.

**Files likely to change:**
- `chantiers/<selected>/v002/`
- `galerie/data/evolutions.json`
- `galerie/data/studio.json`
- `brain/Hypotheses — active ledger.md`
- `brain/Studio self-review — YYYY-MM-DD.md`

**Acceptance evidence:**
- Seeded reproducible state.
- A 90-second run whose core rule is legible without page explanation.
- Three critiques anchored to that run.
- One accepted critique produces a visible v002 consequence.
- Mobile/desktop matrix passes.
- No period is named until the rule has a second connected version.

## Risks and stop conditions

- If all three gallery directions still feel like a presentation shell, stop implementation and rewrite `ART-DIRECTION.md`.
- If the chosen spike’s rule requires text to be understood, it remains a spike.
- If compatibility fixes force the work into generic responsive UI, redesign the interaction rather than reducing art to controls.
- If no candidate is strong enough, the correct output is deletion/archival—not a v002.
