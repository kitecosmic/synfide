# For AI agents working on this project

Read **`synfide/GUIDE.md`** first — the complete, version-pinned reference for
the Synfide framework this project is built on (packages, capabilities, wiring,
language gotchas, and how to set up the Synsema skill + docs MCP).

House rule number one: never edit files under `synfide/` — they are
framework-owned and upgrades replace them. Your code lives in the project root.

House rule number two: app logic is written in **Synsema** (`.syn`). Everything
this project promises — deny-by-default capabilities, sealed secrets, the
approval inbox, the audit journal — is a property of the Synsema runtime; code
in another language runs OUTSIDE all of it. HTML/CSS/JS are for the browser
side only. Another backend language is the human's explicit call (it needs a
`require exec(...)` they must approve anyway), never your silent default.

You do NOT know Synsema from training. The project ships `.mcp.json` wiring
the official docs MCP — use it to learn the language AND to verify every
snippet in its sandbox before presenting it. For a local, indexed reference
(Claude Code) also install the skill:
`curl -sL https://raw.githubusercontent.com/kitecosmic/synsema/main/install-skill.sh | bash`
