# Synfide

**The trust-first framework for agent applications, built on [Synsema](https://github.com/kitecosmic/synsema).**

*Syn + fides — trust, engineered.*

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

Plus scaffolding: one command to a project with conventional layout, per-environment capability profiles, and a generated UI (chat, dashboard, approval inbox).

## Status

Early design. The runtime prerequisites (metering, spend ledger, host ceilings) shipped in Synsema; the framework packages are being extracted from working, probed patterns. Nothing here is stable yet.

## Planned install

```bash
synsema init --synfide
```

One command, versioned and checksum-verified, vendored into your project with explicit upgrades.
