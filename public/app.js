'use strict'

// ============================ Helpers ============================

const $ = (id) => document.getElementById(id)

function fmt(n) {
  const x = Number(n)
  return Number.isFinite(x) ? x.toLocaleString('fr-FR') : '—'
}

async function api(path, opts) {
  const r = await fetch(path, opts)
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('json')) return r.json()
  return r.text()
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

// ============================ État ============================

let messages = [] // [{role, content}] envoyés au modèle
let streaming = false
let abortController = null
let partialAnswer = '' // texte partiel d'une génération arrêtée (pour "Reprendre")
let pendingResume = false // true = un "Reprendre" est disponible
let agentMode = true // bascule Chat <-> Agent (actif par défaut)
let agentRunId = null // id de la boucle agent en cours (pour l'approbation)
let agentFinalText = '' // texte final accumulé de l'agent

// Compaction de contexte
let compactionSummary = ''
let compactionRunning = false
let lastCompactAt = null
let pendingSinceCompact = false

// ============================ Persistance (localStorage + serveur) ============================

const CHAT_STORE_KEY = 'llama-console-chat'

function persistChat() {
  const data = { messages, compactionSummary, lastCompactAt }
  try {
    localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(data))
  } catch (e) { /* ignore */ }
  // Sauvegarde cote serveur (survit a un redemarrage complet).
  api('/api/conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {})
}

function renderHistory() {
  const box = $('messages')
  box.innerHTML = ''
  for (const m of messages) {
    addBubble(m.role === 'assistant' ? 'assistant' : 'user', escapeHtml(m.content))
  }
  if (compactionSummary) appendNotice('🧹 Résumé de contexte conservé (historique allégé).')
}

function restoreConversation(data) {
  if (!data || !Array.isArray(data.messages) || data.messages.length === 0) return false
  messages = data.messages
  compactionSummary = typeof data.compactionSummary === 'string' ? data.compactionSummary : ''
  lastCompactAt = data.lastCompactAt ? new Date(data.lastCompactAt) : null
  renderHistory()
  return true
}

async function loadChat() {
  // 1. Cote serveur : survit a un redemarrage complet de l'app.
  try {
    const data = await api('/api/conversation')
    if (restoreConversation(data)) return
  } catch (e) { /* ignore */ }
  // 2. Repli localStorage (navigateur).
  try {
    const raw = localStorage.getItem(CHAT_STORE_KEY)
    if (raw) restoreConversation(JSON.parse(raw))
  } catch (e) { /* ignore */ }
}

// ============================ Rendu chat ============================

function scrollDown() {
  const m = $('messages')
  m.scrollTop = m.scrollHeight
}

function appendNotice(text) {
  const div = document.createElement('div')
  div.className = 'notice'
  div.textContent = text
  $('messages').appendChild(div)
  scrollDown()
}

function addBubble(role, html) {
  const div = document.createElement('div')
  div.className = 'bubble ' + role
  div.innerHTML = '<span class="role">' + (role === 'assistant' ? 'Assistant' : 'Vous') + '</span>' + html
  $('messages').appendChild(div)
  scrollDown()
  return div
}

function addUser(text) {
  addBubble('user', escapeHtml(text))
  scrollDown()
}

// Extraction progressive du raisonnement <think>...</think> (repli si le build
// met le raisonnement dans le content ; sinon il vient en delta.reasoning_content).
function makeThinkParser() {
  let think = ''
  let answer = ''
  let openThink = false
  function classify(raw) {
    think = ''
    answer = ''
    openThink = false
    const OPEN = '<think>'
    const CLOSE = '</think>'
    let pos = 0
    while (pos < raw.length) {
      const o = raw.indexOf(OPEN, pos)
      if (o === -1) { answer += raw.slice(pos); break }
      answer += raw.slice(pos, o)
      const c = raw.indexOf(CLOSE, o + OPEN.length)
      if (c === -1) { think += raw.slice(o + OPEN.length); openThink = true; break }
      think += raw.slice(o + OPEN.length, c)
      pos = c + CLOSE.length
    }
    return { think, answer, openThink }
  }
  return { classify }
}

