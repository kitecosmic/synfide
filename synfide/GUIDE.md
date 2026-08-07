# Synfide — guide for AI agents (and humans in a hurry)

You are reading the canonical, version-pinned reference for the Synfide framework.
It ships INSIDE every project (`synfide/GUIDE.md`) and updates with the framework,
so it always matches the code next to it. The language underneath is **Synsema**:
learn it from its skill (`curl -sL https://raw.githubusercontent.com/kitecosmic/synsema/main/install-skill.sh | bash`)
and docs MCP (`claude mcp add --transport http synsema-docs https://docs.synsema.com/mcp`).
This file covers what those do NOT: the framework's packages, contracts and rules.

## The golden rules

1. **A file is the framework's or the user's, never both.** Framework files
   live under `synfide/` (including `synfide/console.syn` and
   `synfide/tests.syn`) and update freely on upgrade — never edit them; to
   change one, copy it to your folder (e.g. `mylib/`) and import yours. User
   files (`app.syn`, `serve.syn`, `AGENTS.md`, `.env`) are created once and
   are yours from second zero. The `patches` package enforces the synfide/
   side in code: a proposed patch can never target `synfide/`.
2. **Packages never declare top-level capabilities.** The ENTRY file (your
   `serve.syn` / `app.syn`) declares everything: `require memory("name")`,
   `require serve(PORT)`, `require time`, `require llm`, `require net(...)`,
   `require spend(...)`, `require random` — whatever the features you use need.
   One memory name per program; entries sharing a name share state.
3. **Generic packages, neutral scaffold, opinionated examples.** Domain logic
   goes in the user's files, never into the framework.
4. **Synsema end to end; HTML/CSS/JS only for the frontend.** Everything the
   framework promises — deny-by-default capabilities, sealed secrets, the
   approval inbox, the audit journal, spend ceilings, the sandbox verify loop —
   is a property of the Synsema RUNTIME: code in another language runs outside
   all of it (ambient authority, unsealed `.env`, no inbox, no audit). App
   logic is `.syn`; HTML/CSS/JS serve the browser side (`render()` templates,
   static assets). Another backend language is a HUMAN decision made explicit
   in a diff that grants `require exec(...)` — never an agent's silent
   default. Tooling for agents: the scaffold ships `.mcp.json` (official docs
   MCP: search/get pages + sandbox-verify snippets); the machine-level skill
   installs with the one-liner at the top of this file.
