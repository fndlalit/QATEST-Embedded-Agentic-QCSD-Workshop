# Workshop Lab: Copy-Paste Exercises

Six steps on a deliberately flawed ECU firmware update module: **build a local knowledge graph (0) → Ideation (1) → Refinement (2) → Development (3) → Verification (4) → Self-Learning (5)**, then **PACTS scoring** and a **Personal Adoption Roadmap**. The exercises build on each other (Refinement feeds Development, Verification judges the result) and each one ends by saving its learnings. Exercise 5 turns those into a handoff brief. There is one optional stretch exercise for fast finishers.

No hardware is needed. The ECU is simulated in software and everything runs on your laptop.

**Pick your prompt. Exercises 1 to 4 have two versions:**
- **Claude Code users**: AQE skills and AI agents (`/qcsd-ideation-swarm`, `qe-product-factors-assessor`, `qe-test-architect`, `qe-queen-coordinator`).
- **Other tools** (Copilot, Codex, Cursor, Kiro and others): the same work as a plain step list through the AQE MCP tools.

Both write to the same report and end with **"Save learnings and persist patterns."** Exercise 0 is three terminal commands and Exercise 5 is one prompt, so both are identical on every tool.

**Measured run times** (one unattended run on 11 October 2026, agentic-qe 3.15.2, Claude Code; interactive runs take longer because you approve tool calls):

| Exercise | Run time | Model cost | Result in that run |
|----------|----------|------------|--------------------|
| 1 · Ideation | 4 min 40 s | 1.60 USD | CONDITIONAL, 8 contradictions between the three requirements files |
| 2 · Refinement | 3 min 34 s | 0.55 USD | 86 test ideas across the seven factors, 13 requirement conflicts |
| 3 · Development | 4 min 7 s | 0.76 USD | 53 new tests, all runnable, 4 of them `it.fails` tests that record a defect |
| 4 · Verification | 2 min 44 s | 0.58 USD | NO-GO: 3 of 10 safety scenarios have a test |
| 5 · Self-Learning | 1 min 1 s | 0.32 USD | 4 records recalled, one per exercise |
| Stretch | 3 min 42 s | 0.66 USD | `update-manager.ts` ranked first, `block-transfer.ts` second |

Your results will differ in detail. AI agents do not give the same answer twice.

**Before you start:** finish the [README](./README.md) Setup (Node 22.13+ → clone → `npm install -g agentic-qe@latest` → `aqe init --auto --with-<your-tool>` → `npm install` → `aqe code index src/` → `npm install -g @huggingface/transformers@4.2.0`), then launch your coding agent in this folder. **Do not skip `aqe init`** (it installs the AI agents, the MCP configuration and the memory database) and **run the exercises in order** (3 reads what 2 wrote, 4 judges what 3 added, 5 recalls what 1 to 4 saved). Paths are relative to the repo root.

---

## Exercise 0: Warm-up, build the local knowledge graph (about 2 min)

> *Phase:* Setup · *Why:* before the AI agents reason about your code, give them a **map**. This runs entirely on your machine: static analysis plus a local embedding model, **no API key, no tokens**. Do it in your **terminal**, not through your coding agent.

```bash
aqe code index src/
aqe hg stats
aqe memory usage
```

**What you should see**

| Command | Expected on this repo |
|---------|----------------------|
| `aqe code index src/` | `Files indexed: 12` · `Nodes created: 86` · `Edges created: 90` · a few seconds |
| `aqe hg stats` | 96 nodes / 161 edges (function 49, module 25, file 13, test 9) |
| `aqe memory usage` | Entries 12 · Vectors 86 · Namespaces 1 |

The index and `hg stats` counts differ because they count different things: the indexer reports what it just created, `hg stats` reports every node type in the persisted graph, including the test files that `aqe init` found. Measured on 11 October 2026 with agentic-qe 3.15.2.

> *Heads-up:* if you have an LLM provider configured for AQE, indexing also runs an optional relationship-extraction pass that calls the model **once per file**. On this repo that is 12 calls. To avoid them, run the index before you export any provider key. Lines reading `LLM relationship extraction failed` mean that pass was skipped. The graph is still complete.