// ============================ Envoi (streaming) ============================

async function sendMessage() {
  if (streaming) return
  const input = $('input')
  const text = input.value.trim()
  if (!text) return

  streaming = true
  partialAnswer = ''
  pendingResume = false
  input.value = ''
  abortController = new AbortController()
  $('btnSend').textContent = '■ Arrêter'
  $('btnSend').disabled = false

  addUser(text)
  messages.push({ role: 'user', content: text })
  pendingSinceCompact = true
  persistChat()

  if (agentMode) await runAgent()
  else await generateResponse()
}

// Reprend la génération là où elle s'est arrêtée (texte partiel + "Continue").
async function resumeGeneration() {
  if (streaming) return
  streaming = true
  pendingResume = false
  abortController = new AbortController()
  $('btnSend').textContent = '■ Arrêter'
  $('btnSend').disabled = false

  if (partialAnswer) {
    messages.push({ role: 'assistant', content: partialAnswer })
    addBubble('assistant', escapeHtml(partialAnswer))
  }
  const cont = 'Continue.'
  messages.push({ role: 'user', content: cont })
  addUser(cont)
  pendingSinceCompact = true
  persistChat()

  partialAnswer = ''
  await generateResponse()
}

// Core : construit la requete, streame la reponse, met a jour les messages.
async function generateResponse() {
  const bubble = addBubble('assistant', '')
  const parser = makeThinkParser()
  const thinkEl = document.createElement('details')
  thinkEl.className = 'think'
  thinkEl.innerHTML = '<summary>💭 Raisonnement</summary><div class="think-body"></div>'
  thinkEl.style.display = 'none'
  const answerEl = document.createElement('div')
  answerEl.className = 'answer'
  answerEl.classList.add('cursor')
  bubble.appendChild(thinkEl)
  bubble.appendChild(answerEl)

  const baseSystem = $('systemPrompt').value.trim()
  const systemParts = []
  if (baseSystem) systemParts.push(baseSystem)
  if (compactionSummary) {
    systemParts.push('[Contexte résumé de la discussion précédente]\n' + compactionSummary)
  }
  const payload = {
    messages,
    max_tokens: Number($('maxTokens').value) || undefined,
    temperature: Number($('temperature').value),
    system: systemParts.join('\n\n'),
  }

  let rawContent = ''
  let reasoningContent = ''
  let fullAnswer = ''
  let finishReason = ''

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    })

    if (!resp.ok || !resp.body) {
      const err = await resp.text()
      answerEl.classList.remove('cursor')
      answerEl.textContent = '⚠ Erreur : ' + (err || resp.status)
      $('btnSend').textContent = 'Envoyer'
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        for (const line of chunk.split('\n')) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (data === '[DONE]') continue
          let json
          try { json = JSON.parse(data) } catch { continue }
          const choice = json.choices && json.choices[0]
          if (!choice) continue
          if (choice.finish_reason) finishReason = choice.finish_reason
          const delta = choice.delta
          if (!delta) continue
          if (typeof delta.reasoning_content === 'string') reasoningContent += delta.reasoning_content
          if (typeof delta.content === 'string') rawContent += delta.content
          const rc = parser.classify(rawContent)
          const thinkText = rc.think + reasoningContent
          if (thinkText.trim().length > 0) {
            thinkEl.style.display = ''
            thinkEl.querySelector('.think-body').textContent = thinkText
          }
          fullAnswer = rc.answer
          answerEl.textContent = fullAnswer
          scrollDown()
        }
      }
    }

    answerEl.classList.remove('cursor')
    if (finishReason === 'length') {
      // Reponse tronquee (max_tokens atteint) : proposer Reprendre.
      partialAnswer = fullAnswer.trim()
      pendingResume = true
      appendNotice('⚠ Réponse tronquée (max_tokens atteint) — clique ▶ Reprendre pour continuer.')
      $('btnSend').textContent = '▶ Reprendre'
    } else {
      if (fullAnswer.trim().length === 0) answerEl.textContent = '(réponse vide)'
      messages.push({ role: 'assistant', content: fullAnswer.trim() || '(vide)' })
      persistChat()
      $('btnSend').textContent = 'Envoyer'
    }
  } catch (e) {
    answerEl.classList.remove('cursor')
    if (e && e.name === 'AbortError') {
      partialAnswer = fullAnswer.trim()
      pendingResume = true
      if (partialAnswer.length === 0) answerEl.textContent = '(génération arrêtée)'
      appendNotice('⏹ Génération arrêtée.')
      $('btnSend').textContent = '▶ Reprendre'
    } else {
      answerEl.textContent = '⚠ Erreur réseau : ' + (e.message || e)
      $('btnSend').textContent = 'Envoyer'
    }
  } finally {
    streaming = false
    abortController = null
    $('btnSend').disabled = false
    const inp = $('input')
    if (inp) inp.focus()
  }
}

