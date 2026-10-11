#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/check-workspace.sh"

# Do not echo environment variables: Codespaces can inject participant secrets.
# Refresh the tools so a cached image still gets the latest published AQE.
npm install -g --no-fund --no-audit agentic-qe@latest @anthropic-ai/claude-code@latest @openai/codex@latest
npm ci --no-fund --no-audit

# A rebuild or resume must never reinitialise a participant's existing learning database.
if [ ! -e .agentic-qe ]; then
  # A minimal child environment keeps provider credentials out of setup, so it spends no tokens.
  env -i HOME="$HOME" PATH="$PATH" aqe init --auto
elif [ ! -f .agentic-qe/memory.db ]; then
  echo 'Incomplete existing AQE setup. Keep .agentic-qe and ask the facilitator to look at it.' >&2
  exit 1
else
  echo 'Keeping the existing AQE setup and learning data.'
fi
node -e 'const p=require("node:child_process").execSync("npm root -g").toString().trim(); console.log(`Using AQE ${require(`${p}/agentic-qe/package.json`).version}`)'

printf '\nContainer ready. Next run: bash .devcontainer/prepare-workshop.sh\n'
printf 'Then sign in to your coding agent and open LAB.md.\n'
