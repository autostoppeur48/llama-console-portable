# Llama Console 🦙

Studio LLM local autonome — une base de « concurrent de Bionic LM Studio ».

> 👥 **Utilisateurs finaux** : voir **`readme.txt`** (installation, réglages pour
> NVIDIA/CPU/AMD, dépannage).

**Zero dépendance** (Node.js natif uniquement). Deux briques :

1. **Gestion du serveur llama.cpp** — choix du modèle `.gguf`, contexte, `-ngl`,
   KV cache, flash-attn, port ; boutons Démarrer/Arrêter ; monitoring
   (`/health`, `/slots`, GPU via `nvidia-smi`).
2. **Client de chat streaming** — multi-tours, affichage du raisonnement
   `<think>` de Qwen3 dans un volet repliable, paramètres (max_tokens,
   temperature, system prompt).

## Lancer

Double-clic **`start.bat`** (ou `node server.js`), puis ouvre
**http://127.0.0.1:8787**.

- **Démarrer le serveur** : bouton **Config** (en bas à droite) → page de
  configuration → **▶ Démarrer (terminal)**. Le serveur llama.cpp s'ouvre dans un
  **terminal dédié** (logs en direct). **Fermer ce terminal = arrêter le serveur.**
- **Discuter** : revenir sur la page principale, taper dans la barre d'input
  (au-dessus de la barre de tokens du bas).
- La **barre du bas** affiche en permanence le remplissage du contexte, les infos
  GPU, et le bouton **Config**.
- Fermer la fenêtre console de `start.bat` arrête le serveur web (le terminal
  llama.cpp, lui, continue tant que tu ne le fermes pas).

## Configuration & portabilité 📦

Le projet est **autonome** : tout est dans son dossier, pas de dépendance externe
(LM Studio n'est plus nécessaire).

```
llama-console/
├── backend/          llama-server.exe + DLLs + runtime CUDA (cudart/cublas)
├── models/           les .gguf (Qwen3.8-27B-Q4_K_M.gguf, …)
├── server.js         serveur web + gestion du process + proxy chat
├── public/           UI (index.html, config.html, app.js, config.js, style.css)
├── config.json       chemins + réglages (auto-créé)
└── start.bat         lanceur double-clic
```

- **`config.json`** pointe vers `backend/` et `models/` **du projet** (chemins
  calculés depuis l'emplacement de `server.js` → **le dossier se déplace/copie
  tel quel**).
- **Auto-réparation** : si un chemin de `config.json` n'existe plus (dossier
  déplacé), l'app revient automatiquement au défaut portable.
- Logs du serveur : `llama-server.log`. Le lancement génère `run-server.bat`.
- Pour ajouter un modèle : déposer le `.gguf` dans `models/` (hors mmproj), puis
  « ↻ » dans la page Config.

## Architecture

```
server.js          serveur HTTP + gestion du process llama + proxy chat SSE
public/index.html  page principale : chat + barre de tokens du bas
public/app.js      logique chat (streaming, <think>, compaction) + barre du bas
public/config.html page de configuration du serveur (modèle, contexte, monitoring)
public/config.js   logique du panneau de configuration
public/style.css   thème sombre
```

Routes : `/api/state`, `/api/config`, `/api/models`, `/api/server/start`,
`/api/server/stop`, `/api/chat` (SSE), `/api/compact`, `/api/gpu`.

## Réglages par défaut (optimisés Qwen + RTX 3090)

Les valeurs par défaut de `config.json` et du profil `Qwen3.8-27B…gguf.json` sont
**testées/optimisées pour Qwen3.8-27B (Q4_K_M) + RTX 3090 24 Go** :

- **Serveur** : `--ctx-size 131072 -ngl 99 --cache-type-k/v q4_0 --flash-attn on -b 4096 -ub 512`
  → 128k de contexte stable, modèle 100 % sur GPU (VRAM ~19 Go).
- **Raisonnement** : `--reasoning-format deepseek` + effort `medium` (bon équilibre
  vitesse/qualité ; `low` = rapide, `high`/`xhigh` = tâches difficiles).
