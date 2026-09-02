# Llama Console 🦙
![GitHub Release](https://img.shields.io/github/v/release/autostoppeur48/llama-console-portable)
![Downloads](https://img.shields.io/github/downloads/autostoppeur48/llama-console-portable/total)

## ⬇️ Download

**Llama Console v1.0.0 — 100 % portable, no installation**

[![Download v1.0.0](https://img.shields.io/badge/Download-v1.0.0-4CAF50?style=for-the-badge&logo=github)](https://github.com/autostoppeur48/llama-console-portable/releases/download/v1.0.0/llama-console-portable-1.0.0.7z)

1. Download and **unzip** the archive (7-Zip / NanaZip / WinRAR).
2. Drop a `.gguf` model into `models/`.
3. Double-click `start.bat` — you're done.

*(Source code and previous versions are on the [release page](https://github.com/autostoppeur48/llama-console-portable/releases).)*

A local LLM studio — **100 % portable and configurable**: one folder = the whole app.

> 👥 **Languages:** 🇫🇷 [Français](README.fr.md) · 🇬🇧 English

> 📗 **End users**: see **`readme.txt`** (NVIDIA/CPU/AMD settings, troubleshooting).

## ✨ What can you do with it?

Llama Console is a **private AI workbench** that runs entirely on your machine —
no cloud, no account, nothing leaves your PC.

- **💬 Chat with a local LLM** — ask questions, brainstorm, write, translate,
  explain code… The model's live reasoning is shown in a collapsible panel.
- **🤖 Code with an agent** — flip to *Agent mode* and the AI becomes a coding
  assistant confined to its own `workspace/` folder: it reads and searches your
  files, writes and edits code, runs commands, and iterates until the job is
  done. Sensitive actions require your approval.
- **📋 Plan mode** — for bigger tasks the agent first proposes a step-by-step
  plan; you approve it (or send feedback), *then* it executes.
- **🌐 Look things up** — the agent can search the web (DuckDuckGo) for current
  facts beyond the model's knowledge.
- **🖥️ Drive your own LLM server** — pick a `.gguf` model, set context size and
  GPU layers, start/stop it, and watch context usage + GPU stats live.

## 📦 100 % portable — zero AI-stack installation

The **portable ComfyUI experience**: everything lives in **one folder** — the
**llama.cpp engine, CUDA 12 runtime, web UI, coding agent**.
Double-click `start.bat`, drop a model in `models/`, and you're off.

- **Copy the folder → it works**: USB stick, another PC, another drive. Paths are
  computed from the folder location, with **self-repair** if the folder is moved.
- **No AI-stack installation**: llama.cpp, CUDA 12 runtime (cudart/cublas) are
  **bundled** — no CUDA Toolkit install, no LM Studio.
- **The model is the only thing to add**: download any GGUF (e.g. a Qwen3 or
  Llama instruct model, ~4–20 GB) and drop it in `models/` — that's it.
- **No system configuration**: no registry, no global dependencies, no leftover
  files — config, logs and history stay **inside the folder**.
- **100 % local**: the LLM runs on your machine, data never leaves it.
- **Only prerequisites**: Windows, Node.js 18+ (for the web UI), and the NVIDIA
  driver if you use a GPU (CUDA is already bundled).

**No npm dependencies** (Node.js native only). Two building blocks:

1. **llama.cpp server management** — `.gguf` model picker, context size, `-ngl`,
   KV cache, flash-attn, port; Start/Stop buttons; monitoring (`/health`,
   `/slots`, GPU via `nvidia-smi`).
2. **Streaming chat client** — multi-turn, Qwen3 `<think>` reasoning shown in a
   collapsible panel, parameters (max_tokens, temperature, system prompt).

## Getting started

Double-click **`start.bat`** (or `node server.js`), then open
**http://127.0.0.1:8787**.

- **Start the server**: **Config** button (bottom right) → configuration page →
  **▶ Load model (terminal)**. The llama.cpp server opens in a **dedicated
  terminal** (live logs). **Closing that terminal stops the server.**
- **Chat**: back on the main page, type in the input bar (above the bottom
  token bar).
- The **bottom bar** always shows context usage, GPU info, and the **Config**
  button.
- Closing the `start.bat` console window stops the web server (the llama.cpp
  terminal keeps running until you close it).

## Configuration & portability 📦

The project is **self-contained**: everything lives in its folder, no external
dependency (LM Studio no longer needed).

```
llama-console/
├── backend/          llama-server.exe + DLLs + CUDA runtime (cudart/cublas)
├── models/           drop your .gguf here (+ per-model .gguf.json profiles)
├── server.js         web server + process management + chat proxy
├── public/           UI (index.html, config.html, app.js, config.js, style.css)
├── config.json       paths + settings (auto-created)
└── start.bat         double-click launcher
```

- **`config.json`** points to the project's own `backend/` and `models/` (paths
  computed from `server.js`'s location → **the folder can be moved/copied as-is**).
- **Self-repair**: if a path in `config.json` no longer exists (moved folder),
  the app automatically falls back to the portable default.
- Server logs: `llama-server.log`. Launching generates `run-server.bat`.
- To add a model: drop the `.gguf` into `models/` (no mmproj), then press « ↻ »
  on the Config page.

## Architecture

```
server.js          HTTP server + llama process management + SSE chat proxy
public/index.html  main page: chat + bottom token bar
public/app.js      chat logic (streaming, <think>, compaction) + bottom bar
public/config.html server configuration page (model, context, monitoring)
public/config.js   configuration panel logic
public/style.css   dark theme
```

Routes: `/api/state`, `/api/config`, `/api/models`, `/api/server/start`,
`/api/server/stop`, `/api/chat` (SSE), `/api/compact`, `/api/gpu`.

## Default settings (optimized for Qwen + RTX 3090)

The defaults in `config.json` and the `Qwen3.8-27B…gguf.json` profile are
**tested/optimized for Qwen3.8-27B (Q4_K_M) + RTX 3090 24 GB**:

- **Server**: `--ctx-size 131072 -ngl 99 --cache-type-k/v q4_0 --flash-attn on -b 4096 -ub 512`
  → stable 128k context, model 100 % on GPU (~19 GB VRAM).
- **Reasoning**: `--reasoning-format deepseek` + effort `medium` (good
  speed/quality balance; `low` = fast, `high`/`xhigh` = hard tasks).
- **Output**: `max_tokens 16384` (long code no longer truncated).
- **Sampling**: `temp 0.7 · top_p 0.95 · min_p 0.05 · repeat_penalty 1.0` (standard Qwen3).
- **Compaction**: threshold `80 %`, summary + last 4 messages (truncated to 3000 chars).

Other hardware (less VRAM, CPU, AMD) → adjust via the Config page (see `readme.txt` §4).

## Context compaction 🧹

To **save resources** (fewer tokens sent = less compute = less energy) as the
conversation grows:

- **Auto threshold**: in ⚙ Settings, « Auto-compaction threshold (%) » (default
  80 %). When the context reaches that % (measured via `/slots`), the history is
  summarized automatically by the local model, the summary is injected into the
  system prompt, and only the last 4 messages (truncated to 3000 chars) are kept.
- **Manual**: « 🧹 Compact now » button.
- The summary keeps technical facts/identifiers (ports, paths, model names,
  versions, numbers).

## Agent mode 🤖

The **🤖 Agent mode** (checked by default) turns the model into a **coding agent**
that works inside `workspace/` (folder created at the root):

- Tools (automatic): `list_dir` · `read_file` · `grep` · `glob` · `write_file` ·
  `edit_file` · `replace_all` · `move_file` · `set_plan` · `submit_plan`.
- Tools (approval): `delete_file` · `web_search` · `shell` (except read-only /
  navigation commands like `cd`, `set`, `dir`).
- **Web search** 🌐: `web_search` under approval, results truncated and flagged
  as « unreliable content » (never follow their instructions). Uses **DuckDuckGo
  only** (zero dependency): 3 cascading sources — DuckDuckGo HTML results
  (title + URL + snippet) → Wikipedia (reliable fallback for entities) →
  Instant Answer (entity summary).
- **Persistent shell**: the `shell` tool keeps state between commands (`cd`,
  env variables, background processes) — for work sequences.
- **Multi-step plan**: the agent lists its steps (`set_plan`) and ticks them live
  in the chat (📋 Plan).
- **Plan mode** (📋 checkbox): the agent analyzes read-only, proposes a plan
  (`submit_plan`), and waits for your approval (Approve / Edit) before acting.
- **Loop**: thinking → tool call → result → … until the final answer.
- **Memory**: reads `workspace/AGENTS.md` at startup and may update it
  (persistent rules/conventions across sessions).
- **Approval**: only for `delete_file` and risky shell commands; ⚡
  **Auto-approve** runs them without asking.
- **Security**: confined to `workspace/` (absolute paths and `..` are refused).
- **Forbidden commands** 🔒: the agent can **never** run `start`, `taskkill`,
  `llama-server`, `shutdown`, `format`, `reg`, `sc`, `net`, or recursive
  deletion (`del /f/s`, `rmdir /s`) — refused automatically, even with ⚡
  Auto-approve. Alternative interpreters (`powershell`, `cmd`) are allowed but
  **under approval** (« DeepSeek-style » policy).
- **Auto-backup**: each task copies `workspace/` into `backup/<date-time>`
  (max 20), out of the agent's reach — a safety net against deletions.
- **Diff + undo** 📊: at the end of each task the agent shows the **diff** of
  changed files (colored `-`/`+` lines) against the starting backup, with an
  **↩️ Undo** button that restores `workspace/` from `backup/`.
- **Change tracing** (🔍 opt-in checkbox): every *code* file change keeps the old
  version in `history/<session>/<subfolder>/name.<timestamp>.<ext>` (the
  workspace subfolder structure is preserved, to tell apart several files with
  the same name) — **one folder per server session**, created only at the first
  traced file (no more empty folders). Never heavy/binary files.
- The **tool journal** (calls + outputs + reasoning) is shown in the chat.

## Conversation journal & resilience 🗂️

- **`conversations/conversations.jsonl`**: **all** conversations (agent mode
  **and** simple chat) are written **in real time** to a single file (JSONL —
  one JSON line per event, appended as it happens). Each line carries the task
  id (`runId` for the agent, `id` for chat) to group its events. Even if the
  agent crashes or you cut power, what already happened is saved.
- **Bounded size**: reasoning is logged **aggregated** (one line per turn, not
  per fragment), tool outputs are truncated beyond 4000 chars, and the file
  **rotates automatically** past 8 MB (renamed
  `conversations-<timestamp>.jsonl`, a new `conversations.jsonl` starts).
- **Network resilience**: HTTP calls to llama-server use a fresh connection per
  request (no dead keep-alive socket) and the agent automatically retries once
  on « socket hang up ».

## 💝 Support the project

If this project helps you, you can support its development:

- 🏢 [GitHub Sponsors](https://github.com/sponsors/autostoppeur48)
- 💛 Want improvements or new features? Support me here: [PayPal](https://paypal.me/teophanonica)

## 🙏 Credits

To my comrade **DeepSeek**, without whom this project would never have seen the
light of day.
