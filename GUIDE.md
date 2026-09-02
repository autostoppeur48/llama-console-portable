# GUIDE — Llama Console

---

## 🧒 PART 1 — Simple version (for normal humans)

### What is it, in one sentence?
It's **Netflix for AI**: you pick a "movie" (= a model), press **play**, and you
talk to it. All **on your computer only** — nothing leaves it.

### How it works (4 steps)
1. **Double-click `start.bat`** → a window opens + the browser.
2. **Config** button → pick your model → **▶ Load model**.
3. A **2nd window** opens (that's the "engine" running the model).
   👉 **Closing that window = it stops.**
4. Back on the page → type in the bottom bar → it answers.

### Things to remember
- **Switching models**: select the new one → press **"Load"** (it unloads the
  old one by itself, no need to do it manually).
- **Each model has its own "profile"** of settings: `Qwen…json` (like a preset).
  Fill it once, it comes back every time.
- **Think or not?** The model can "think" before answering. You can tell it:
  "always think" / "never" / "as you wish" (*Thinking* button).
- **Automatic cleanup**: when the conversation gets long, the app **summarizes
  it on its own** to stay fluid.
- **Agent mode** 🤖: active by default → it can **read/write files, search code
  and run commands** inside the `workspace/` folder. Only **risky shell
  commands** ask for approval (or check "⚡ Auto-approve").
  It **remembers your rules** via `workspace/AGENTS.md`.
- **Security**: your server is **locked down** and **invisible from the
  internet**. Nobody else can use it.

### If something goes wrong
| Problem | Solution |
|---|---|
| "node is not recognized" | install **Node.js** |
| Slow loading | normal: the model is on a slow disk |
| Something weird | close everything → re-double-click `start.bat` |

---

## 🧑‍💻 PART 2 — Technical version (for pros)

### Architecture
```
llama-console/
├── backend/      llama-server.exe + CUDA/MSVC/OpenMP DLLs (bundled runtime, ~908 MB)
├── models/       *.gguf + *.gguf.json (per-model profiles)
├── server.js     Node server (HTTP + SSE chat proxy + process management)
├── public/       UI: index.html (chat) · config.html (settings)
└── config.json   global config + auto-generated API key
```
- **Backend**: native Node (zero dependency), SSE proxy for
  `/v1/chat/completions`, process management via `cmd /c start` (visible
  terminal, live logs).
- **Binding**: `127.0.0.1` (web `8787`, LLM `1235`) + `--api-key` (Bearer) → local only.

### Settings — two categories
**❄️ Cold (launch flags — reload required)**
`--ctx-size` · `-ngl` · `--cache-type-k/v` · `--flash-attn` · `-t` · `-tb` · `-b` ·
`-ub` · `--mmap` · `--mlock` · `--tensor-split` · `--split-mode` · `--main-gpu` ·
`--no-kv-offload` · `--no-warmup` · `--n-keep` · `--timeout` ·
`--reasoning` (on|off|auto) · `--reasoning-budget N` · `--reasoning-format`.

**🔥 Hot (sampling — per request, no reload)**
`temperature` · `top_k` · `top_p` · `min_p` · `typical_p` · `repeat_penalty` ·
`repeat_last_n` · `presence_penalty` · `frequency_penalty` · `mirostat` ·
`mirostat_tau` · `mirostat_eta` · `dynatemp_range` · `dynatemp_exponent` ·
`xtc_probability` · `xtc_threshold` · `seed`.

### Reference config (tested Qwen3.8-27B Q4_K_M + RTX 3090 24 GB)
- **Server**: `--ctx-size 131072 -ngl 99 --cache-type q4_0 --flash-attn on -b 4096 -ub 512`
- **Reasoning**: `--reasoning-format deepseek` + effort `medium` (hot, per request)
- **Output**: `max_tokens 16384` · **Sampling**: `temp 0.7 / top_p 0.95 / min_p 0.05`
- **Compaction**: threshold `80 %`, `messages.slice(-4)` truncated to 3000 chars.

→ Other hardware (CPU/AMD/less VRAM): adjust via the Config page (documented
fallback in `readme.txt` §4).

### Notable technical points
- **Portability**: no absolute paths. `backend/` / `models/` are `__dirname`-based
  constants; `model` = relative name. Move *or* copy = no modification needed.
- **Atomic writes** of `config.json` (temp + `rename`) → no corruption on kill.
- **Model switching**: `stopServer()` → `waitForUnload()` (`/health` probe) → restart.
- **Compaction**: at the `compactPct` threshold, summarized via the local model,
  injected into the system prompt, `messages.slice(-4)`.
- **Per-model profiles**: `<model>.gguf.json`, merged at load, falls back to the
  global config.
- **Coding agent**: `/api/agent` (SSE) → function-calling loop (`tools` +
  `tool_choice:auto`); tools `list_dir`/`read_file`/`grep`/`glob`/`write_file`/
  `edit_file`/`replace_all`/`move_file`/`delete_file`/`set_plan`/`submit_plan`/
  `shell`, confined to `workspace/`; `shell` = persistent cmd.exe per run
  (cd/variables/processes kept, command end detected via sentinel marker,
  120 s timeout then reset); `planMode` = the agent analyzes read-only then
  `submit_plan` (pause + Approve/Edit); persistent memory via
  `workspace/AGENTS.md` (injected into the system prompt); reads/writes/plan
  automatic (confined); step plan (`set_plan`) rendered live; deferred approval
  for risky `delete_file`/`shell` via `/api/agent/approve`
  (`agentAutoApprove` to disable it); automatic backup of `workspace/` into
  `backup/<date-time>` at each run (20 max, outside workspace); opt-in tracing
  (`traceMode`): "before" snapshot of each CODE file in `history/<date-time>/`
  (`name.<timestamp>`), never heavy/binary files.
- **API key**: `crypto.randomBytes(24).toString('hex')`, stored in `config.json`,
  sent as `Authorization: Bearer`.

### API
`GET/POST /api/config` · `GET /api/state` · `GET /api/models` ·
`GET/POST /api/model-profile` · `POST /api/server/start|stop` ·
`POST /api/chat` (SSE) · `POST /api/compact` · `GET /api/gpu`.