// Arrête la génération en cours.
function stopGeneration() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

// ============================ Compaction ============================

async function runCompact() {
  if (compactionRunning || streaming) return
  if (messages.length < 2) {
    appendNotice('🧹 Rien à compacter (conversation trop courte).')
    return
  }
  compactionRunning = true
  pendingSinceCompact = false
  appendNotice('🧹 Compaction en cours… (peut prendre ~30 s à 1 min selon la taille)')
  try {
    const r = await fetch('/api/compact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    const d = await r.json()
    if (d.summary) {
      compactionSummary = d.summary
      lastCompactAt = new Date()
      const oldLen = messages.length
      // Garde les 4 derniers messages, mais TRONQUE ceux trop longs
      // (sinon de gros textes colles empechent le contexte de vraiment baisser).
      messages = messages.slice(-4).map((m) => {
        const c = m.content || ''
        return c.length > 3000 ? { ...m, content: c.slice(-3000) } : m
      })
      persistChat()
      appendNotice('✅ Compaction OK : ' + oldLen + ' messages → résumé + ' + messages.length + ' récents.')
    } else {
      appendNotice('⚠ Compaction échouée : ' + (d.error || 'réponse vide'))
      pendingSinceCompact = true
    }
  } catch (e) {
    appendNotice('⚠ Compaction : erreur ' + (e.message || e))
    pendingSinceCompact = true
  } finally {
    compactionRunning = false
  }
}

// ============================ Mode Agent ============================

function summarizeArgs(args) {
  if (!args) return ''
  try {
    const s = JSON.stringify(args)
    return s.length > 80 ? s.slice(0, 80) + '…' : s
  } catch { return '' }
}

function appendAgentLine(journal, cls, text) {
  const div = document.createElement('div')
  div.className = 'agent-line ' + cls
  if (text) {
    const span = document.createElement('span')
    span.textContent = text
    div.appendChild(span)
  }
  journal.appendChild(div)
  scrollDown()
  return div
}

function renderPlan(planEl, steps) {
  if (!planEl) return
  if (!Array.isArray(steps) || steps.length === 0) {
    planEl.style.display = 'none'
    planEl.innerHTML = ''
    return
  }
  const done = steps.filter((s) => s.done).length
  planEl.style.display = ''
  planEl.innerHTML = '<div class="plan-title">📋 Plan (' + done + '/' + steps.length + ')</div>' +
    steps.map((s) => '<div class="plan-step' + (s.done ? ' done' : '') + '">' +
      (s.done ? '✅' : '⬜') + ' ' + escapeHtml(s.title) + '</div>').join('')
}

function handleAgentEvent(ev, journal, answerEl, thinkEl, planEl) {
  switch (ev.type) {
    case 'start':
      agentRunId = ev.runId
      break
    case 'plan':
      renderPlan(planEl, ev.steps)
      break
    case 'status':
      appendAgentLine(journal, 'status', ev.text)
      break
    case 'note':
      appendAgentLine(journal, 'status', ev.text)
      break
    case 'content':
      answerEl.textContent += ev.text
      agentFinalText += ev.text
      break
    case 'reasoning':
      if (thinkEl) {
        thinkEl.style.display = ''
        thinkEl.querySelector('.think-body').textContent += ev.text
      }
      break
    case 'tool_call':
      appendAgentLine(journal, 'tool', '🛠 ' + ev.name + ' ' + summarizeArgs(ev.args))
      break
    case 'tool_result': {
      const label = (ev.ok ? '✅ ' : ev.refused ? '🚫 ' : '❌ ') + ev.name
      const line = appendAgentLine(journal, 'result', label)
      if (ev.output) {
        const pre = document.createElement('pre')
        pre.textContent = ev.output
        line.appendChild(pre)
      }
      break
    }
    case 'approval': {
      const card = appendAgentLine(journal, 'approval', '🔐 Approbation : ' + ev.summary)
      const btns = document.createElement('div')
      btns.className = 'approval-btns'
      const ok = document.createElement('button')
      ok.textContent = '✅ Approuver'
      const no = document.createElement('button')
      no.textContent = '❌ Refuser'
      ok.addEventListener('click', () => sendApproval(true))
      no.addEventListener('click', () => sendApproval(false))
      btns.appendChild(ok)
      btns.appendChild(no)
      card.appendChild(btns)
      break
    }
    case 'plan_proposal': {
      const card = appendAgentLine(journal, 'approval', '📋 Plan proposé :')
      const pre = document.createElement('pre')
      pre.textContent = ev.plan || ''
      card.appendChild(pre)
      const btns = document.createElement('div')
      btns.className = 'approval-btns'
      const ok = document.createElement('button')
      ok.textContent = '✅ Approuver le plan'
      ok.addEventListener('click', () => sendApproval(true))
      const edit = document.createElement('button')
      edit.textContent = '✏️ Modifier'
      const feed = document.createElement('textarea')
      feed.className = 'plan-feedback'
      feed.placeholder = 'Tes remarques sur le plan…'
      feed.rows = 2
      feed.style.display = 'none'
      const send = document.createElement('button')
      send.textContent = 'Envoyer les remarques'
      send.style.display = 'none'
      edit.addEventListener('click', () => {
        feed.style.display = 'block'
        send.style.display = 'inline-block'
        ok.disabled = true
        edit.disabled = true
      })
      send.addEventListener('click', () => sendPlanFeedback(feed.value))
      btns.appendChild(ok)
      btns.appendChild(edit)
      card.appendChild(btns)
      card.appendChild(feed)
      card.appendChild(send)
      break
    }
    case 'changes': {
      const list = Array.isArray(ev.changes) ? ev.changes : []
      const n = list.length
      const card = appendAgentLine(journal, 'approval', '📊 Diff des modifications (' + n + ' fichier' + (n > 1 ? 's' : '') + ')')
      for (const ch of list) {
        const head = document.createElement('div')
        head.className = 'diff-head'
        const icon = ch.status === 'added' ? '➕' : ch.status === 'deleted' ? '➖' : '✏️'
        const label = ch.status === 'added' ? 'ajouté' : ch.status === 'deleted' ? 'supprimé' : (ch.binary ? 'modifié (binaire)' : 'modifié')
        head.textContent = icon + ' ' + ch.rel + ' — ' + label
        card.appendChild(head)
        if (ch.diff) {
          const pre = document.createElement('pre')
          pre.className = 'diff-pre'
          pre.innerHTML = colorizeDiff(ch.diff)
          card.appendChild(pre)
        }
      }
      if (ev.backup) {
        const btns = document.createElement('div')
        btns.className = 'approval-btns'
        const undo = document.createElement('button')
        undo.textContent = '↩️ Annuler les modifications'
        undo.addEventListener('click', () => undoChanges(ev.backup, undo))
        btns.appendChild(undo)
        card.appendChild(btns)
      }
      break
    }
    case 'done':
      if (ev.text) {
        answerEl.textContent = ev.text
        agentFinalText = ev.text
      }
      if (agentFinalText.trim()) {
        messages.push({ role: 'assistant', content: agentFinalText.trim() })
        persistChat()
      }
      break
    case 'error':
      answerEl.textContent = '⚠ Erreur agent : ' + (ev.message || '')
      break
  }
  scrollDown()
}

function sendApproval(approved) {
  if (!agentRunId) return
  api('/api/agent/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: agentRunId, approve: approved }),
  }).catch(() => {})
  document.querySelectorAll('.approval-btns button').forEach((b) => { b.disabled = true })
}

