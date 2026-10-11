FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 jq ripgrep \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# GitHub's signed apt repository supplies current gh releases on both CPU families.
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Resolve the latest AQE release; post-create also refreshes cached images.
# Transformers is the tutorial's explicit local-embedding opt-in (see README).
ARG AQE_VERSION=latest
ARG TRANSFORMERS_VERSION=4.2.0
ARG CLAUDE_VERSION=latest
ARG CODEX_VERSION=latest
USER node
RUN npm install -g --no-fund --no-audit \
    "agentic-qe@${AQE_VERSION}" \
    "@huggingface/transformers@${TRANSFORMERS_VERSION}" \
    "@anthropic-ai/claude-code@${CLAUDE_VERSION}" \
    "@openai/codex@${CODEX_VERSION}"
