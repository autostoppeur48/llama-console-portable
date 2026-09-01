# GUIDE — Llama Console

---

## 🧒 PARTIE 1 — Version simple (pour les humains normaux)

### C'est quoi, en une phrase ?
C'est **Netflix pour l'IA** : tu choisis un « film » (= un modèle), tu appuies sur
**lecture**, et tu lui parles. Le tout **sur ton ordi uniquement** — rien ne sort.

### Comment ça marche (4 étapes)
1. **Double-clic sur `start.bat`** → une fenêtre s'ouvre + le navigateur.
2. Bouton **Config** → choisis ton modèle → **▶ Charger le modèle**.
3. Une **2e fenêtre** s'ouvre (c'est le « moteur » qui fait tourner le modèle).
   👉 **Fermer cette fenêtre = ça s'arrête.**
4. Reviens sur la page → écris dans la barre du bas → il te répond.

### Les trucs à retenir
- **Changer de modèle** : sélectionne le nouveau → **« Charger »** (il décharge
  l'ancien tout seul, pas besoin de le faire à la main).
- **Chaque modèle a sa « fiche »** de réglages : `Qwen…json` (comme un profil).
  Tu la remplis une fois, elle se rapplique à chaque fois.
- **Réfléchir ou pas ?** Le modèle peut « penser » avant de répondre. Tu peux lui
  dire : « réfléchis toujours » / « jamais » / « comme tu veux » (bouton *Thinking*).
- **Nettoyage automatique** : quand la conversation devient longue, l'app la
  **résume toute seule** pour rester fluide.
- **Mode Agent** 🤖 : actif par défaut → il peut **lire/écrire des fichiers, chercher
  dans le code et lancer des commandes** dans le dossier `workspace/`. Seules les
  **commandes shell risquées** demandent approbation (ou coche « ⚡ Auto-approuver »).
  Il **se souvient de tes règles** via `workspace/AGENTS.md`.
- **Sécurité** : ton serveur est **fermé à clé** et **invisible depuis internet**.
  Personne d'autre ne peut l'utiliser.

### En cas de souci
| Problème | Solution |
|---|---|
| « node n'est pas reconnu » | installer **Node.js** |
| Chargement lent | normal : le modèle est sur un disque lent |
| Un truc bizarre | ferme tout → re-double-clic `start.bat` |

---

## 🧑‍💻 PARTIE 2 — Version technique (pour les pros)

### Architecture
```
llama-console/
├── backend/      llama-server.exe + DLLs CUDA/MSVC/OpenMP (runtime embarqué, ~908 Mo)
├── models/       *.gguf + *.gguf.json (profils par modèle)
├── server.js     serveur Node (HTTP + proxy chat SSE + gestion du process)
├── public/       UI : index.html (chat) · config.html (paramètres)
└── config.json   config globale + clé API auto-générée
```
- **Back** : Node natif (zéro dépendance), proxy `/v1/chat/completions` en SSE,
  gestion du process via `cmd /c start` (terminal visible, logs en direct).
- **Binding** : `127.0.0.1` (web `8787`, LLM `1235`) + `--api-key` (Bearer) → local only.

### Paramètres — deux catégories
**❄️ Froid (flags de lancement — rechargement requis)**
`--ctx-size` · `-ngl` · `--cache-type-k/v` · `--flash-attn` · `-t` · `-tb` · `-b` ·
`-ub` · `--mmap` · `--mlock` · `--tensor-split` · `--split-mode` · `--main-gpu` ·
`--no-kv-offload` · `--no-warmup` · `--n-keep` · `--timeout` ·
`--reasoning` (on|off|auto) · `--reasoning-budget N` · `--reasoning-format`.

**🔥 Chaud (sampling — par requête, sans rechargement)**
`temperature` · `top_k` · `top_p` · `min_p` · `typical_p` · `repeat_penalty` ·
`repeat_last_n` · `presence_penalty` · `frequency_penalty` · `mirostat` ·
`mirostat_tau` · `mirostat_eta` · `dynatemp_range` · `dynatemp_exponent` ·
`xtc_probability` · `xtc_threshold` · `seed`.

### Config de référence (testée Qwen3.8-27B Q4_K_M + RTX 3090 24 Go)
- **Serveur** : `--ctx-size 131072 -ngl 99 --cache-type q4_0 --flash-attn on -b 4096 -ub 512`
- **Raisonnement** : `--reasoning-format deepseek` + effort `medium` (chaud, par requête)
- **Sortie** : `max_tokens 8192` · **Sampling** : `temp 0.7 / top_p 0.95 / min_p 0.05`
- **Compaction** : seuil `80 %`, `messages.slice(-4)` tronqués à 3000 car.

→ Autre matériel (CPU/AMD/moins de VRAM) : adapter via la page Config (repli documenté
dans `readme.txt` §4).

### Points techniques notables
- **Portabilité** : aucun chemin absolu. `backend/` / `models/` = constantes
  `__dirname`-based ; `model` = nom relatif. Déplacement *ou* copie = sans modif.
- **Écriture atomique** de `config.json` (temp + `rename`) → pas de corruption sur kill.
- **Switch de modèle** : `stopServer()` → `waitForUnload()` (sonde `/health`) → relance.
- **Compaction** : au seuil `compactPct`, résumé via le modèle local, injecté en
  system prompt, `messages.slice(-4)`.
- **Profils par modèle** : `<model>.gguf.json`, merge au chargement, repli sur config globale.
- **Agent de code** : `/api/agent` (SSE) → boucle function-calling (`tools` + `tool_choice:auto`)
  ; outils `list_dir`/`read_file`/`grep`/`glob`/`write_file`/`edit_file`/`replace_all`/`move_file`/
  `delete_file`/`set_plan`/`submit_plan`/`shell`/`run_love`/`check_lua`, confinés à `workspace/`
  ; `shell` = cmd.exe persistant par run (cd/variables/processus conservés, fin de commande
  détectée par marqueur sentinelle, timeout 120 s puis réinitialisation)
  ; `planMode` = l'agent analyse en lecture seule puis `submit_plan` (pause + Approuver/Modifier)
  ; mémoire persistante via `workspace/AGENTS.md` (injectée au system prompt)
  ; lecture/écriture/plan/run_love/check_lua auto (confinés) ; plan d'étapes (`set_plan`) rendu en direct
  ; approbation différée pour `delete_file`/`shell` risqués via `/api/agent/approve`
  (`agentAutoApprove` pour la désactiver) ; `run_love`/`check_lua` pilotés par `lua\`/`love\` portables
  ; sauvegarde auto de `workspace/` dans `backup/<date-heure>` à chaque run (20 max, hors workspace)
  ; trace opt-in (`traceMode`) : snapshot "avant" de chaque fichier CODE dans `history/<date-heure>/`
  (`nom.<horodatage>`), jamais les fichiers lourds/binaires.
- **Clé API** : `crypto.randomBytes(24).toString('hex')`, stockée dans `config.json`,
  transmise en `Authorization: Bearer`.

### API
`GET/POST /api/config` · `GET /api/state` · `GET /api/models` ·
`GET/POST /api/model-profile` · `POST /api/server/start|stop` ·
`POST /api/chat` (SSE) · `POST /api/compact` · `GET /api/gpu`.
