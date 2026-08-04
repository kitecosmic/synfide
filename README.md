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

## Status

Under active development. The runtime guarantees Synfide builds on (metering, spend ledger, host ceilings, deny-by-default) are already in the Synsema engine; the framework packages are being extracted from working, probed patterns. The quickstart above is the contract we are building to — it will work exactly as written at first release, and this README will not say it does until it does.

Downloads are versioned and checksum-verified; the framework is vendored into your project, so upgrades are always explicit.