**Optional: watch the subject under test run.** `npm run simulate` runs one firmware update against the simulated ECU. `npm run simulate -- --lossy` does the same on a link that loses one response in three. Both runs are repeatable.

| Run | `phase` | `retries` | `image size` | `flash writes` |
|-----|---------|-----------|--------------|----------------|
| `npm run simulate` | committed | 0 | 16384 bytes | 16 blocks, 16384 bytes |
| `npm run simulate -- --lossy` | committed | 7 | 16384 bytes | 23 blocks, 23552 bytes |

On the lossy link the update still reports `committed`, but 23 blocks were written to flash for a 16-block image. Keep that in mind for Exercise 3.

---

## Exercise 1: Ideation, gate the epic before any code

> *Phase:* Ideation · *Why:* apply the QE ideation lenses to the epic and give a readiness verdict *before a line of firmware is written*.

> *Why the two extra lines:* left alone, the swarm's security auditor runs at maximum effort and can spend 30 minutes and dozens of web fetches. Scoped to the files and without the security audit, the swarm finishes inside the session and still produces a GO / CONDITIONAL / NO-GO verdict.

**▸ Claude Code users.** `qcsd-ideation-swarm` is installed as a **skill**, so if your Claude Code build does not offer it after a slash, ask for it by name ("Use the qcsd-ideation-swarm skill to ..."):

```
/qcsd-ideation-swarm

Analyze the OTA firmware update epic in requirements/epic-ota-update.md,
using requirements/user-stories.md and
requirements/acceptance-criteria.md for context.
This is embedded automotive software (ASIL B, UDS over CAN) with no
user interface. Work from these files only, with no web research.
Skip the security audit: Exercise 4 covers security.
Save all reports under reports/01-ideation-swarm/.
Save learnings and persist patterns.
```

**▸ Other tools.** The same assessment as explicit steps:

```
Assess the OTA firmware update epic before any code is written. Read
requirements/epic-ota-update.md (with requirements/user-stories.md and
requirements/acceptance-criteria.md for context). This is embedded
automotive software (ASIL B, UDS over CAN) with no user interface. Work
from these files only, with no web research. Then:

1. Recommend the quality criteria that matter most (HTSM: capability,
   reliability, security, performance, compatibility, ...)
2. Identify the top risks and score each by likelihood x impact
3. Validate requirements completeness and testability: flag gaps,
   contradictions between epic, stories and criteria, timing budgets
   that cannot all hold, and acceptance criteria that cannot be measured
4. List the safety-tagged requirements that have no acceptance criterion
5. Give a single GO / CONDITIONAL / NO-GO verdict with the top blockers
6. Save the assessment to reports/01-ideation-assessment.md
7. Save learnings and persist patterns
```

> *Your part:* before you read the report, read the epic yourself and write down the verdict you would give.

---

## Exercise 2: Refinement, product factors on the update function

> *Phase:* Refinement · *Why:* break the product into its real elements (SFDIPOT) and turn them into prioritised test ideas, which Exercise 3 will use. For embedded software, expect Time, Interfaces and Platform to carry most of the risk.

**▸ Claude Code users.** The product-factors AI agent:

```
Use qe-product-factors-assessor to analyse the BCM-7 OTA firmware update
from requirements/epic-ota-update.md and requirements/user-stories.md.
Produce a product-factors (SFDIPOT) assessment and save it to
reports/02-refinement-product-factors.md.
Save learnings and persist patterns.
```

**▸ Other tools.** The same assessment as explicit steps:

```
Break the BCM-7 OTA firmware update into its product factors before
reasoning about coverage. Read requirements/epic-ota-update.md and
requirements/user-stories.md, then analyse the product across the
SFDIPOT dimensions:

  Structure, Function, Data, Interfaces, Platform, Operations, Time.

Then:
1. For each dimension, note what the requirements imply and produce
   prioritised test ideas
2. Save the assessment to reports/02-refinement-product-factors.md
3. Save learnings and persist patterns
```

> *Your part:* which factor would you have ranked first for an ECU update, and did the AI agent agree?

---

