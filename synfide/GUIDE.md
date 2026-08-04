# Synfide — guide for AI agents (and humans in a hurry)

You are reading the canonical, version-pinned reference for the Synfide framework.
It ships INSIDE every project (`synfide/GUIDE.md`) and updates with the framework,
so it always matches the code next to it. The language underneath is **Synsema**:
learn it from its skill (`curl -sL https://raw.githubusercontent.com/kitecosmic/synsema/main/install-skill.sh | bash`)
and docs MCP (`claude mcp add --transport http synsema-docs https://docs.synsema.com/mcp`).
This file covers what those do NOT: the framework's packages, contracts and rules.

## The golden rules

1. **Never edit files under `synfide/`** — they are framework-owned and upgrades
   replace them (an edited one is kept + `.new`, but that's a conflict, not a
   workflow). Extend by writing YOUR `.syn` files that `use` the packages. To
   fork a package, copy it to your own folder (e.g. `mylib/`) and import that.
2. **Packages never declare top-level capabilities.** The ENTRY file (your
   `serve.syn` / `app.syn`) declares everything: `require memory("name")`,
   `require serve(PORT)`, `require time`, `require llm`, `require net(...)`,
   `require spend(...)`, `require random` — whatever the features you use need.
   One memory name per program; entries sharing a name share state.
3. **Generic packages, neutral scaffold, opinionated examples.** Domain logic
   goes in the user's files, never into the framework.
4. Update/install: `synsema init --synfide` (re-run to upgrade — user files are
   never overwritten). Version: `synfide/VERSION`.

## Synsema gotchas that WILL bite you writing `.syn` here

- `decide`, `reason`, `analyze`, `generate` are RESERVED words — you cannot name
  a task/param/export with them (`mod.decide(...)` fails). Use `resolve`, `why`…
- `and`/`or` do NOT short-circuit: `contains(m,"k") and m["k"]==1` errors when
  the key is absent. Guard with nested `when`.
- `raise("msg")` — on engines ≤ v0.5.1 the parens are mandatory (statement form
  was a silent no-op there).
- No multi-line expression continuation: build long strings with `set s to s + …`.
- Modules can't use `../` paths: entry files live at the project root, next to
  the `synfide/` folder.
- `http_post(url, map)` sends a FORM body; for JSON pass
  `http_post(url, json_encode(m), {"Content-Type": "application/json"})`.
- Run tests with fresh dirs: `SYNSEMA_STATE_DIR=$(mktemp -d) SYNSEMA_AUDIT_DIR=$(mktemp -d) synsema test test_synfide.syn`.

## Packages (exact API)

### store — persistent key→value with upsert (needs: memory)
- `store.put(key, value)` → value. JSON-serializable values; replaces previous.
- `store.get(key, fallback)` → value or fallback.
- `store.del(key)` → count removed. `store.list(prefix)` → `[{key, value}]`.

### durable — re-entrant workflows (needs: memory)
- Steps: `[{"name": text, "run": task(ctx)}]`. A step's result lands in
  `ctx[step_name]`. A step may `give durable.wait("why")` to PARK, or `raise(...)`
  to record a retryable failure.
- `durable.run(name, steps, seed)` → `{"status": "done"|"waiting"|"failed"|"error", ...}`.
  Re-entrant: call it again anytime; completed steps never re-run. First call
  seeds the context; later calls ignore `seed`.
- `durable.status_of(name)` → `{next, display, ctx}`.
- `durable.workflows(prefix)` → registry `[{name, status, step?}]`.
- `durable.tick(defs)` with `defs = [{"prefix", "steps"}]` → re-runs every
  "waiting" workflow under each prefix once; returns `[{name, status}]`. Wire it:
  `task heartbeat() … cron_every(15, heartbeat)` — parked workflows then finish
  BY THEMSELVES when the world acts. "failed" ones are never auto-retried.

### approvals — human-in-the-loop as data (needs: memory, time; protect: random)
- `approvals.request(id, message)` → record (idempotent; never overwrites).
- `approvals.status(id)` → record or nothing. `approvals.pending()` → list.
- `approvals.resolve(id, approved_bool, who)` → updated record or nothing.
  Raises if the approval was protected (use the coded form).
