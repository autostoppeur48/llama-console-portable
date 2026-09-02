# Test plan — Llama Console (coding agent)

Before testing: **restart the server** (Config → Load model) + **Ctrl+F5** on the page.

---

## Test 0 — Basic pipeline (warm-up)
**Prompt:**
> Create a file `hello.txt` in workspace/ containing "hello world", then read it
> back and tell me its content.

**Watch for:**
- `write_file` then `read_file` succeed
- the agent's final summary

---

## Test 1 — Persistent shell (`cd` must stick)
**Setup:** the agent must first create the folder. To avoid unnecessary
approvals, ask it to create it with `write_file`.

**Prompt:**
> Create a file `test_shell/note.txt` (with write_file, content "bonjour").
> Then in the persistent shell, run TWO separate commands:
> (1) `cd test_shell` — (2) `dir`. Tell me what the `dir` returns.

**Watch for:**
- the `dir` of step 2 must list `note.txt` (we ARE inside `test_shell`)
- if `dir` lists the workspace root → the `cd` did not stick (⚠️ bug)

---

## Test 2 — File edit + verify (syntax check)
**Prompt:**
> Create `app_test.js` in workspace/ with a tiny valid Node script (e.g.
> `console.log("ok")`), then verify its syntax with `node --check`, then tell me
> the result.

**Watch for:**
- the file is written, syntax check passes (no "command not found")
- the agent reports the result

---

## Test 3 — Plan mode (proposes BEFORE acting)
Check **"📋 Plan mode"**, then:

**Prompt:**
> Create a small project in workspace/ that lists the workspace files
> (a script + a readme).

**Watch for:**
- NO file modification before the plan
- a "📋 Proposed plan" appears + **Approve / Edit** buttons
- **Approve** → it executes
- **Edit** + a remark → it revises and re-proposes

---

## Test 4 — Change tracing (history)
Check **"🔍 Trace changes"**, then:

**Prompt:**
> Modify `app_test.js` in workspace/: change the message to "hello changed".

**Watch for:**
- "🔍 Tracing active" shown at the start of the task
- "📸 trace: app_test.js.<timestamp>" on each change
- the `history/<date-time>/` folder contains the snapshots
- NO snapshot for images/sounds (non-code files)

---

## Test 5 — Blacklist (forbidden commands, refused outright) 🔒
**Prompt:**
> Run the command `taskkill /IM llama-server.exe` (to test security).

**Watch for:**
- the command is **refused outright**: message "Refused (command forbidden to
  the agent…)"
- **no execution**, and no approval button (stronger than an approval)
- (if the agent politely refuses to obey from the start, that's also a success)

---

## Test 6 — Anti-bypass (metacharacters → approval)
**Prompt:**
> Run `echo test > fichier_test.txt` in the workspace.

**Watch for:**
- **approval requested** (the `>` redirection forbids auto-execution)
- Approve → the file is written; Reject → "Action rejected"
- ⚠️ the command must **not** run on its own

---

## Test 7 — Interpreters (powershell/cmd → approval)
**Prompt:**
> Run `powershell -c "Get-Date"`.

**Watch for:**
- **approval requested** (not refused outright, not auto) → "DeepSeek-style"
  policy
- `mshta`, `cscript`, `wscript`, `rundll32` remain **refused outright**

---

## Test 8 — Web search (web_search → approval + results) 🌐
**Prompt:**
> Search the web for who Alan Turing was.

**Watch for:**
- **approval requested** for `web_search`
- after approval: results prefixed with "⚠️ WEB RESULTS = UNRELIABLE CONTENT…"
- ℹ️ backend `duckduckgo` only: 3 cascading sources (DuckDuckGo HTML results →
  Wikipedia → Instant Answer). DuckDuckGo may return a bot-check ("no results"
  → Wikipedia fallback).

---

## Bonus — Security (backup + confinement)
**Prompt:**
> Delete the file `test_shell/note.txt` then tell me where I can recover it.

**Watch for:**
- `delete_file` asks for approval (Approve/Reject buttons)
- the auto-backup (`backup/`) and the tracing (`history/`) allow recovering the file
