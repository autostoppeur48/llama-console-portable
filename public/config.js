'use strict'

// Panneau de configuration du serveur llama.cpp (page /config.html).

const $ = (id) => document.getElementById(id)

function fmt(n) {
  const x = Number(n)
  return Number.isFinite(x) ? x.toLocaleString('fr-FR') : '—'
}

async function api(path, opts) {
  const r = await fetch(path, opts)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('json') ? r.json() : r.text()
}

function setMsg(txt, isErr) {
  const m = $('serverMsg')
  m.textContent = txt
  m.className = 'msg' + (isErr ? ' err' : '')
}

// ============================ Onglets ============================

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.tab-pane').forEach((p) => { p.style.display = 'none' })
    const pane = document.getElementById('tab-' + btn.dataset.tab)
    if (pane) pane.style.display = 'block'
  })
})

// ============================ Mapping champs <-> config ============================
// [id DOM, cle config, type]  type: 'num' | 'bool' | 'str'
const FIELD_MAP = [
  // Serveur (basique)
  ['ctxSize', 'ctxSize', 'num'],
  ['ngl', 'ngl', 'num'],
  ['port', 'port', 'num'],
  ['cacheType', 'cacheType', 'str'],
  ['flashAttn', 'flashAttn', 'str'],
  ['gpuMonitoring', 'gpuMonitoring', 'bool'],
  // Performance
  ['threads', 'threads', 'num'],
  ['threadsBatch', 'threadsBatch', 'num'],
  ['batchSize', 'batchSize', 'num'],
  ['ubatchSize', 'ubatchSize', 'num'],
  ['mainGpu', 'mainGpu', 'num'],
  ['nKeep', 'nKeep', 'num'],
  ['timeout', 'timeout', 'num'],
  ['tensorSplit', 'tensorSplit', 'str'],
  ['splitMode', 'splitMode', 'str'],
  ['mmap', 'mmap', 'bool'],
  ['mlock', 'mlock', 'bool'],
  ['noKvOffload', 'noKvOffload', 'bool'],
  ['warmup', 'warmup', 'bool'],
  ['reasoningFormat', 'reasoningFormat', 'str'],
  ['reasoning', 'reasoning', 'str'],
  ['reasoningBudget', 'reasoningBudget', 'num'],
  ['reasoningEffort', 'reasoningEffort', 'str'],
  // Échantillonnage
  ['topK', 'topK', 'num'],
  ['topP', 'topP', 'num'],
  ['minP', 'minP', 'num'],
  ['typicalP', 'typicalP', 'num'],
  ['repeatPenalty', 'repeatPenalty', 'num'],
  ['repeatLastN', 'repeatLastN', 'num'],
  ['presencePenalty', 'presencePenalty', 'num'],
  ['frequencyPenalty', 'frequencyPenalty', 'num'],
  ['mirostat', 'mirostat', 'num'],
  ['mirostatTau', 'mirostatTau', 'num'],
  ['mirostatEta', 'mirostatEta', 'num'],
  ['dynatempRange', 'dynatempRange', 'num'],
  ['dynatempExponent', 'dynatempExponent', 'num'],
  ['xtcProbability', 'xtcProbability', 'num'],
  ['xtcThreshold', 'xtcThreshold', 'num'],
  ['seed', 'seed', 'num'],
]

// ============================ Config ============================

async function loadModels() {
  try {
    const d = await api('/api/models')
    const sel = $('modelSel')
    const cur = d.current
    sel.innerHTML = ''
    ;(d.models || []).forEach((m) => {
      const o = document.createElement('option')
      o.value = m.path
      o.textContent = m.name
      if (m.path === cur) o.selected = true
      sel.appendChild(o)
    })
    if (!sel.value && cur) {
      const o = document.createElement('option')
      o.value = cur
      o.textContent = cur.split('\\').pop()
      o.selected = true
      sel.appendChild(o)
    }
  } catch (e) { /* ignore */ }
}

async function loadConfig() {
  try {
    const c = await api('/api/config')
    for (const [id, key, type] of FIELD_MAP) {
      const el = $(id)
      if (!el) continue
      if (type === 'bool') el.checked = c[key] === true
      else el.value = c[key] != null ? c[key] : ''
    }
  } catch (e) { /* ignore */ }
}

function collectConfig() {
  const out = { model: $('modelSel').value }
  for (const [id, key, type] of FIELD_MAP) {
    const el = $(id)
    if (!el) continue
    if (type === 'bool') out[key] = el.checked
    else if (type === 'num') out[key] = Number(el.value)
    else out[key] = el.value
  }
  return out
}

// ============================ Profils par modele ============================

function applyProfile(profile) {
  if (!profile) return
  for (const [id, key, type] of FIELD_MAP) {
    const el = $(id)
    if (!el || profile[key] === undefined) continue
    if (type === 'bool') el.checked = profile[key] === true
    else el.value = profile[key]
  }
}

