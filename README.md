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

With the server up: **`/chat`** talks to your configured LLM provider (any of them, or a local model), **`/inbox/ui`** is the one-click approval inbox (works on a phone), and `synsema run console.syn` is the same thing from a terminal.

That's the whole setup. The generated `.env.example` documents **every** variable on its own line — all supported LLM providers (including fully local GGUF models that need no key at all), the human-approval webhooks, and the host ceilings for money and tokens. Copy it to `.env`, uncomment what you use, done. Nothing is guessed, nothing is hidden.

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
| `ui` | The operator page, served by your own app: one-click approve/deny inbox, workflow statuses, journal tail — XSS-escaped, zero JS build, works on a phone. Plus `console.syn`: the same operations from a terminal, over the app's own HTTP API |

Plus scaffolding: conventional project layout, per-environment capability profiles, and a generated UI (chat, dashboard, approval inbox).

## Try it today (clone-and-run)

All six packages — `store`, `durable`, `approvals`, `treasury`, `cassettes`, `journal` — are here and tested. Clone this repo (or just run the quickstart above) and:

```bash
# the test suite (19 tests — fresh state + audit dirs keep it deterministic):
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
```

Every example file documents its own flow at the top. Use the packages from your own entry file with `use "./synfide/durable.syn" as durable` — your entry declares the capabilities (`require memory("your-app")`, `require serve(8080)`, …); the packages never grab any.

## Update & version

Your installed version is in `synfide/VERSION`. To update, just re-run:

```bash
synsema init --synfide
```

Already up to date → it says so and touches nothing. Newer release → framework files (`synfide/`) update; **your files are never overwritten**, and a framework file you edited is kept too — the new version lands beside it as `<file>.new` with a loud warning. All framework content and versions come from THIS repo's releases; updating Synfide never requires updating Synsema.

## Status

**The quickstart at the top works as written** (Synsema v0.5.3+, Synfide v0.1.0). The install is a framework, not a template: version-pinned to the latest Synfide release, every file verified against the manifest's sha256, `synfide/VERSION` records what you have, and re-running `synsema init --synfide` upgrades the framework files only — yours are never overwritten.

All six packages are shipped and tested (synfide v0.2.0). The framework is deliberately **agnostic**: it never names an LLM provider (recording goes through whatever the runtime has configured — hosted or a local GGUF; replay needs none), a currency, or a payment provider. Next: an inbox UI, approval deadlines, and a concurrency lease for parallel `run()` calls on one workflow.

## License

[Apache-2.0](LICENSE).