## Exercise 3: Development, tests for the riskiest module

> *Phase:* Development · *Why:* turn Exercise 2's test ideas into real, runnable tests for the block transfer logic, including property-based tests for its timing and sequence invariants.

**▸ Claude Code users.** The test architect:

```
Use qe-test-architect to generate a comprehensive test file for the
block transfer logic in src/lib/block-transfer.ts. Use the test ideas in
reports/02-refinement-product-factors.md as input, and include
property-based tests for the module's invariants (retry timing bounds,
attempt counts, block sequence handling).
Save the test file as tests/lib/block-transfer.architect.test.ts and a
short rationale to reports/03-development-tests.md.
Save learnings and persist patterns.
```

**▸ Other tools.** The same as explicit steps:

```
Generate tests for the block transfer logic in src/lib/block-transfer.ts:

1. Read reports/02-refinement-product-factors.md and src/lib/block-transfer.ts
2. Write a comprehensive vitest test file covering the happy path, edge
   cases, error paths, and the module's invariants. Use property-based
   tests with fast-check where useful (retry timing bounds, attempt
   counts, block sequence handling)
3. Make sure the file imports from src/lib/block-transfer.ts and runs
4. Save the test file as tests/lib/block-transfer.architect.test.ts and a
   short rationale to reports/03-development-tests.md
5. Save learnings and persist patterns
```

> *Tip:* after this runs, `npm test -- --run tests/lib/block-transfer.architect.test.ts` shows the generated tests execute. A failing or expected-failure test is a finding: decide whether the test or the code is wrong.

---

## Exercise 4: Verification, trace, gate and decide on release

> *Phase:* Verification · *Why:* generate nothing new. *Measure, scan, trace, gate and recommend.* For safety-related software a coverage number is not enough: every safety requirement needs a test you can point to.

**▸ Claude Code users.** The queen coordinator orchestrates the verification fleet:

```
Use qe-queen-coordinator to run a verification-only quality assessment of
src/lib/block-transfer.ts (do NOT generate tests). Analyse coverage gaps
with risk scoring and security-scan the module. Build a traceability
matrix from the [SAFETY] acceptance criteria in
requirements/acceptance-criteria.md to the existing tests in tests/, and
list every safety criterion with no test. Apply a 90% quality gate and
give a GO / CONDITIONAL / NO-GO release recommendation with the top
blockers.
Save the consolidated report to reports/04-verification-assessment.md.
Save learnings and persist patterns.
```

**▸ Other tools.** The same as explicit steps:

```
Run a verification-only quality assessment of src/lib/block-transfer.ts
and decide on release. Do NOT generate tests. Assess what exists:

1. Run npm run test:coverage and analyse coverage gaps with risk scoring
2. Review the module for security issues
3. Build a traceability matrix from the [SAFETY] acceptance criteria in
   requirements/acceptance-criteria.md to the existing tests in tests/,
   and list every safety criterion with no test
4. Apply a quality gate at a 90% threshold
5. Give a release recommendation (GO / CONDITIONAL / NO-GO) with the top
   blockers, if any
6. Save the consolidated report to reports/04-verification-assessment.md
7. Save learnings and persist patterns
```

> *Expected coverage:* `npm run test:coverage` reports 79.69% of statements overall, and 92.85% of statements and 97.14% of branches for `block-transfer.ts`, before Exercise 3 adds tests. Coverage alone clears 90% on this module. Read the report anyway and compare the verdict with the coverage figure.

---

## Exercise 5: Self-Learning, put the memory to work (about 10 min)

> *Why:* every exercise above ended with **"Save learnings and persist patterns."** Now the AI agents hand those learnings back, consolidated. Same prompt for every tool.

```
Recall from AQE memory what the fleet learned about this ECU firmware
update module across Exercises 1 to 4: block transfer and retry, image
verification, security access, and requirement contradictions.

First list what you recalled: each pattern's name and one line on what it
says. Then consolidate that into a one-page brief (top risks, testability
gaps, contradictions, untraced safety requirements and the release
verdict) framed as either:
  - an onboarding brief for someone joining the project today, or
  - a handoff document for the next person changing the update module.

Where memory returns nothing for a topic, take it from reports/01 to 04
and label that part REPORTS-BASED.

Save the brief to reports/05-handoff-brief.md.
```

