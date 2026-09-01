@echo off
title Llama Console
cd /d "%~dp0"
echo.
echo  Llama Console - studio LLM local
echo  ================================
echo  Serveur web : http://127.0.0.1:8787
echo  (le serveur llama.cpp est gere depuis la page : Demarrer / Arreter)
echo.
start /b node server.js
ping -n 3 127.0.0.1 >nul
start "" http://127.0.0.1:8787
echo.
echo  Llama Console tourne. Ferme cette fenetre pour arreter le serveur web.
echo  (le serveur llama.cpp, lui, continue de tourner en arriere-plan.)
echo.
pause >nul
