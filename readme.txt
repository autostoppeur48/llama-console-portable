==========================================================
 LLAMA CONSOLE — guide d'installation et d'utilisation
==========================================================

Studio LLM local autonome : fait tourner un serveur llama.cpp
+ un chat streaming. Tout est inclus dans ce dossier (moteur,
modèles, interface) sauf deux choses : Node.js et un pilote GPU.

----------------------------------------------------------
 1) À INSTALLER AVANT DE LANCER
----------------------------------------------------------

 a) Node.js  (OBLIGATOIRE)
    - Version 18 ou plus (testé avec la 24).
    - Téléchargement : https://nodejs.org  (prendre la LTS)
    - Vérifier : ouvrir un terminal et taper :  node --version

 b) Carte graphique NVIDIA + pilote  (recommandé)
    - Le dossier backend\ embarque déjà le runtime CUDA 12 :
      PAS besoin d'installer le CUDA Toolkit.
    - Il faut seulement le PILOTE NVIDIA récent
      (il fournit le composant nvcuda.dll).
    - Sans NVIDIA : voir section 4 (CPU / AMD).

 c) Windows
    - L'application est Windows uniquement (llama-server.exe).

----------------------------------------------------------
 2) DÉMARRAGE RAPIDE
----------------------------------------------------------

 1. Double-clic sur  start.bat
    -> une console s'ouvre (interface web) et le navigateur
       se lance sur  http://127.0.0.1:8787
 2. Cliquer sur le bouton "Config" (en bas à droite de la page).
 3. Cliquer sur "Démarrer (terminal)".
    -> un terminal s'ouvre et charge le modèle (logs en direct).
 4. Revenir sur la page principale et écrire dans la barre d'input.

 Arrêt :
   - Fermer le terminal llama.cpp  = arrête le serveur de modèle.
   - Fermer la console start.bat   = arrête l'interface web.

----------------------------------------------------------
 3) PARAMÈTRES (page "Config" + ⚙ Paramètres)
----------------------------------------------------------

 Valeurs par défaut = OPTIMISÉES pour Qwen3.8-27B (Q4_K_M) + RTX 3090
 24 Go (testé sur cette config). Si ta machine diffère, adapte
 ci-dessous ou via la section 4.

 Paramètre            | Défaut    | Pour l'adapter
 ---------------------|-----------|-------------------------------------
 Modèle               | Qwen3.8...| .gguf présent dans models/
 Contexte             | 131072    | baisse si peu de RAM/VRAM (ex. 32768)
 -ngl (couches GPU)   | 99        | 99 = tout sur GPU ; 0 = tout sur CPU
 KV cache             | q4_0      | q4_0 = économe ; q8_0 = plus précis
 Port                 | 1235      | port du serveur llama.cpp
 Flash attention      | on        | CUDA uniquement ; "off" si CPU/AMD
 Surveillance GPU     | coché     | décocher si pas de NVIDIA

 Seuils du chat (page principale, ⚙ Paramètres) :
 max_tokens           | 8192      | longueur max d'une réponse (code non coupé)
 temperature          | 0.7       | 0 = déterministe, 2 = créatif
 Seuil compaction     | 80 %      | résume l'historique à ce % de contexte

 Onglet "Paramètres avancés" (page Config) :
 Performance (serveur, au prochain Démarrer) :
   Threads CPU        | 0 (auto)  | -t
   Threads batch      | -1 (auto) | -tb
   Batch size         | 4096      | -b (rapide en 24 Go VRAM)
   Micro-batch        | 512       | -ub
   mmap               | coché     | chargement mappé en mémoire
   mlock              | décoché   | verrouiller en RAM
   Tensor split       | (vide)    | multi-GPU (ex: 24,24)
   Split mode         | auto      | none/layer/row
   Main GPU           | -1 (auto) | --main-gpu
   no-kv-offload      | décoché   | KV cache sur CPU
   warmup             | coché     | passe de chauffe
   N-keep             | 0 (auto)  | --n-keep
   Timeout            | 600 s     | --timeout
   API key            | (vide)    | --api-key
 Raisonnement :
   Reasoning format   | deepseek  | --reasoning-format (au prochain Démarrer)
   Reasoning effort   | medium    | par requête : none/low/medium/high/xhigh
 Échantillonnage (immédiat, sans redémarrer) :
   Top-K              | -1 (auto) | -1 = laisse le modèle décider
   Top-P              | 0.95      | 0–1
   Min-P              | 0.05      | 0–1
   Typical-P          | 1 (off)   | 1 = désactivé
   Repeat penalty     | 1.0       | 1 = neutre
   Repeat last N      | 64        | fenêtre anti-répétition
   Presence penalty   | 0.0       | -2 à 2
   Frequency penalty  | 0.0       | -2 à 2
   Mirostat           | off       | off/v1/v2
   Mirostat tau       | 5.0       |
   Mirostat eta       | 0.1       |
   Dynatemp range     | 0 (off)   | température dynamique
   Dynatemp exponent  | 1.0       |
   XTC probability    | 0 (off)   | exclut les tokens probables
   XTC threshold      | 0.1       |
   Seed               | -1        | -1 = aléatoire ; fixe = reproductible

----------------------------------------------------------
 4) CONFIGURATIONS ALTERNATIVES (sans NVIDIA)
