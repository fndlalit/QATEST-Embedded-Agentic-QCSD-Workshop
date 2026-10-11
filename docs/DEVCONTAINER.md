# Workshop container: GitHub Codespaces or local Docker

This is an alternative to the manual Setup in the [README](../README.md). It gives you the same module, the same exercises, the latest published AQE and the local embedder 4.2.0, with nothing installed on your laptop. Use it if your machine blocks global npm installs or cannot run Node 22.13.

Verified on 11 October 2026: the image was built and the three scripts below were run in a fresh container with agentic-qe 3.15.3. The GitHub Codespaces service itself was not part of that check.

## GitHub Codespaces

1. Open the repository on GitHub, then **Code → Codespaces → Create codespace on main**. The default 2-core machine is enough. Your own Codespaces allowance or billing applies.
2. Wait for the container build and setup to finish. The first build takes several minutes.
3. In the terminal run:

   ```bash
   bash .devcontainer/prepare-workshop.sh
   node .devcontainer/verify-mcp.mjs
   npm run test:run
   ```

   Expect `12 source files indexed`, `70 patterns in memory`, an MCP handshake with `OK`, and 121 passing tests.
4. Sign in to your coding agent **inside the container**. For Claude Code run `claude`, trust the folder and approve the `agentic-qe` MCP server. Codex CLI is also installed: run `aqe init --auto --with-codex`, then `codex login --device-auth`. For any other coding agent use the matching `aqe init` flag from the README and its own sign-in.
5. Open **LAB.md**. `prepare-workshop.sh` has already run the three Exercise 0 commands. Read its output as your baseline: 12 files, 86 nodes, 90 edges; 96 nodes and 161 edges in the persisted graph; 12 entries and 86 vectors.

Do this **before the session**. The preparation step downloads the embedding model, and conference wifi is slow. Indexing and embeddings run inside the container, which in Codespaces is a machine hosted by GitHub. The exercises still use your own model provider and tokens.

## Docker on your laptop

Open your clone in VS Code with the Dev Containers extension and choose **Dev Containers: Reopen in Container**. Or use DevPod:

```bash
git clone https://github.com/fndlalit/QATEST-Embedded-Agentic-QCSD-Workshop
cd QATEST-Embedded-Agentic-QCSD-Workshop
devpod provider add docker   # once
devpod up . --provider docker --id qatest-embedded
```

Then run the same preparation, check and sign-in steps. The image supports Linux amd64 and arm64, so Apple Silicon works without emulation. Allow 8 GB of RAM.

## What the scripts change and what they keep

- **The image** installs the latest AQE, Claude Code, Codex CLI and GitHub CLI, plus the embedder `@huggingface/transformers` 4.2.0.
- **`post-create.sh`** runs once when the container is created. It refreshes AQE, Claude Code and Codex to the latest release, runs `npm ci`, and runs `aqe init --auto` only if `.agentic-qe` does not exist. It never rewrites an existing learning database.
- **`prepare-workshop.sh`** is a step you run yourself. It backs up the memory database, indexes `src/`, downloads the embedding model and seeds AQE's foundational patterns. A marker makes later runs a read-only check.
- **`verify.sh`** is read-only. It checks the tools, the AI agent and skill files, that every source file is in the graph, and that patterns are stored with embeddings.
- **`verify-mcp.mjs`** performs a real MCP handshake with the AQE server. It makes no model calls.
- Reports and the AQE database stay in your workspace across restarts. Export your reports before you delete a Codespace.

The embedder carries the same dependency advisory caveat described in the README. If your policy forbids it, use the manual setup with an embedding endpoint you trust.

## Troubleshooting

- **A sign-in on your laptop does not carry into the container.** Sign in to your coding agent again inside it.
- **The model download fails.** Check network access to npm and Hugging Face, then run `prepare-workshop.sh` again. The marker is only written after a successful check.
- **`Incomplete existing AQE setup`.** Setup stops and does not repair or delete the folder. Ask the facilitator. Do not delete a learning database to make a check pass.
- **`VectorSearch WARN: semantic vector search is not active`** during preparation. The check line after it is what counts: `70 patterns in memory, 70 with 384-dimensional embeddings: OK`.
- **`memory_query` returns 0 entries in `verify-mcp.mjs`.** That is expected before the exercises have stored anything.
