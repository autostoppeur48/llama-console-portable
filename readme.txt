==========================================================
 LLAMA CONSOLE — installation and usage guide
==========================================================

Self-contained local LLM studio: runs a llama.cpp server
+ a streaming chat. The engine, CUDA runtime and UI are included
in this folder; you only add a model (.gguf in models/) plus two
system things: Node.js and a GPU driver.

----------------------------------------------------------
 1) INSTALL BEFORE LAUNCHING
----------------------------------------------------------

 a) Node.js  (REQUIRED)
    - Version 18 or later (tested with 24).
    - Download: https://nodejs.org  (take the LTS)
    - Check: open a terminal and type:  node --version

 b) NVIDIA graphics card + driver  (recommended)
    - The backend\ folder already bundles the CUDA 12 runtime:
      NO need to install the CUDA Toolkit.
    - You only need a recent NVIDIA DRIVER
      (it provides the nvcuda.dll component).
    - Without NVIDIA: see section 4 (CPU / AMD).

 c) Windows
    - The app is Windows-only (llama-server.exe).

----------------------------------------------------------
 2) QUICK START
----------------------------------------------------------

 1. Double-click  start.bat
    -> a console opens (web UI) and the browser
       launches on  http://127.0.0.1:8787
 2. If models\ is empty: download a .gguf instruct model
    (e.g. Qwen3.8-27B-Q4_K_M.gguf, ~16 GB) and drop it in models\.
 3. Click the "Config" button (bottom right of the page).
 4. Click "Load model (terminal)".
    -> a terminal opens and loads the model (live logs).
 5. Go back to the main page and type in the input bar.

 Shutdown:
   - Closing the llama.cpp terminal = stops the model server.
   - Closing the start.bat console = stops the web UI.

----------------------------------------------------------
 3) SETTINGS ("Config" page + ⚙ Settings)
----------------------------------------------------------

 Default values = OPTIMIZED for Qwen3.8-27B (Q4_K_M) + RTX 3090
 24 GB (tested on this setup). If your machine differs, adjust
 below or via section 4.

 Setting               | Default   | To adjust
 ----------------------|-----------|-------------------------------------
 Model                 | Qwen3.8...| .gguf present in models/
 Context               | 131072    | lower if little RAM/VRAM (e.g. 32768)
 -ngl (GPU layers)     | 99        | 99 = all on GPU; 0 = all on CPU
 KV cache              | q4_0      | q4_0 = frugal; q8_0 = more precise
 Port                  | 1235      | llama.cpp server port
 Flash attention       | on        | CUDA only; "off" for CPU/AMD
 GPU monitoring        | checked   | uncheck if no NVIDIA

 Chat thresholds (main page, ⚙ Settings):
 max_tokens            | 16384     | max answer length (code not cut)
 temperature           | 0.7       | 0 = deterministic, 2 = creative
 Compaction threshold  | 80 %      | summarizes history at this % of context

 "Advanced settings" tab (Config page):
 Performance (server, at next Start):
   CPU threads         | 0 (auto)  | -t
   Batch threads       | -1 (auto) | -tb
   Batch size          | 4096      | -b (fast in 24 GB VRAM)
   Micro-batch         | 512       | -ub
   mmap                | checked   | memory-mapped loading
   mlock               | unchecked | lock in RAM
   Tensor split        | (empty)   | multi-GPU (e.g. 24,24)
   Split mode          | auto      | none/layer/row
   Main GPU            | -1 (auto) | --main-gpu
   no-kv-offload       | unchecked | KV cache on CPU
   warmup              | checked   | warm-up pass
   N-keep              | 0 (auto)  | --n-keep
   Timeout             | 600 s     | --timeout
   API key             | (empty)   | --api-key
 Reasoning:
   Reasoning format    | deepseek  | --reasoning-format (at next Start)
   Reasoning effort    | medium    | per request: none/low/medium/high/xhigh
 Sampling (immediate, no restart):
   Top-K               | -1 (auto) | -1 = let the model decide
   Top-P               | 0.95      | 0-1
   Min-P               | 0.05      | 0-1
   Typical-P           | 1 (off)   | 1 = disabled
   Repeat penalty      | 1.0       | 1 = neutral
   Repeat last N       | 64        | anti-repetition window
   Presence penalty    | 0.0       | -2 to 2
   Frequency penalty   | 0.0       | -2 to 2
   Mirostat            | off       | off/v1/v2
   Mirostat tau        | 5.0       |
   Mirostat eta        | 0.1       |
   Dynatemp range      | 0 (off)   | dynamic temperature
   Dynatemp exponent   | 1.0       |
   XTC probability     | 0 (off)   | excludes likely tokens
   XTC threshold       | 0.1       |
   Seed                | -1        | -1 = random; fixed = reproducible