5. Update/install: `synsema init --synfide` (re-run to upgrade — user files are
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
- An exported task SHADOWS a same-named builtin INSIDE its own module: export a
  task named `apply` and the builtin `apply(list, fn)` is gone in that file
  (callers are fine — they say `mod.apply`). Loop instead, or rename.
- `grep(dir, ...)` needs the DIRECTORY itself in the file scope, not just its
  files: `require file.read("./logs")` AND `file.read("./logs/*")`.
- `slice` is Python-style: 0-based start, end-exclusive.
- Cron is LANGUAGE-level, not a package: `cron_every(seconds, task)` /
  `cron_after(seconds, task)` / `cron_list()` / `cron_cancel(name)` — fixed
  delay between END of one run and start of the next (not wall-clock cron);
  jobs live under `synsema serve` (or `run` while the program stays alive).
- Run tests with fresh dirs: `SYNSEMA_STATE_DIR=$(mktemp -d) SYNSEMA_AUDIT_DIR=$(mktemp -d) synsema test synfide/tests.syn`.

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
- **`agent.operator(question, domain_tools, domain_catalog,
  domain_instructions, history, max_steps = 4)` — the OPERATOR baseline.**
  `respond()` over your domain PLUS the framework's floor: the Synsema
  docs/sandbox tools (`synsema_docs/page/example/run/verify`, the in-app twin
  of the docs MCP — same server, spoken by `synfide/docs.syn`) and the
  standing rule "you don't know Synsema from training — search, read,
  verify". This is what the dashboard chat should run (the scaffold's
  `chat_agent` is one line over it): the entry carries ONLY domain, the
  baseline updates with the framework, and replacing your TOOLS never makes
  the agent unlearn the language. On a name collision your tool wins. Entry
  cap: `require net("docs.synsema.com")`. With no domain at all
  (`{}, [], ""`) it is still an agent that can learn Synsema — that's the
  dispatcher's default responder when CONFIG has none. `respond()` stays
  baseline-free for agents that shouldn't carry docs tools (a future
  customer-facing agent). Also exported: `base_catalog()`,
  `base_instructions()`, `operator_tools/operator_catalog(domain)`. The
  baseline instructions demand AUTONOMY (build now, report what you DID,
  never paste project code into the chat as the deliverable) — and when the
  domain wires a `propose_patch` tool, operator() appends the patching
  discipline automatically (never mention tools that don't exist).
- **`agent.patch_flow(path, old, new, why, guidelines = "")` — the agent's
  HANDS, safely.** One call runs the whole chain for one file change:
  `patches.propose` (records intent, touches nothing) → `patches.audit` with
  the adversarial `llm_auditor` (rejected → the flow STOPS and returns the
  reasons to the model) → a durable workflow (`"patch-<id>"`) parks at the
  human gate in the approvals inbox, diff included. The entry's heartbeat
  ticks `{"prefix": "patch-", "steps": agent.patch_steps()}`, so a human
  approval auto-applies with the entry's ambient file scope. The FLOW is
  framework-owned; the POWER stays in the entry: a thin wrapper tool
  declares `memory`/`time`/`llm` (call_tool least-privilege) and the entry
  grants the file scope patches may land in (scaffold default:
  `require file("./site/*")`). An empty `old` counts as CREATE (models say
  "" where the contract says nothing). `agent.patches_summary()` → one line
  per proposal for the agent's list tool.

### patches — self-modification with a seatbelt (needs: memory, time; apply: file.write scope; llm_auditor: llm)
- The loop the framework packages: an agent PROPOSES an exact change to one of
  YOUR files, an independent AUDITOR passes a verdict, only audited-ok patches
  APPLY — optionally after a human gate. Every transition journaled. A patch
  can NEVER target `synfide/` (hard-refused, Windows backslashes included).
- `patches.propose(id, path, old, new, why)` → record (idempotent; touches no
  file). EDIT: `old` = exact unique text in the file, `new` = replacement.
  CREATE: `old` = nothing → apply() creates `path` with content `new`,
  refusing if the file exists (a create never overwrites). This is how the
  agent GROWS the app: a new index.html, pages/presupuestos.html,
  whatsapp.syn — whatever the entry's file scope allows. A new `.syn` module
  runs only once your entry `use`s it (and restarts); a template or data file
  an existing route reads is live immediately. Creates also need `file.read`
  (the existence check) — grant `require file("./pages/*")` for read+write.
- `patches.audit(id, auditor, guidelines)` → record with status "audited-ok" /
  "audited-no". `auditor(patch, guidelines)` must give `{approved, reasons}`.
  Applied patches refuse re-audit; rejected ones may be re-audited.
- `patches.llm_auditor` → ready-made ADVERSARIAL auditor (a second model call,
  instructed to reject when in doubt): `patches.audit(id, patches.llm_auditor, "your rules")`.
- `patches.gate(id)` → human gate for a durable step: parks "patch-<id>" in the
  inbox with the full before/after. Once a gate exists, apply() refuses until
  it is approved — the interlock holds from any call site.
- `patches.apply(id)` → re-checks everything (audited-ok + gate approved if
  present), then `edit_file` (atomic, exact-match) under the ENTRY's
  `file.write` scope. Old text no longer matches → "apply-failed", journaled,
  re-raised. Re-apply of an applied patch is a no-op.
- `patches.get(id)` / `patches.proposals()` / `patches.diff_text(patch)`.
- A file read at REQUEST time (instructions, prompts, config) changes behavior
  live after apply — no restart. See `example_evolve.syn` for the full
  executor + auditor + cron loop.

### docs — the agent's Synsema knowledge (needs: net("docs.synsema.com"))
- LLMs don't know Synsema from training. This is a client for the OFFICIAL
  docs MCP server (the same one coding agents add with `claude mcp add`),
  exposed as plain tasks to wire as agent tools — the scaffold's serve.syn
  wires them as `synsema_docs` / `synsema_page` / `synsema_verify`.
- `docs.search(query)` → matching doc pages (slug — title — description).
  `docs.get_page(slug)` → one page as Markdown. `docs.get_example(id)` → a
  doctested .syn example.
- `docs.sandbox_run(code)` / `docs.sandbox_test(code)` → run a snippet (or
  its `test` blocks) in the official sandbox — no exec, no real net. The
  combo with patches: search docs → draft .syn → `sandbox_test` until green →
  ONLY THEN `patches.propose` — the auditor and your gate still stand
  between the draft and your disk.

### ui — the human surfaces (needs: memory, time, serve; llm for chat)
- An ADMIN, laid out the way Django's admin taught everyone to read one:
  branding band, live trust strip, breadcrumbs, section sidebar (with a
  pending-approvals badge), captioned modules. Built the Synsema way:
  `render()` templates + static assets. The markup lives in `synfide/ui/`
  (layouts/base.html, pages/{home,inbox,workflows,journal,patches,patch,chat}.html)
  and the CSS/JS in `synfide/ui/static/`. The module only builds data maps.
  The CSS/JS are served BY the dispatcher itself (whitelisted names under
  /synfide-ui/ — a `static` mount would be shadowed by the `GET /*path`
  catch-all, since declared routes beat static). The ENTRY declares:
      require file.read("./synfide/ui/static/*")
- **The boundary rule made real — THREE routes serve everything.** The user's
  entry never carries framework wiring: `ui.admin_get(path, request, query,
  CONFIG)` + `ui.admin_post(path, request, CONFIG)` behind `GET /`,
  `GET /*path` and `POST /*path` dispatch the WHOLE surface — dashboard,
  chat, approvals inbox, workflows, patches (+detail), journal, env,
  endpoints, setup/login/logout, `/llms.txt`, and the JSON API (`/inbox`,
  `/inbox/:id` — session OR bearer). Route precedence is by specificity, so
  the user's own routes always win. New framework pages in future releases
  appear WITHOUT touching the user's entry.
- CONFIG (all keys optional): `responder` (chat agent task; ABSENT → the
  dispatcher runs `agent.operator` with zero domain, so even the bare chat
  can learn Synsema), `env_vars`
  (extra names), `env_editable` (bool), `api_docs` (endpoint doc strings →
  endpoints page + llms.txt), `about` (llms.txt title), `open` (bool — DEMO
  mode, no login; local examples only).
- Individual pages remain exported for custom wiring (`home_page()`,
  `inbox_page()`, `workflows_page()`, `journal_page()`, `patches_page()`,
  `patch_page(id)`, `env_page(names, editable)`, `endpoints_page(api_docs)`,
  `chat_page()` — each → HTML text, wrap in `html(...)`).
- **Environment, write-only:** `env_page(names, editable)` shows each
  variable as set / not set — probed via SEALED `secret()`, values never
  enter program space and are NEVER displayed. With `editable`, a value can
  be SET: typed into a password field (shows ●●●), sent once as JSON, written
  atomically to `./.env` (single-line validated — a newline would smuggle
  extra variables), and never echoed back. Every save needs a one-time code
  from `env_code_request()` that is printed ONLY to the server terminal
  (proves console access; unforgeable cross-site; single use, 10 min, burned
  on use — `constant_time_eq`). Entry caps: `require secret` + `require
  random` + `require file("./.env")`. Restart to apply; `synsema llm status`
  diagnoses LLM wiring. **New variables from the dashboard:** the /admin/env
  list is the union of `./.env.example`, `./.env` itself, the release's
  KNOWN_VARS and CONFIG `env_vars` — and with `env_editable` the form also
  CREATES variables the list never heard of (your Supabase, your WABA, any
  custom API): any `UPPER_SNAKE_CASE` name (`[A-Z][A-Z0-9_]{0,63}`), same
  one-time code, lands in `.env` and keeps showing from then on
  (`env_set(body, allowed, allow_new)` — the dispatcher passes
  `env_editable` as `allow_new`).
- **Upgrade leftovers banner:** every admin page warns when the installer
  left `<file>.new` companions in the project root (a release changed a user
  file that had local edits — the user's copy is KEPT, the release's lands
  beside it). `ui.upgrade_leftovers()` lists them via `list_dir(".")`; the
  ENTRY declares `require file.read(".")` (the directory NODE only — names,
  never contents). Without the cap the probe silently reports none, so older
  entries keep working; add the line to get the banner. Merge (or ask the
  agent to propose the merge as a patch), then DELETE the `.new` file to
  dismiss.
- The chat composer is a textarea: Enter sends, Shift+Enter makes a new line;
  messages render with newlines preserved (pre-wrap).
- List pages auto-refresh but never while a field has focus; patch diffs and
  multi-line approval messages render as scrollable monospace blocks. Every
  template hole is auto-escaped by `render()`; `{ raw }` is never used.
- **Auth (engine v0.5.6+): first-run superadmin + real sessions.** No users →
  every guarded page redirects to `/setup`: choose a username, type the
  password twice → superadmin, argon2id-hashed (`password_hash`), signed in.
  Then `/login` → `token()` session id → HttpOnly SameSite=Lax cookie (7d).
  API: `ui.authenticate(token, request)` is the ONE `auth with` task — bearer
  `SYNFIDE_ADMIN_TOKEN` (sealed, constant-time) for scripts, cookie for
  humans. Pattern per browser route: `let g be ui.guard(request)` → redirect
  or nothing; JSON routes use `ui.guard_api(request)` (401). Auth surface:
  `users_exist` `create_first_admin` `login_check` `session_start/user/end`
  `setup_page/submit` `login_page/submit` `logout`. Decisions post JSON
  (`resolve_json`) — cross-site forms can't forge them (Lax + preflight).
  Rate-limit the login route (`rate_limit 5 per minute`). Coded approvals
  (`approvals.protect`) still authorize single decisions from ANY channel.
  Never pass credentials in query params. The FIRST-RUN race is closed by
  `setup_code()`: /setup demands a code printed only on the server terminal,
  so `synsema serve serve.syn` is safe as-is even on an open bind. Remote
  access needs TLS anyway (the session cookie is Secure: browsers send it
  only over HTTPS or localhost — engine `tls auto` or your proxy).
  `--bind 127.0.0.1` is optional extra hardening, not a requirement.
- To restyle: don't edit `synfide/` — copy the template(s) into your folder,
  mount your own static dir, render your copies from your own routes
  (`render()` is a language builtin; the framework adds nothing in between).
- **`ui.static_file(dir, relpath)` — user content served through a declared
  route** (an engine `static` mount can't work behind the catch-alls).
  Traversal-proof (backslashes normalized, `..` refused), `""`/trailing-`/`
  → `index.html`, content type by extension, binary-safe (png/jpg/ico/webp
  via `read_file_bytes` + `binary()`). The scaffold wires `GET /site` +
  `GET /site/*path` over `./site` — the agent's patch workspace is LIVE the
  moment a patch applies, no entry edit, no restart.
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

And the self-improvement loop on top (`example_evolve.syn` shows it end to
end): `cron_every` wakes an EXECUTOR → it reads recent conversation/journal →
`patches.propose` an exact change to ITS OWN instruction/config files — or a
NEW file: a page, a template, a module (scoped by the entry's file caps;
never `synfide/`) → an independent AUDITOR
(`patches.llm_auditor` or your rules) approves or rejects → optionally
`patches.gate` parks it for a human → `patches.apply` lands it atomically →
files read at request time make the change live without a restart.
