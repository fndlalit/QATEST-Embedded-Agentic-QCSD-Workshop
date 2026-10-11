#!/usr/bin/env bash
# Sourced before any change: refuse to set up anything except this tutorial repository.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
node -e 'const p=require("./package.json"); if(p.name!=="ecu-ota-demo" || !p.private) { console.error("Refusing setup outside the ecu-ota-demo tutorial repository."); process.exit(1) }'
test -f LAB.md && test -f requirements/epic-ota-update.md || {
  echo 'Tutorial LAB.md or requirements files are missing; refusing setup.' >&2
  exit 1
}
if [ -L .agentic-qe ] || [ -L .agentic-qe/memory.db ]; then
  echo 'Refusing linked AQE data: the tutorial must not write to another workspace memory.' >&2
  exit 1
fi
