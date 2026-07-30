import { Icon } from '../icons.js'
import { escape } from './dashboard.js'

let messages = []
let open = false

export function initJarvis() {
  const btn = document.createElement('button')
  btn.className = 'jarvis-fab'
  btn.id = 'jarvis-fab'
  btn.innerHTML = `<span class="jarvis-fab-ico">${Icon.trend(22)}</span><span class="jarvis-fab-pulse"></span>`
  btn.title = 'JARVIS'
  document.body.appendChild(btn)

  const panel = document.createElement('div')
  panel.className = 'jarvis-panel'
  panel.id = 'jarvis-panel'
  panel.innerHTML = `
    <div class="jarvis-head">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="jarvis-avatar">${Icon.trend(18)}</div>
        <div>
          <div style="font-size:14px;font-weight:700">JARVIS</div>
          <div style="font-size:11px;color:var(--text-3)">Assistant IA · En ligne</div>
        </div>
      </div>
      <button class="icon-btn" id="jarvis-close">${Icon.close(16)}</button>
    </div>
    <div class="jarvis-body" id="jarvis-body">
      <div class="jarvis-msg bot">
        <div class="jarvis-msg-ico">${Icon.trend(14)}</div>
        <div class="jarvis-bubble">Bonjour, je suis JARVIS. Posez-moi une question sur vos projets, l'actualité du sport automobile, ou demandez-moi de chercher une information.</div>
      </div>
    </div>
    <div class="jarvis-suggestions" id="jarvis-suggestions">
      <button class="jarvis-chip" data-q="Crée le client Oups-Club">Créer client</button>
      <button class="jarvis-chip" data-q="Crée une tâche: maquette post Instagram pour Oups-Club, assignée à Julien, pour le 31 août">Créer tâche</button>
      <button class="jarvis-chip" data-q="Montre-moi mes tâches">Mes tâches</button>
    </div>
    <div class="jarvis-input-row">
      <input id="jarvis-input" placeholder="Posez votre question à JARVIS..." autocomplete="off">
      <button class="btn btn-primary btn-icon" id="jarvis-send">${Icon.arrow(16)}</button>
    </div>`

  document.body.appendChild(panel)

  btn.onclick = () => toggle(panel)
  document.getElementById('jarvis-close').onclick = () => toggle(panel)
  document.getElementById('jarvis-send').onclick = send
  document.getElementById('jarvis-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') send() })
  panel.querySelectorAll('.jarvis-chip').forEach((c) => c.onclick = () => {
    document.getElementById('jarvis-input').value = c.dataset.q
    send()
  })
}

function toggle(panel) {
  open = !open
  panel.classList.toggle('open', open)
  document.getElementById('jarvis-fab').style.display = open ? 'none' : 'flex'
  if (open) setTimeout(() => document.getElementById('jarvis-input')?.focus(), 100)
}

function addMsg(role, text) {
  const body = document.getElementById('jarvis-body')
  const wrap = document.createElement('div')
  wrap.className = `jarvis-msg ${role === 'user' ? 'user' : 'bot'}`
  wrap.innerHTML = role === 'user'
    ? `<div class="jarvis-bubble user">${escape(text)}</div>`
    : `<div class="jarvis-msg-ico">${Icon.trend(14)}</div><div class="jarvis-bubble">${escape(text)}</div>`
  body.appendChild(wrap)
  body.scrollTop = body.scrollHeight
}

function addTyping() {
  const body = document.getElementById('jarvis-body')
  const wrap = document.createElement('div')
  wrap.className = 'jarvis-msg bot'
  wrap.id = 'jarvis-typing'
  wrap.innerHTML = `<div class="jarvis-msg-ico">${Icon.trend(14)}</div><div class="jarvis-bubble"><div class="jarvis-typing-dots"><span></span><span></span><span></span></div></div>`
  body.appendChild(wrap)
  body.scrollTop = body.scrollHeight
}

function removeTyping() {
  document.getElementById('jarvis-typing')?.remove()
}

async function send() {
  const input = document.getElementById('jarvis-input')
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  addMsg('user', text)
  messages.push({ role: 'user', content: text })

  addTyping()
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-chat`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages }),
    })
    const json = await res.json()
    removeTyping()
    const reply = json.reply || json.error || "Désolé, je n'ai pas pu répondre."
    addMsg('assistant', reply)
    messages.push({ role: 'assistant', content: reply })
    // If JARVIS performed an action, refresh the current page data after a short delay
    if (/cr[ée]e|ajout/i.test(reply)) {
      setTimeout(() => {
        const event = new CustomEvent('jarvis-action')
        window.dispatchEvent(event)
      }, 500)
    }
  } catch (e) {
    removeTyping()
    addMsg('assistant', 'Désolé, une erreur est survenue. Réessayez dans un instant.')
  }
}