function sendPlanFeedback(feedback) {
  if (!agentRunId) return
  api('/api/agent/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: agentRunId, approve: false, feedback: feedback || 'Plan à revoir' }),
  }).catch(() => {})
  document.querySelectorAll('.approval-btns button, .plan-feedback').forEach((b) => { b.disabled = true })
}

// Colorise un diff ligne à ligne (préfixes '- ', '+ ', '  ').
function colorizeDiff(diff) {
  return String(diff).split('\n').map((l) => {
    if (l.startsWith('- ')) return '<span class="diff-del">' + escapeHtml(l) + '</span>'
    if (l.startsWith('+ ')) return '<span class="diff-add">' + escapeHtml(l) + '</span>'
    return '<span class="diff-ctx">' + escapeHtml(l) + '</span>'
  }).join('\n')
}

// Annule les modifications d'une tâche en restaurant workspace/ depuis backup/<name>.
async function undoChanges(name, btn) {
  if (btn) btn.disabled = true
  try {
    const r = await api('/api/agent/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: name }),
    })
    if (r && r.ok) appendNotice('↩️ Modifications annulées — workspace restauré depuis backup/' + name + '.')
    else appendNotice('⚠ Annulation impossible : ' + ((r && r.error) || 'erreur inconnue'))
  } catch (e) {
    appendNotice('⚠ Annulation impossible : ' + (e.message || e))
  }
}

