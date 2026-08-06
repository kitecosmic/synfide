# Synfide

**The trust-first framework for agent applications, built on [Synsema](https://github.com/kitecosmic/synsema).**

*Syn + fides — trust, engineered.*

## Get running

```bash
# 1. Install Synsema (one self-contained binary — no Python, no npm)
curl -fsSL https://synsema.com/install.sh | sh

# 2. Download Synfide (version-pinned, sha256-verified) and scaffold your project
synsema init --synfide

# 3. Configure and run
cp .env.example .env       # open it, pick your LLM provider, paste its API key
synsema run app.syn        # your first durable workflow, in the terminal
synsema serve serve.syn    # …and your server: http://localhost:8080
```

With the server up, **the whole app is an admin** (laid out like Django's): a dashboard with live counts and recent actions, **`/chat`** — an **agent** over your configured LLM provider that can *do* things ("onboard ana"): risky tools don't act directly, they park in **`/inbox/ui`**, the one-click approval inbox (works on a phone), and finish by themselves once you approve — plus workflows, the patch changelist with per-diff detail, the journal, `/admin/env` (config presence — values sealed, never shown), and `/llms.txt`, the auto-generated endpoint list. `synsema run console.syn` is the same inbox from a terminal.

**The first visit is a first-run wizard** (engine v0.5.6+): no accounts exist → `/setup` asks for a username, the password twice, **and a setup code printed only on the server's terminal** — so even on an open network bind, nobody who can't see your console can win the first-run race. That account is the **superadmin** (argon2id-hashed, never stored raw) and you're signed in. After that it's `/login` — a real session in an HttpOnly, SameSite=Lax cookie; every admin page is behind it. Scripts and bots use `Authorization: Bearer <SYNFIDE_ADMIN_TOKEN>` on the API routes (constant-time check against a sealed secret). Configuration edits on `/admin/env` are **write-only** (password field, value never readable back), each save gated by another console code. `synsema serve serve.syn` is all you need locally; for remote access use TLS (the engine's `tls auto` or your proxy — the Secure session cookie travels only over HTTPS or localhost). And any single approval can demand a one-time code sent through your own channel.

That's the whole setup. The generated `.env.example` documents **every** variable on its own line — all supported LLM providers (including fully local GGUF models that need no key at all), the human-approval webhooks, and the host ceilings for money and tokens. Copy it to `.env`, uncomment what you use, done. Nothing is guessed, nothing is hidden.

## Building with an AI agent?

Point it at **`synfide/GUIDE.md`** (installed with every project — the complete,
version-pinned framework reference: every package's exact API, required
capabilities, canonical wiring, language gotchas). The scaffold also ships an
`AGENTS.md` that tells coding agents exactly that. For the language underneath,
the agent should install the Synsema skill and docs MCP (commands in AGENTS.md).
Nothing about Synfide needs to be guessed or reverse-engineered.

## Why

Anyone can demo an AI agent in an afternoon. Shipping one to production is where projects die — and they die from the same fears every time:

- **The surprise bill.** A runaway loop, a bad retry, and you wake up to thousands of dollars of API spend.
- **The agent that dies mid-task.** Long-running work crashes at step 7 of 12, or waits three days for a human approval that no process can survive.
- **Tools you can't hand over safely.** Untrusted content meets real credentials and an exfiltration channel.

Synfide's promise: **an agent with auditable permissions, a budget that cuts hard, and workflows that survive restarts while waiting for human approval — in one binary, no SaaS.**

## How

Synsema, the language underneath, already enforces what libraries elsewhere can only suggest: deny-by-default capabilities, hard token budgets (`SYNSEMA_LLM_BUDGET`), an audited money ledger (`spend` + `SYNSEMA_SPEND_CEILING`), sealed secrets, and per-tool least privilege. Synfide is the conventions-and-batteries layer on top — written mostly in Synsema itself:

| Package | What it gives you |
|---|---|
| `durable` | Re-entrant workflows: named steps, persisted progress, resume exactly where a crash or restart left off; a registry of every workflow's status and a `tick()` heartbeat that advances parked workflows by itself |
| `approvals` | Human-in-the-loop as data: an approval inbox that frees the thread and survives days of waiting, webhooks to any channel |
| `treasury` | Money with a seatbelt, PSP- and currency-agnostic: per-scope budgets that cut BEFORE anything is declared, the runtime's audited `spend` ledger + host ceiling underneath, payments under least-privilege `call_tool`, and discrepancy records when a PSP fails after the declare — never a silent mismatch |
| `cassettes` | Record/replay of LLM calls — behavioral tests (evals) that run cheap, deterministic and fully offline; record with whichever provider is configured, replay with none |
| `journal` | An ordered action journal over the least-privilege tool dispatcher: executed, rejected (allow-list) and failed — actor, action, timestamp |
| `agent` | The safe tool-calling loop, packaged: the model proposes, the allow-list decides, `call_tool` runs least-privilege, every dispatch is journaled, the loop is bounded — a prompt injection can invent tool names all day, nothing outside the allow-list ever runs |
| `docs` | The agent's Synsema knowledge: LLMs don't know the language yet, so the official docs MCP (docs.synsema.com — the same server coding agents use) is wired in as plain tasks: search the docs, read a page, and **prove a `.syn` snippet in the official sandbox** before proposing it as a patch. The scaffold gives these to the default agent out of the box |
| `limits` | Per-user (per-anything) consumption budgets: meter the llm tokens of each interaction, branch on `within(key, budget)` BEFORE answering — deny, queue or hand to a human, your policy |
| `patches` | **Self-modification with a seatbelt**: an agent proposes an exact change to YOUR files — or the creation of a new one (a new `index.html`, `pages/presupuestos.html`, `whatsapp.syn`: however your app grows) — an independent auditor (a second model call, adversarial by instruction — or your own rules) must approve it, an optional human gate parks it in the inbox, apply is atomic, journaled, and a create never overwrites. `synfide/` itself is hard-refused — a self-improving agent can never rewrite the framework that audits it |
| `ui` | **An admin, the way Django's admin taught everyone to read one**: branding band, breadcrumbs, section sidebar with a pending badge, captioned modules — a dashboard (app index + recent actions), the one-click approvals inbox, workflows, the patches changelist with per-patch diff detail, the journal, and an agent chat. Built the Synsema way: real `render()` templates (`synfide/ui/pages/…`, auto-escaped holes, one shared layout) + real static CSS/JS, light/dark, phone-ready, a live status strip on every page. Restyle by copying the templates into your folder — `render()` is a language builtin, the framework adds nothing in between. Plus `console.syn`: the same operations from a terminal |

Plus scaffolding: conventional project layout, per-environment capability profiles, and a generated UI (chat, dashboard, approval inbox).

## Try it today (clone-and-run)

All ten packages — `store`, `durable`, `approvals`, `treasury`, `cassettes`, `journal`, `agent`, `limits`, `patches`, `ui` — are here and tested. Clone this repo (or just run the quickstart above) and:

```bash
# the test suite (34 tests — fresh state + audit dirs keep it deterministic):
SYNSEMA_STATE_DIR=$(mktemp -d) SYNSEMA_AUDIT_DIR=$(mktemp -d) synsema test test_synfide.syn

# a durable pipeline you can kill and resume (completed steps are never re-run):
CRASH=1 synsema run example_pipeline.syn    # dies at "validate"
synsema run example_pipeline.syn            # resumes AT "validate" and finishes

# the flagship: an onboarding service parked on human approval —
# it survives a full server restart while parked, and once the human answers,
# the heartbeat finishes it BY ITSELF (no second request):
synsema serve example_onboarding.syn
curl -X POST localhost:8080/onboarding/ana/start          # → parks at "approval"
# now open http://localhost:8080/inbox/ui in ANY browser (phone included):
# approve with one click — the heartbeat finishes the workflow by itself.
# Prefer the terminal? The operator console does the same over the app's API:
synsema run console.syn                                   # l · a <id> · d <id> · g <path>

# NEW — the agent that improves ITSELF while it works (needs an LLM key in .env):
synsema serve example_evolve.syn
# talk to it at /chat and complain ("stop being so formal", "answer in Spanish");
# every 60s an EXECUTOR proposes an exact patch to its own instructions file
# (evolve-brain.md), an adversarial AUDITOR — a second model call — approves or
# kills it, and an approved patch lands atomically: the NEXT message already
# behaves differently, no restart. Watch /brain, /patches and the journal.
# It can NEVER touch synfide/ — the framework that audits it is off-limits,
# and the entry grants file access to exactly ONE file.
```

Every example file documents its own flow at the top. Use the packages from your own entry file with `use "./synfide/durable.syn" as durable` — your entry declares the capabilities (`require memory("your-app")`, `require serve(8080)`, …); the packages never grab any.

## Developing Synfide itself (test everything BEFORE pushing)

`synsema init --synfide` only installs from this repo's **published GitHub
release** — so never push untested content. The local loop (the tooling is
Synsema itself — `scripts/*.syn`, no Python, no npm):

```bash
# 1. after changing any shipped file, regenerate the manifest hashes:
synsema run scripts/update_manifest.syn
#    (bump too: SYNFIDE_VERSION=v0.3.7 synsema run scripts/update_manifest.syn)

# 2. simulate the install a user would get — from the LOCAL working tree.
#    The target is ALWAYS ../synfide-local-test — a SIBLING directory, outside
#    this repo, so nothing installed can ever leak into git:
synsema run scripts/install_local.syn

# 3. prove the installed layout, exactly as a user would:
cd ../synfide-local-test
SYNSEMA_STATE_DIR=$(mktemp -d) SYNSEMA_AUDIT_DIR=$(mktemp -d) synsema test test_synfide.syn
synsema serve serve.syn                       # click through the admin
```

`install_local.syn` verifies every sha256 against the working tree BEFORE
copying anything: a stale hash (file changed, manifest not regenerated) or a
listed file that's missing fails loudly — a forgotten file can't ship. Only
after that loop is green, push and cut the release; a final
`synsema init --synfide` in an empty dir is the end-to-end smoke test of the
published artifact.

## Update & version

Your installed version is in `synfide/VERSION`. To update, just re-run:

```bash
synsema init --synfide
```

Already up to date → it says so and touches nothing. Newer release → framework files (`synfide/`) update; **your files are never overwritten**, and a framework file you edited is kept too — the new version lands beside it as `<file>.new` with a loud warning. All framework content and versions come from THIS repo's releases; updating Synfide never requires updating Synsema.

## Status

**The quickstart at the top works as written** (Synsema v0.5.3+, Synfide v0.1.0). The install is a framework, not a template: version-pinned to the latest Synfide release, every file verified against the manifest's sha256, `synfide/VERSION` records what you have, and re-running `synsema init --synfide` upgrades the framework files only — yours are never overwritten.

All ten packages are shipped and tested (synfide v0.3.6). The framework is deliberately **agnostic**: it never names an LLM provider (recording goes through whatever the runtime has configured — hosted or a local GGUF; replay needs none), a currency, a payment provider — or a domain: the packages are mechanisms, the scaffold is neutral, and every opinion lives in an example. Recurring work needs no package at all: `cron_every` is language-level (the heartbeat and the self-improvement loop both ride it). Next: approval deadlines, and a concurrency lease for parallel `run()` calls on one workflow.

## License

[Apache-2.0](LICENSE).
