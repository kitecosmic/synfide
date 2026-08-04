# Synfide

**The trust-first framework for agent applications, built on [Synsema](https://github.com/kitecosmic/synsema).**

*Syn + fides — trust, engineered.*

## Get running

```bash
# 1. Install Synsema (one self-contained binary — no Python, no npm)
curl -fsSL https://synsema.com/install.sh | sh

# 2. Download Synfide and scaffold your project into the current folder
synsema init --synfide

# 3. Configure and run
cp .env.example .env     # open it, pick your LLM provider, paste its API key
synsema run app.syn
```

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
| `durable` | Re-entrant workflows: named steps, persisted progress, resume exactly where a crash or restart left off |
| `approvals` | Human-in-the-loop as data: an approval inbox that frees the thread and survives days of waiting, webhooks to any channel |
| `treasury` | Payment connectors that compose scoped network access with the audited spend ledger; budget policy per agent and per role |
| `cassettes` | Record/replay of LLM calls — behavioral CI that runs cheap and deterministic |
| `journal` | An action journal over the tool dispatcher: what the agent did, when, and with which permissions |

Plus scaffolding: conventional project layout, per-environment capability profiles, and a generated UI (chat, dashboard, approval inbox).

## Try it today (clone-and-run)

The first three packages — `store`, `durable`, `approvals` — are here and tested. Clone this repo and:

```bash
# the test suite (8 tests: upsert, re-entry, park/resume, approve/deny):
SYNSEMA_STATE_DIR=$(mktemp -d) synsema test test_synfide.syn

# a durable pipeline you can kill and resume (completed steps are never re-run):
CRASH=1 synsema run example_pipeline.syn    # dies at "validate"
synsema run example_pipeline.syn            # resumes AT "validate" and finishes

# the flagship: an onboarding service parked on human approval —
# and it survives a full server restart while parked:
synsema serve example_onboarding.syn
curl -X POST localhost:8080/onboarding/ana/start          # → parks at "approval"
curl localhost:8080/inbox                                 # → what awaits a human
curl -X POST localhost:8080/inbox/onboarding-ana -d '{"approved": true, "who": "you"}'
curl -X POST localhost:8080/onboarding/ana/start          # → resumes, "done"
```

Every example file documents its own flow at the top. Use the packages from your own entry file with `use "./synfide/durable.syn" as durable` — your entry declares the capabilities (`require memory("your-app")`, `require serve(8080)`, …); the packages never grab any.

## Status

Under active development. `store` / `durable` / `approvals` are working and tested (above); `treasury`, `cassettes`, `journal` and the `synsema init --synfide` scaffold are next. The quickstart at the top is the contract we are building to — it will work exactly as written at first release, and this README will not say it does until it does.

Downloads will be versioned and checksum-verified; the framework is vendored into your project, so upgrades are always explicit.