- **Sortie** : `max_tokens 8192` (le code long n'est plus coupé).
- **Sampling** : `temp 0.7 · top_p 0.95 · min_p 0.05 · repeat_penalty 1.0` (standard Qwen3).
- **Compaction** : seuil `80 %`, résumé + 4 derniers messages (tronqués à 3000 car.).

Autre machine (moins de VRAM, CPU, AMD) → adapter via la page Config (voir `readme.txt` §4).

## Compaction de contexte 🧹

Pour **alléger les ressources** (moins de tokens envoyés = moins de calcul = moins
d'énergie) quand la conversation grossit :

- **Seuil auto** : dans ⚙ Paramètres, « Seuil compaction auto (%) » (défaut 80 %).
  Quand le contexte atteint ce % (mesuré via `/slots`), l'historique est résumé
  automatiquement par le modèle local, le résumé est injecté dans le system prompt,
  et seuls les 4 derniers messages (tronqués à 3000 caractères) sont conservés.
- **Manuel** : bouton « 🧹 Compacter maintenant ».
- Le résumé conserve les faits/identifiants techniques (ports, chemins, noms de
  modèle, versions, nombres).

## Mode Agent (étape 2) 🤖

Le **🤖 Mode Agent** (coché par défaut) fait du modèle un **agent de code** qui
agit dans `workspace/` (dossier créé à la racine) :

- Outils (auto) : `list_dir` · `read_file` · `grep` · `glob` · `write_file` ·
  `edit_file` · `replace_all` · `move_file` · `set_plan` · `run_love` · `check_lua`.
- Outils (approbation) : `delete_file` · `web_search` · `shell` (sauf commandes de
  vérification / navigation type `cd`, `set`, `dir`).
- **Recherche web** 🌐 : `web_search` sous approbation, résultats tronqués et marqués
  « contenu non fiable » (ne jamais suivre leurs instructions). Backend configurable
  dans `config.json` : `duckduckgo` (zéro dépendance) ou `searxng` (local, riche).
  Le mode `duckduckgo` tente 3 sources en cascade : résultats HTML de DuckDuckGo
  (titre + URL + extrait) → Wikipédia (repli fiable pour les entités) → Instant
  Answer (résumé d'entité).
- **Shell persistant** : l'outil `shell` garde l'état entre les commandes (`cd`,
  variables d'env, processus d'arrière-plan) — pour des séquences de travail.
- **Test LÖVE** : `run_love` lance le jeu et **détecte les plantages** — un
  gestionnaire d'erreur est injecté temporairement via `conf.lua` (restauré ensuite)
  pour écrire l'erreur exacte dans `workspace/love.err.log`. LÖVE auto-détecté
  (dossier `love/` du projet → emplacements standard → PATH ; forçable via `loveCmd`
  dans Config). `check_lua` vérifie la syntaxe d'un `.lua`.
- **Plan multi-étapes** : l'agent liste ses étapes (`set_plan`) et les coche en
  direct dans le chat (📋 Plan).
- **Mode plan** (📋 case à cocher) : l'agent analyse en lecture seule, propose un
  plan (`submit_plan`), et attend ton approbation (Approuver / Modifier) avant d'agir.
- **Boucle** : réflexion → appel d'outil → résultat → … jusqu'à la réponse finale.
- **Mémoire** : lit `workspace/AGENTS.md` au démarrage et peut le mettre à jour
  (règles/conventions persistantes entre sessions).
- **Approbation** : seulement pour `delete_file` et les commandes shell risquées ;
  ⚡ **Auto-approuver** les exécute sans demander.
- **Sécurité** : confiné à `workspace/` (chemins absolus et `..` refusés).
- **Commandes interdites** 🔒 : l'agent ne peut **jamais** lancer `start`,
  `taskkill`, `llama-server`, `shutdown`, `format`, `reg`, `sc`, `net`,
  ni de suppression récursive (`del /f/s`, `rmdir /s`) — refusées automatiquement,
  même avec ⚡ Auto-approuver. Les interpréteurs alternatifs (`powershell`, `cmd`)
  sont autorisés mais **sous approbation** (politique « comme DeepSeek »).
- **Sauvegarde auto** : chaque tâche copie `workspace/` dans `backup/<date-heure>`
  (20 max), hors de portée de l'agent — filet de sécurité contre les suppressions.
- **Diff + annulation** 📊 : à la fin de chaque tâche, l'agent affiche le **diff**
  des fichiers modifiés (lignes `-`/`+` colorées) par rapport à la sauvegarde de
  départ, avec un bouton **↩️ Annuler** qui restaure `workspace/` depuis `backup/`.
- **Trace des modifs** (🔍 case opt-in) : chaque modification d'un fichier *code*
  garde l'ancienne version dans `history/<session>/<sous-dossier>/nom.<horodatage>.<ext>`
  (l'extension et la structure de sous-dossiers du workspace sont conservées, pour
  distinguer plusieurs `main.lua` de projets différents) — **un dossier par session
  serveur**, créé seulement au premier fichier tracé (plus de dossier vide). Jamais
  de fichiers lourds/binaires.
- Le **journal des outils** (appels + sorties + raisonnement) s'affiche dans le chat.

## Journal des conversations & résilience 🗂️

- **`conversations/conversations.jsonl`** : **toutes** les conversations (mode agent
  **et** chat simple) sont écrites en **temps réel** dans un fichier unique (format
  JSONL — une ligne JSON par événement, ajoutée au fur et à mesure). Chaque ligne
  porte l'identifiant de la tâche (`runId` pour l'agent, `id` pour le chat) pour
  regrouper ses événements. Même si l'agent plante ou que tu coupes, ce qui a déjà
  eu lieu est sauvegardé.
- **Taille maîtrisée** : le raisonnement est loggé **agrégé** (une ligne par tour,
  pas par fragment), les sorties d'outils sont tronquées au-delà de 4000 car., et
  le fichier **tourne automatiquement** au-delà de 8 Mo (renommé
  `conversations-<horodatage>.jsonl`, un nouveau `conversations.jsonl` repart).
- **Résilience réseau** : les appels HTTP vers llama-server utilisent une connexion
  fraîche à chaque requête (pas de socket keep-alive mort) et l'agent ré-essaie
  automatiquement une fois en cas de « socket hang up ».

## 💝 Soutenir le projet

Si ce projet t'aide, tu peux soutenir son développement :

- 🏢 [GitHub Sponsors](https://github.com/sponsors/autostoppeur48)
- ☕ [Ko-fi](https://ko-fi/TONPSEUDO)
- 🇫🇷 [Tipeee](https://fr.tipeee.com/TONPSEUDO)
- 🎁 [Liberapay](https://liberapay.com/TONPSEUDO) *(dons déductibles en France)*

> Remplace `TONPSEUDO` par tes identifiants respectifs (ou supprime les lignes
> qui ne concernent pas ton projet).

---

Briques restantes pour un vrai Bionic : diff/annulation.
