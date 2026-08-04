# For AI agents working on this project

This project is built on **Synfide** (agent framework) over **Synsema** (the
language). Before writing or changing code here:

1. **Read `synfide/GUIDE.md`** — the complete, version-pinned framework
   reference: every package's exact API, which capabilities each entry file must
   declare, the canonical wiring, and the language gotchas that will bite you.
2. **Learn the language** from the Synsema skill and docs MCP:
   `curl -sL https://raw.githubusercontent.com/kitecosmic/synsema/main/install-skill.sh | bash`
   `claude mcp add --transport http synsema-docs https://docs.synsema.com/mcp`

House rules (the GUIDE expands on all of them):
- Never edit files under `synfide/` — extend by writing your own `.syn` files.
- Capabilities are declared in the ENTRY files (`serve.syn`, `app.syn`), never
  inside packages.
- Everything marked `══ REPLACE ME ══` in `serve.syn` is a placeholder waiting
  for this project's real domain logic.
- Test with: `SYNSEMA_STATE_DIR=$(mktemp -d) SYNSEMA_AUDIT_DIR=$(mktemp -d) synsema test test_synfide.syn`
- Update the framework with `synsema init --synfide` (your files are never
  overwritten).