- `approvals.gate(id, message)` → for durable steps: pending → wait sentinel
  (parks); approved → the record; denied → raises (step fails, retryable).
- **One-time codes (approve from ANY channel — Telegram, WhatsApp, SMS, email):**
  `approvals.protect(id)` → a 6-digit one-time code (send it/its link through
  your channel; requires `require random` in the entry). Once protected,
  `resolve()` refuses; use `approvals.resolve_coded(id, approved, who, code)` —
  wrong code raises, right code resolves and burns the code (single use).

### treasury — money with a seatbelt (needs: memory, time, spend("UNIT"))
- `treasury.set_budget(scope, unit, amount)` / `spent(scope, unit)` /
  `budget_left(scope, unit)` (nothing = no budget set).
- `treasury.pay(scope, amount, unit, why, pay_task)` → policy check (BEFORE
  anything) → runtime `spend()` (audited ledger + host ceiling) → your
  `pay_task(amount, unit, why)` under least-privilege `call_tool` → records.
  A pay_task failure AFTER the declare records a discrepancy and re-raises.
- `treasury.discrepancies()` → list. Host ceilings: `SYNSEMA_SPEND_CEILING="USD:500"`.

### limits — per-user/per-anything consumption budgets (needs: memory)
- `limits.spent(key)` → number. `limits.charge(key, n)` → new total.
  `limits.within(key, budget)` → bool. Keys are arbitrary ("user:+549…",
  "chat:diego"). Metering LLM tokens per interaction:
      let before be llm_usage()
      let answer be … (agent.respond / reason / …)
      limits.charge(user_key, llm_usage() - before)
  What to DO at the limit (deny, redirect to a human, queue) is YOUR policy —
  branch on `limits.within(...)` before answering.

### cassettes — LLM record/replay for behavioral tests (needs: memory; llm to record)
- `cassettes.ask(mode, prompt)` — "off" passthrough · "record" call+save ·
  "replay" saved-or-raise (never silently hits the network).
- `cassettes.recorded()` → list. `cassettes.forget(prompt)` → 0/1.

### journal — ordered action journal (needs: memory, time)
- `journal.record(actor, action, detail)` → entry `{n, at, actor, action, detail}`.
- `journal.dispatch(tools, name, args, actor)` → allow-list + least-privilege
  `call_tool` + journals executed/rejected/failed (re-raises errors).
- `journal.entries()` → oldest-first.

### agent — the safe tool-calling loop (needs: llm under serve + tools' caps)
- `agent.respond(question, tools, catalog, context, max_steps)` → final text.
  `tools` = allow-list `{"name": task}`; `catalog` = `[{"name", "describe",
  "params"}]`; `context` = your INSTRUCTIONS + history. Dispatches through
  `journal.dispatch`; a hallucinated tool never runs; loop bounded; out of
  steps → forced final answer (empty catalog).
- Prompting rule learned the hard way: if a tool is the agent's ONLY way to act,
  its `describe` and your INSTRUCTIONS must SAY so ("this tool IS your access —
  never refuse for lack of access"), or models refuse politely.
- Tools that need a human should START a durable workflow whose gate parks in
  the inbox — the agent answers "waiting for approval", the heartbeat finishes.

### ui — the human surfaces (needs: memory, time, serve; llm for chat)
- `ui.inbox_page()` / `ui.home_page()` / `ui.chat_page()` → HTML text (wrap in
  `html(...)`). Everything user-provided is HTML-escaped.
- `ui.resolve(id, approved_text, who_text)` → decision + redirect (route it at
  `GET /inbox/ui/decide` with `query.id/approved/who`).
- `ui.chat_send(message)` (plain LLM) / `ui.chat_send_with(message, responder)`
  (your agent: `responder(message, history)` → text). History persists.
- Protect approval routes with the server's `requires auth` when the inbox is
  not for everyone; coded approvals (above) authenticate a decision that
  travels through an external channel.

## The canonical wiring (what `serve.syn` shows)

request (chat/webhook/cron) → agent with allow-listed tools → risky tool starts
a durable workflow → `approvals.gate` parks it in the inbox (`/inbox/ui`, the
console, or a coded link on any channel) → a human resolves → `cron_every`
heartbeat re-runs it → your `execute_action()` does the real work → everything
in the journal, money through treasury, tokens through limits.
