# QA&TEST Embedded 2026 · Agentic QE for Embedded Systems

This is the repo for the tutorial **Agentic Quality Engineering for Embedded Systems: Quality Intelligence Across the Entire Delivery Lifecycle** at **[QA&TEST Embedded 2026](https://embedded.qatest.org/ponentes/lalitkumar-bhamare/?lang=en)**, Bilbao.

**Tutorial 1 · Wednesday 14 October 2026 · 09:15 to 13:00 · Room 5A · Facilitator: Lalitkumar Bhamare**

**Agentic QCSD** puts AI quality agents to work across the whole delivery lifecycle: reasoning about requirements, product risk, code quality, security and traceability the way a quality engineer would. In this session you drive a fleet of these AI agents (**[Agentic QE](https://github.com/proffesor-for-testing/agentic-qe)**) through four delivery phases, see what they surface on their own, and judge their output with the **PACTS** lens (Proactive, Autonomous, Collaborative, Targeted, Structured).

The AI agents need something real to work on. This repo ships a small, deliberately flawed **ECU firmware update module** as the subject under test. It is simulated in software. **You need no hardware.**

---

## What you will do

A short warm-up, four lifecycle exercises and a self-learning close, all copy-paste, in **[LAB.md](./LAB.md)**:

| Step | AI agent or tool | The question it answers |
|------|------------------|--------------------------|
| **0 · Warm-up** | `aqe code index src/` (your terminal) | Build a knowledge graph of the code. Runs locally, no API key, a few seconds. |
| **1 · Ideation** | `/qcsd-ideation-swarm` | Before any code: is this epic ready to build? GO / CONDITIONAL / NO-GO. |
| **2 · Refinement** | `qe-product-factors-assessor` | What is this product made of (SFDIPOT), and where is the risk? |
| **3 · Development** | `qe-test-architect` | Can it turn those ideas into runnable tests for the riskiest module? |
| **4 · Verification** | `qe-queen-coordinator` | Is this releasable? Coverage, security, safety traceability and a 90% gate. |
| **5 · Self-Learning** | AQE memory | A handoff brief consolidated from what the AI agents learned. |

Exercises 1 to 4 have **two prompt versions**: one for Claude Code and one plain step list for every other tool. You then score the reports with **PACTS** and leave with a **personal adoption roadmap**.

---

## Before you arrive

A tutorial morning is not enough time to fix a laptop. Please finish Setup before the session.

- **Node.js 22.13 or newer and npm 10 or newer.** Check with `node -v` and `npm -v`. Not needed if you use the container setup.
- **Git.**
- **Rights to install a global npm package.** Setup runs `npm install -g agentic-qe`. If your machine blocks that, bring a laptop that does not.
- **A coding agent you already use, signed in and working.** Claude Code, GitHub Copilot, Cursor, AWS Kiro, OpenAI Codex CLI, Windsurf, Cline, OpenCode, Kilo Code, Roo Code or Continue.dev. AQE drives whichever one you have through one MCP server.
- **Your own model access.** Exercises 1 to 5 spend your tokens on your own key or subscription. Exercise 0 spends none. One unattended run of all exercises on Claude Code cost 4.47 USD on 11 October 2026 (3.81 USD without the stretch exercise).
- **About 2 GB of free disk space.**
- **No hardware, no compiler toolchain, no debugger.** The ECU is simulated in TypeScript.

Conference wifi and corporate proxies are the two things most likely to break Setup, and neither can be fixed from the front of the room.

---

## Setup

There are two ways to set up. Pick one.

- **On your laptop (manual):** the six steps below.
- **In a container (GitHub Codespaces or local Docker):** nothing to install on your laptop. Follow **[docs/DEVCONTAINER.md](./docs/DEVCONTAINER.md)**, then go straight to LAB.md. Use this if your machine blocks global npm installs or cannot run Node 22.13.

### Manual setup

**1. Get this repo.** Clone it, then move into the folder:

```bash
git clone https://github.com/fndlalit/QATEST-Embedded-Agentic-QCSD-Workshop
cd QATEST-Embedded-Agentic-QCSD-Workshop
```

> **Clone close to your home folder.** The code indexer skips any file more than ten directories deep.

**2. Install AQE and set it up for your coding agent.**

```bash
npm install -g agentic-qe@latest   # the latest published AQE CLI
aqe init --auto                    # set up AQE for YOUR coding agent, see the table below
```

`aqe init --auto` configures **Claude Code** by default. For another coding agent add the matching flag:

| Coding agent | `aqe init` command |
|--------------|--------------------|
| **Claude Code** | `aqe init --auto` |
| **GitHub Copilot** | `aqe init --auto --with-copilot` |
| **Cursor** | `aqe init --auto --with-cursor` |
| **Cline** | `aqe init --auto --with-cline` |
| **OpenCode** | `aqe init --auto --with-opencode` |
| **AWS Kiro** | `aqe init --auto --with-kiro` |
| **Kilo Code** | `aqe init --auto --with-kilocode` |
| **Roo Code** | `aqe init --auto --with-roocode` |
| **OpenAI Codex CLI** | `aqe init --auto --with-codex` |
| **Windsurf** | `aqe init --auto --with-windsurf` |
| **Continue.dev** | `aqe init --auto --with-continuedev` |

**3. Install the subject module's dependencies.**

```bash
npm install
npm run test:run        # optional check: 121 tests in 9 files pass
```

**4. Build the code knowledge graph.** Three commands in your terminal, before you open your coding agent:

```bash
aqe code index src/     # expect: 12 files indexed, 86 nodes, 90 edges
aqe hg stats            # the persisted graph, counted by node type
aqe memory usage        # your starting baseline: 12 entries, 86 vectors
```

This is static analysis plus a local embedding model. It needs no API key and spends no tokens.

**5. Install the embedder.** AQE stores what the AI agents learn in a vector store, and the store needs an embedding model to write to. Without one, every "Save learnings and persist patterns" is a no-op and Exercise 5 has nothing to recall.

```bash
npm install -g @huggingface/transformers@4.2.0   # local embedder, 384-dim all-MiniLM-L6-v2
```

AQE treats this package as an explicit opt-in: its dependency chain currently carries two unresolved HIGH advisories (GHSA-xcpc-8h2w-3j85, GHSA-f88m-g3jw-g9cj). On a machine where you cannot install it, set `AQE_EMBEDDER_ENDPOINT` to an embedding service you trust, or run Exercise 5 from the reports as described in LAB.md.

**6. Launch your coding agent in this folder.** This folder is your workspace root. On first launch Claude Code asks you to trust the folder and to approve the `agentic-qe` MCP server. Accept both, or the skills and memory tools will not load.

**Next:** open **[LAB.md](./LAB.md)** and start with Exercise 0.

---

## The subject under test

A simulated over-the-air firmware update for an automotive Body Control Module (BCM-7), ASIL B. It is the *subject under test*, not the point of the workshop. It contains realistic quality issues for the AI agents to find.

- **Update orchestration** (`src/ota/update-manager.ts`): preconditions, download, verification, activation, commit or rollback.
- **A/B partitions** (`src/ota/partition-manager.ts`): slot bookkeeping, boot attempts, rollback.
- **Vehicle preconditions** (`src/ota/preconditions.ts`): speed, battery voltage, ignition.
- **Libraries** (`src/lib`): block transfer with retry and backoff, image verification (CRC-32, signature, anti-rollback), UDS request validation, SecurityAccess attempt limiting, diagnostic session timeout, event and fault logging, timing budgets.
- **Simulator** (`src/sim`): a software ECU that answers TransferData requests. `npm run simulate` runs one update. `npm run simulate -- --lossy` runs it on a link that loses responses.
- **Requirements** (`requirements/`): the epic, user stories and acceptance criteria for the update function.

**Stack:** TypeScript · Vitest · fast-check. No framework, no hardware abstraction layer, no real CAN bus.

**Run the existing tests:**

```bash
npm run test:run        # single run
npm run test:coverage   # with coverage
```

---

## License

MIT, see [LICENSE](./LICENSE).