> *Read the list before the brief.* It should name this codebase: `block-transfer.ts`, `update-manager.ts`, the epic. A list of generic testing patterns means the recall went wide, because the store also holds AQE's own foundational patterns. Run it again naming the module you care about.

> *What to expect:* in our run on 11 October 2026 the recall returned four records, one per exercise: the Ideation verdict, the product-factors learnings, the test-generation pattern for `block-transfer.ts` and the Verification verdict. Image verification and security access had no record of their own, so those parts of the brief were labelled REPORTS-BASED.

> *What you will see along the way:* lines mentioning `brain.rvf` or `VECTOR_SPACE_UNVERIFIED`. Both are expected. The optional vector index is skipped and AQE falls back to SQLite, which is the authoritative store.

> *If nothing comes back:* run `aqe learning stats`. If it reads `Total: 0`, setup step 5 (the embedder) was skipped, so nothing was persisted. Install it, then build the brief from your reports: *"Read reports/01 through reports/04 and write the same one-page brief to reports/05-handoff-brief.md, labelled REPORTS-BASED."* A brief built from reports is a valid result. Say so in the brief. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detail.

---

## Stretch exercise: defect risk profile (about 10 min)

> For fast finishers, any time after Exercise 2. *Why:* before writing tests, decide where they pay off.

**▸ Claude Code users:**

```
Use qe-defect-predictor to build a defect risk profile for every
module in src/lib/ and src/ota/ from complexity, coupling and coverage
(npm run test:coverage). Rank the modules, give the top three risk
factors for each with its evidence class (EXECUTED, STATIC or INFERRED),
and say whether src/lib/block-transfer.ts belongs at the top of the
list, and why.
Save to reports/stretch-defect-risk-profile.md.
Save learnings and persist patterns.
```

**▸ Other tools:**

```
Build a defect risk profile for the ECU update module:

1. Run npm run test:coverage and read the per-file coverage
2. For every module in src/lib/ and src/ota/, assess complexity, coupling
   and coverage
3. Rank the modules from highest to lowest defect risk, with the top three
   risk factors for each, labelled EXECUTED, STATIC or INFERRED
4. Say whether src/lib/block-transfer.ts belongs at the top, and why
5. Save to reports/stretch-defect-risk-profile.md
6. Save learnings and persist patterns
```

---

## After the runs: apply PACTS

PACTS is the Agentic QE framework's evaluation lens ([agentic-qe.dev/framework](https://agentic-qe.dev/framework)). For each report, ask:

- **Proactive?** Did it flag risk *before* you asked, or only answer the prompt?
- **Autonomous?** Did it decide what to inspect, or wait for your steers?
- **Collaborative?** Did it connect findings across concerns and across exercises, or treat each in a silo?
- **Targeted?** Was the analysis fitted to *this* ECU update function, or a generic checklist?
- **Structured?** Can you trace every conclusion to the AI agent that made it, the input it read and the reason it gave?

In pairs, score each report 0 to 3 per property. Share the most surprising weakness.

---

## Your adoption roadmap

Fill this in for *your* context (about 10 minutes, in pairs):

1. **My context**: product, toolchain, safety level, and where quality hurts most today: ______
2. **The clerical work I want back**: which documentation or analysis activity eats my team's time that an AI agent could take over *first*? ______
3. **First 3 AI agents I will try**: pick from `.claude/agents/v3/` (for example `qe-requirements-validator`, `qe-product-factors-assessor`, `qe-test-architect`, `qe-queen-coordinator`): ______
4. **First QCSD phase I will start with**: Ideation, Refinement, Development or Verification? ______
5. **What stays with a human**: which gate will I never hand over (safety case, release sign-off, hardware-in-the-loop verdict)? ______
6. **One success metric for two weeks**: ______
7. **My first step on Monday**: ______

> Keep it small: one AI agent, one phase, one repository, one metric. The full fleet (60 AI agents and 86 skills, MIT licensed) is already on your machine from `aqe init`.