----------------------------------------------------------

 CPU uniquement :
   - Dans Config :  -ngl = 0 , Flash attention = "off",
     décocher "Surveillance GPU".
   - Contexte plus petit conseillé (16384 ou 32768) selon la RAM.
   - Remplacer le contenu du dossier backend\ par un build CPU de
     llama.cpp (nom du type : llama.cpp-win-x86_64-avx2, sans CUDA).
     Le serveur utilisera ce moteur tel quel.

 AMD / Intel (Vulkan) :
   - Même principe : remplacer backend\ par un build Vulkan de
     llama.cpp (llama.cpp-win-x86_64-vulkan), -ngl adapté,
     Flash attention = "off".

 Les modèles restent les mêmes (dossier models/), aucun changement.

----------------------------------------------------------
 5) CONTENU DU DOSSIER
----------------------------------------------------------

 backend\     llama-server.exe + DLLs (CUDA, MSVC, OpenMP)  <- moteur
 models\      les .gguf                                     <- modèles
 server.js    serveur web + proxy chat
 public\      l'interface (pages + scripts)
 config.json  réglages (chemins + paramètres)
 start.bat    lanceur double-clic
 readme.txt   ce guide

 Taille totale : ~20 Go (surtout les modèles).

----------------------------------------------------------
 6) DÉPANNAGE
----------------------------------------------------------

 - "node n'est pas reconnu"  -> Node.js absent (section 1a).
 - Le terminal llama s'ouvre puis se ferme aussitôt
   -> lire llama-server.log (à la racine).
 - Réponse lente ou erreur de mémoire vidéo
   -> baisser "Contexte" ou mettre KV cache = q4_0.
 - GPU affiché "—"  -> pilote NVIDIA absent, ou décocher/cocher
   "Surveillance GPU".

----------------------------------------------------------
 7) SÉCURITÉ (100 % local)
----------------------------------------------------------

 Ce projet est conçu pour tourner UNIQUEMENT sur la machine
 locale. Aucune connexion distante n'est possible :

 - Le serveur llama.cpp est lancé avec --host 127.0.0.1
   (boucle locale uniquement, pas 0.0.0.0) -> injoignable
   depuis le réseau / internet.

 - L'interface web écoute sur 127.0.0.1:8787 uniquement.

 - Une clé API est générée automatiquement et stockée dans
   config.json. L'inférence (/v1/chat/completions) et /slots
   refusent tout accès sans cette clé (401) -> un site web
   malveillant ou un processus externe ne peut pas utiliser
   le modèle.

 - Le proxy (server.js) transmet la clé en interne ; elle
   n'est jamais exposée au navigateur.

 Note : /health et /v1/models restent publics (simple statut),
 mais ils ne donnent accès à rien de sensible et restent
 confinés à la machine locale.

----------------------------------------------------------
 8) MODE AGENT (l'agent de code local)
----------------------------------------------------------

 Le "🤖 Mode Agent" (au-dessus de la barre d'input) est coché
 par défaut : le modèle peut AGIR dans un dossier workspace/
 (créé à la racine du projet) :

   - lister / lire / rechercher (grep) . automatique
   - trouver des fichiers (glob) ........ automatique
   - écrire / modifier / remplacer tout . automatique
   - déplacer / renommer (move_file) .... automatique
   - supprimer un fichier (delete_file) . demande approbation
   - plan d'étapes (set_plan) ........... automatique
     (il liste ses étapes et les coche en direct)
   - tester le jeu (run_love) ........... automatique
     (lance LÖVE, récupère love.err.log / love.out.log)
   - vérifier la syntaxe Lua (check_lua) . automatique
   - shell (persistant) ................. demande approbation
     (cd/variables conservés ; commandes de vérification :
      node --check, git status, etc. = automatiques)

  Pour run_love, le serveur trouve LÖVE tout seul (auto-détection) :
  1) un dossier love\ dans le projet (portable, comme backend\)
  2) les emplacements standard (C:\Program Files\LOVE\love.exe...)
  3) sinon la commande "love" sur le PATH.
  Tu peux forcer un chemin via le champ "loveCmd" dans Config
  (utile seulement si LÖVE est ailleurs).

 Approuver / Refuser : des boutons apparaissent dans le chat
 quand une action attend ton feu vert.

 "⚡ Auto-approuver" : coche cette case pour que les commandes
 shell s'exécutent aussi sans demander.

 "📋 Mode plan" : coche cette case pour que l'agent PROPOSE un
 plan (lecture seule) et attende ton approbation AVANT d'écrire
 ou d'exécuter quoi que ce soit. Boutons "Approuver"/"Modifier".

 Sécurité : l'agent est CONFINÉ à workspace/ (chemins absolus
 et ".." sont refusés). Il ne touche pas au reste de la machine,
 sauf via une commande shell que tu as toi-même approuvée.

 Sauvegarde : à CHAQUE tâche, le serveur copie automatiquement
 tout workspace/ dans backup/<date-heure> (20 sauvegardes max).
 Si l'agent casse un fichier, retrouve-le dans ce dossier.
 L'agent ne peut pas y toucher (hors de workspace/).

 Trace (option "🔍 Tracer les modifs") : à chaque modification
 d'un fichier CODE (.lua, .js, .py, .json...), le serveur garde
 l'ancienne version dans history/<date-heure>/nom.<date-heure>.
 Historique précis, jamais de fichiers lourds/binaires.

 Mémoire : l'agent lit automatiquement workspace/AGENTS.md au
 démarrage (tes règles et conventions) et peut le mettre à jour
 pour s'en souvenir aux prochaines sessions.

 Conseil : pour du code, laisse le modèle vérifier lui-même
 (node --check, luac -p) avant de te rendre le résultat — c'est
 ce qui évite les erreurs de casse type love.keyboard.isDown.

