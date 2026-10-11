# Troubleshooting

Detail behind the short notes in [LAB.md](./LAB.md). You do not need any of this to run the workshop.

## `aqe learning stats` reads `Total: 0`

There is no embedder, so nothing is stored. Install it (setup step 5 in the [README](./README.md)):

```bash
npm install -g @huggingface/transformers@4.2.0
aqe learning stats
```

LEARNING_TOTALS

## `VECTOR_SPACE_UNVERIFIED` and `brain.rvf`

The persistent vector index stays unverified without native RuVector provenance, and AQE falls back to SQLite. SQLite is authoritative, so patterns are stored. Only the approximate-nearest-neighbour index is skipped. `brain.rvf.corrupt-NNNN` files in `.agentic-qe/` are quarantined empty indexes, not lost data.

## The skills or MCP tools do not load in Claude Code

On first launch Claude Code asks you to trust the folder and to approve the `agentic-qe` MCP server. If you declined either, run `claude` again in this folder and accept both. `claude mcp list` should show `agentic-qe` as connected.

## `/qcsd-ideation-swarm` is not offered after a slash

It is installed as a skill, not a command file. Ask for it by name: "Use the qcsd-ideation-swarm skill to ...".

## Memory on tools other than Claude Code

Claude Code captures and recalls learnings through the AQE hooks. Other coding agents go through the `memory_store` and `memory_query` MCP tools. If recall returns nothing there, build the Exercise 5 brief from your reports and label it REPORTS-BASED, as described in LAB.md.

## `npm install -g` is blocked on my machine

Use a user-level prefix, then put its `bin` folder on your PATH:

```bash
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## The graph counts differ from LAB.md

Counts can vary with the AQE version and with configured providers. Check that all 12 source files were indexed. The exact totals are not a pass criterion.