async function runAgent() {
  const bubble = addBubble('assistant', '')
  const planEl = document.createElement('div')
  planEl.className = 'agent-plan'
  planEl.style.display = 'none'
  bubble.appendChild(planEl)
  const journal = document.createElement('div')
  journal.className = 'agent-journal'
  bubble.appendChild(journal)
  const thinkEl = document.createElement('details')
  thinkEl.className = 'think'
  thinkEl.innerHTML = '<summary>💭 Raisonnement</summary><div class="think-body"></div>'
  thinkEl.style.display = 'none'
  bubble.appendChild(thinkEl)
  const answerEl = document.createElement('div')
  answerEl.className = 'answer'
  bubble.appendChild(answerEl)

  agentRunId = null
  agentFinalText = ''

  try {
    const resp = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: abortController.signal,
    })
    if (!resp.ok || !resp.body) {
      answerEl.textContent = '⚠ Erreur : ' + resp.status
      $('btnSend').textContent = 'Envoyer'
      return
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        for (const line of chunk.split('\n')) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          let ev
          try { ev = JSON.parse(data) } catch { continue }
          handleAgentEvent(ev, journal, answerEl, thinkEl, planEl)
        }
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') {
      appendNotice('⏹ Agent arrêté.')
    } else {
      answerEl.textContent = '⚠ Erreur : ' + (e.message || e)
    }
  } finally {
    streaming = false
    abortController = null
    $('btnSend').textContent = 'Envoyer'
    $('btnSend').disabled = false
    const inp = $('input')
    if (inp) inp.focus()
  }
}

// ============================ Barre du bas ============================

