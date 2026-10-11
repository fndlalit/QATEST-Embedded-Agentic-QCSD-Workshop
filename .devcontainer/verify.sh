#!/usr/bin/env bash
# Read-only readiness checks. Never index code or initialise a database here.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/check-workspace.sh"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<13)) { console.error("Node 22.13 or newer is required."); process.exit(1) }'
node -e 'const p=require("node:child_process").execSync("npm root -g").toString().trim(); for (const n of ["agentic-qe","@huggingface/transformers"]) { const pkg=require(`${p}/${n}/package.json`); console.log(`${n} ${pkg.version}`) }'
command -v claude >/dev/null
command -v codex >/dev/null
command -v gh >/dev/null
test -d node_modules/vitest
test -d node_modules/fast-check
test -f .mcp.json
test -f .claude/agents/v3/qe-product-factors-assessor.md
test -f .claude/agents/v3/qe-test-architect.md
test -f .claude/agents/v3/qe-queen-coordinator.md
test -f .claude/agents/v3/qe-defect-predictor.md
test -f .claude/skills/qcsd-ideation-swarm/SKILL.md
test -f .agentic-qe/memory.db
test "$(sqlite3 -readonly .agentic-qe/memory.db 'PRAGMA integrity_check;')" = ok
echo 'Tooling, exercise assets and SQLite integrity: OK'
node .devcontainer/verify-data.cjs