----------------------------------------------------------
 4) ALTERNATIVE SETUPS (without NVIDIA)
----------------------------------------------------------

 CPU only:
   - In Config: -ngl = 0, Flash attention = "off",
     uncheck "GPU monitoring".
   - Smaller context recommended (16384 or 32768) depending on RAM.
   - Replace the content of the backend\ folder with a CPU build of
     llama.cpp (name like: llama.cpp-win-x86_64-avx2, no CUDA).
     The server will use that engine as-is.

 AMD / Intel (Vulkan):
   - Same idea: replace backend\ with a Vulkan build of
     llama.cpp (llama.cpp-win-x86_64-vulkan), adjusted -ngl,
     Flash attention = "off".

 The models stay the same (models/ folder), no change needed.

----------------------------------------------------------
 5) FOLDER CONTENTS
----------------------------------------------------------

 backend\     llama-server.exe + DLLs (CUDA, MSVC, OpenMP)  <- engine
 models\      the .gguf                                     <- models
 server.js    web server + chat proxy
 public\      the UI (pages + scripts)
 config.json  settings (paths + parameters)
 start.bat    double-click launcher
 readme.txt   this guide

 Total size: ~20 GB (mostly the models).

----------------------------------------------------------
 6) TROUBLESHOOTING
----------------------------------------------------------

 - "node is not recognized"  -> Node.js missing (section 1a).
 - The llama terminal opens then closes immediately
   -> read llama-server.log (at the root).
 - Slow answer or video memory error
   -> lower "Context" or set KV cache = q4_0.
 - GPU shown as "—"  -> NVIDIA driver missing, or uncheck/check
   "GPU monitoring".

----------------------------------------------------------
 7) SECURITY (100 % local)
----------------------------------------------------------

 This project is designed to run ONLY on the local machine.
 No remote connection is possible:

 - The llama.cpp server is launched with --host 127.0.0.1
   (local loopback only, not 0.0.0.0) -> unreachable
   from the network / internet.

 - The web UI listens on 127.0.0.1:8787 only.

 - An API key is generated automatically and stored in
   config.json. Inference (/v1/chat/completions) and /slots
   refuse any access without this key (401) -> a malicious
   website or external process cannot use the model.

 - The proxy (server.js) passes the key internally; it is
   never exposed to the browser.

 Note: /health and /v1/models stay public (simple status),
 but they give access to nothing sensitive and remain
 confined to the local machine.

----------------------------------------------------------
 8) AGENT MODE (the local coding agent)
----------------------------------------------------------

 The "🤖 Agent mode" (above the input bar) is checked
 by default: the model can ACT inside a workspace/ folder
 (created at the project root):

   - list / read / search (grep) ......... automatic
   - find files (glob) .................... automatic
   - write / edit / replace anything ...... automatic
   - move / rename (move_file) ............ automatic
   - delete a file (delete_file) .......... asks approval
   - step plan (set_plan) ................. automatic
     (it lists its steps and ticks them live)
   - shell (persistent) ................... asks approval
     (cd/variables kept; verification commands:
      node --check, git status, etc. = automatic)

 Approve / Reject: buttons appear in the chat when an action
 waits for your go-ahead.

 "⚡ Auto-approve": check this box so shell commands
 also run without asking.

 "📋 Plan mode": check this box so the agent PROPOSES a
 plan (read-only) and waits for your approval BEFORE writing
 or executing anything. "Approve"/"Edit" buttons.

 Security: the agent is CONFINED to workspace/ (absolute paths
 and ".." are refused). It does not touch the rest of the
 machine, except through a shell command that you approved
 yourself.

 Backup: at EACH task, the server automatically copies the
 whole workspace/ into backup/<date-time> (20 backups max).
 If the agent breaks a file, find it in that folder.
 The agent cannot touch it (outside workspace/).

 Tracing ("🔍 Trace changes" option): at every modification of
 a CODE file (.js, .py, .json...), the server keeps the old
 version in history/<date-time>/name.<date-time>.
 Precise history, never heavy/binary files.

 Memory: the agent automatically reads workspace/AGENTS.md at
 startup (your rules and conventions) and may update it to
 remember them for future sessions.

 Tip: for code, let the model verify itself
 (node --check) before returning the result to you — that is
 what avoids case-sensitivity bugs.