async function refreshBar() {
  try {
    const d = await api('/api/state')
    const s = d.server || {}
    const g = d.gpu || {}

    const dot = $('statusDot')
    const txt = $('statusText')
    dot.className = 'dot ' + (s.running ? 'on' : s.starting ? 'loading' : 'off')
    txt.textContent = s.running ? 'en ligne' : s.starting ? 'chargement…' : 'hors ligne'

    const slots = s.slots
    let ctx = 0
    let limit = (d.config && d.config.ctxSize) || 131072
    if (Array.isArray(slots)) {
      const sl = slots[0]
      if (sl) { ctx = typeof sl.n_prompt_tokens === 'number' ? sl.n_prompt_tokens : 0; if (sl.n_ctx) limit = sl.n_ctx }
    } else if (slots && Array.isArray(slots.value)) {
      const sl = slots.value[0]
      if (sl) { ctx = typeof sl.n_prompt_tokens === 'number' ? sl.n_prompt_tokens : 0; if (sl.n_ctx) limit = sl.n_ctx }
    }
    const pct = limit > 0 ? Math.min(100, Math.round((ctx / limit) * 100)) : 0
    const fill = $('ctxFill')
    fill.style.width = pct + '%'
    fill.className = 'meter-fill' + (pct >= 95 ? ' danger' : pct >= 80 ? ' warn' : '')
    $('ctxText').textContent = 'ctx: ' + fmt(ctx) + ' / ' + fmt(limit) + ' (' + pct + '%)'

    $('gpuText').textContent = g.ok ? ('GPU ' + g.temp + '°C ' + g.util + '%') : 'GPU —'

    // Compaction auto : déclenche quand le contexte atteint le seuil défini
    const compactPct = (d.config && d.config.compactPct) || 80
    const threshold = Math.floor((limit * compactPct) / 100)
    const cs = $('compactStatus')
    if (cs) {
      cs.textContent = lastCompactAt
        ? 'Seuil compaction : ' + compactPct + '% (' + fmt(threshold) + ' tok) · dernière : ' + lastCompactAt.toLocaleTimeString('fr-FR')
        : 'Seuil compaction : ' + compactPct + '% (' + fmt(threshold) + ' tok)'
    }
    if (!streaming && !compactionRunning && pendingSinceCompact && ctx >= threshold && messages.length >= 4) {
      runCompact()
    }
  } catch (e) { /* ignore */ }
}

// ============================ Config chat ============================

async function loadChatConfig() {
  try {
    const c = await api('/api/config')
    $('maxTokens').value = c.maxTokens
    $('temperature').value = c.temperature
    $('systemPrompt').value = c.systemPrompt || ''
    if (c.compactPct) $('compactPct').value = c.compactPct
    if (c.reasoningEffort != null) $('reasoningEffortChat').value = c.reasoningEffort
    const aa = $('agentAutoApprove')
    if (aa) aa.checked = !!c.agentAutoApprove
    const pm = $('planMode')
    if (pm) pm.checked = !!c.planMode
    const tm = $('traceMode')
    if (tm) tm.checked = !!c.traceMode
  } catch (e) { /* ignore */ }
}

function saveChatConfig() {
  api('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxTokens: Number($('maxTokens').value) || 8192,
      temperature: Number($('temperature').value) || 0.7,
      systemPrompt: $('systemPrompt').value,
      compactPct: Number($('compactPct').value) || 80,
      reasoningEffort: $('reasoningEffortChat').value,
    }),
  }).catch(() => {})
}

// ============================ Wiring ============================

$('btnSend').addEventListener('click', () => {
  if (streaming) stopGeneration()
  else if (pendingResume) resumeGeneration()
  else sendMessage()
})
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
})
$('btnCompact').addEventListener('click', runCompact)
$('btnClear').addEventListener('click', () => {
  messages = []
  compactionSummary = ''
  lastCompactAt = null
  pendingSinceCompact = false
  $('messages').innerHTML = ''
  persistChat()
})
;['maxTokens', 'temperature', 'systemPrompt', 'compactPct', 'reasoningEffortChat'].forEach((id) => {
  const el = $(id)
  if (el) el.addEventListener('change', saveChatConfig)
})

$('agentToggle').addEventListener('change', (e) => {
  agentMode = e.target.checked
  const w = $('agentAutoApproveWrap')
  if (w) w.style.display = agentMode ? '' : 'none'
})
$('agentAutoApprove').addEventListener('change', (e) => {
  api('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentAutoApprove: e.target.checked }),
  }).catch(() => {})
})
$('planMode').addEventListener('change', (e) => {
  api('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planMode: e.target.checked }),
  }).catch(() => {})
})
$('traceMode').addEventListener('change', (e) => {
  api('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ traceMode: e.target.checked }),
  }).catch(() => {})
})

loadChat()
loadChatConfig()
refreshBar()
setInterval(refreshBar, 3000)