async function loadProfileForModel(model) {
  try {
    const d = await api('/api/model-profile?model=' + encodeURIComponent(model))
    if (d && d.profile) {
      applyProfile(d.profile)
      setMsg('Profil chargé pour ' + model, false)
    } else {
      setMsg('Aucun profil pour ce modèle (valeurs globales utilisées)', false)
    }
  } catch (e) { /* ignore */ }
}

async function saveProfile() {
  const model = $('modelSel').value
  if (!model) { setMsg("Sélectionne d'abord un modèle", true); return }
  setMsg('Enregistrement du profil…')
  try {
    const d = await api('/api/model-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectConfig()),
    })
    if (d.result === 'ok') setMsg('Profil enregistré → ' + model + '.json', false)
    else setMsg(d.result || 'Erreur', true)
  } catch (e) {
    setMsg('Erreur : ' + (e.message || e), true)
  }
}

// ============================ Actions ============================

async function startServer() {
  $('btnStart').disabled = true
  setMsg('Application de la config + ouverture du terminal…')
  try {
    await api('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectConfig()),
    })
    const d = await api('/api/server/start', { method: 'POST' })
    if (d.ok) setMsg('Terminal ouvert — chargement du modèle… (regarde la fenêtre console)')
    else setMsg('Erreur : ' + (d.error || 'inconnue'), true)
  } catch (e) {
    setMsg('Erreur : ' + (e.message || e), true)
  } finally {
    $('btnStart').disabled = false
    refresh()
  }
}

async function stopServer() {
  setMsg('Arrêt du serveur…')
  try {
    const d = await api('/api/server/stop', { method: 'POST' })
    setMsg(d.ok ? 'Serveur arrêté.' : 'Arrêt demandé (ferme aussi la fenêtre console).')
  } catch (e) {
    setMsg('Erreur : ' + (e.message || e), true)
  } finally {
    refresh()
  }
}

async function saveConfig() {
  setMsg('Enregistrement…')
  try {
    const d = await api('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectConfig()),
    })
    if (d.result === 'ok') setMsg('Config enregistrée.')
    else setMsg(d.result || 'Erreur', true)
  } catch (e) {
    setMsg('Erreur : ' + (e.message || e), true)
  }
}

// ============================ Monitoring ============================

async function refresh() {
  try {
    const d = await api('/api/state')
    const s = d.server || {}
    const g = d.gpu || {}

    const dot = $('statusDot')
    const txt = $('statusText')
    dot.className = 'dot ' + (s.running ? 'on' : s.starting ? 'loading' : 'off')
    txt.textContent = s.running ? 'en ligne' : s.starting ? 'chargement…' : 'hors ligne'

    // Statut du modèle (chargement / chargé / aucun)
    const loadFill = $('loadFill')
    const loadStatus = $('loadStatus')
    if (s.running) {
      loadFill.style.width = '100%'
      loadFill.className = 'meter-fill'
      loadStatus.textContent = 'Modèle chargé : ' + (d.config && d.config.model ? d.config.model : '')
    } else if (s.starting) {
      const elapsed = s.startedAt ? Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000) : 0
      loadFill.className = 'meter-fill loading'
      loadStatus.textContent = 'Chargement de ' + (s.loadingModel || (d.config && d.config.model) || '') + '… (' + elapsed + ' s)'
    } else {
      loadFill.style.width = '0%'
      loadFill.className = 'meter-fill'
      loadStatus.textContent = 'Aucun modèle chargé'
    }

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
    $('ctxVal').textContent = fmt(ctx) + ' / ' + fmt(limit) + ' (' + pct + '%)'

    $('healthVal').textContent = (s.health && s.health.status) ? s.health.status : '—'
    $('slotVal').textContent =
      Array.isArray(slots) && slots[0] && typeof slots[0].n_prompt_tokens === 'number'
        ? fmt(slots[0].n_prompt_tokens)
        : '—'
    $('gpuVal').textContent = g.ok ? (g.temp + '°C · ' + g.util + '% · ' + g.power + ' W') : '—'
    $('vramVal').textContent = g.ok ? (fmt(g.memUsed) + ' / ' + fmt(g.memTotal) + ' Mo') : '—'

    if (s.lastError) setMsg(s.lastError, true)
  } catch (e) { /* ignore */ }
}

// ============================ Wiring ============================

$('btnStart').addEventListener('click', startServer)
$('btnStop').addEventListener('click', stopServer)
$('btnSaveCfg').addEventListener('click', saveConfig)
$('btnSaveProfile').addEventListener('click', saveProfile)
$('modelSel').addEventListener('change', () => loadProfileForModel($('modelSel').value))
$('refreshModels').addEventListener('click', loadModels)

loadConfig().then(() => loadModels())
refresh()
setInterval(refresh, 3000)
