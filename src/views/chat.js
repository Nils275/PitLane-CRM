import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'
import { getCurrentUser } from './login.js'

export async function renderChat(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const user = getCurrentUser()
  const authorName = user ? user.name : 'Moi'
  const { data: channels } = await supabase.from('channels').select('*').order('created_at', { ascending: true })
  let activeId = (channels && channels[0] && channels[0].id) || null

  async function loadMessages(id) {
    const { data } = await supabase.from('messages').select('*').eq('channel_id', id).order('created_at', { ascending: true })
    return data || []
  }

  async function draw() {
    const msgs = activeId ? await loadMessages(activeId) : []
    const active = (channels || []).find((c) => c.id === activeId)
    const myMsgCount = user ? msgs.filter((m) => (m.author || '').toLowerCase() === user.name.toLowerCase()).length : 0

    content.innerHTML = `
      <div class="page-head">
        <div><div class="page-title">Discussions</div><div class="page-sub">Communication d'équipe · Connecté en tant que ${escape(authorName)}</div></div>
        <button class="btn" id="add-chan">${Icon.plus(16)} Salon</button>
      </div>
      <div class="chat">
        <div class="chat-channels">
          <h4>Salons</h4>
          ${(channels || []).map((c) => `
            <button class="chan-item ${c.id === activeId ? 'active' : ''}" data-chan="${c.id}">${Icon.chat(15)} ${escape(c.name)}</button>
          `).join('') || '<div class="empty">Aucun salon</div>'}
        </div>
        <div class="chat-main">
          ${active ? `
            <div class="chat-head">
              <div><h3>#${escape(active.name)}</h3><p>${escape(active.topic || '')} · ${msgs.length} message(s) · ${myMsgCount} de vous</p></div>
              <button class="btn btn-ghost btn-sm btn-icon" data-del-chan="${active.id}">${Icon.trash(15)}</button>
            </div>
            <div class="chat-msgs" id="msgs">
              ${msgs.map((m) => msgHTML(m, user)).join('') || '<div class="empty">Aucun message. Lancez la conversation !</div>'}
            </div>
            <div class="chat-input">
              <input id="msg-input" placeholder="Écrivez un message en tant que ${escape(authorName)}..." autocomplete="off">
              <button class="btn btn-primary btn-icon" id="send-btn">${Icon.send(16)}</button>
            </div>` : '<div class="empty" style="flex:1;display:grid;place-items:center">Sélectionnez un salon</div>'}
        </div>
      </div>`

    content.querySelectorAll('[data-chan]').forEach((b) => b.onclick = () => { activeId = b.dataset.chan; draw() })
    document.getElementById('add-chan').onclick = () => addChannel()
    const del = content.querySelector('[data-del-chan]')
    if (del) del.onclick = async () => {
      if (await confirmDialog('Supprimer ce salon et ses messages ?')) {
        await supabase.from('channels').delete().eq('id', activeId)
        toast('Salon supprimé', 'success')
        activeId = null
        renderChat(content)
      }
    }

    const input = document.getElementById('msg-input')
    const sendBtn = document.getElementById('send-btn')
    if (input && sendBtn) {
      const send = async () => {
        const text = input.value.trim()
        if (!text) return
        await supabase.from('messages').insert({ channel_id: activeId, author: authorName, content: text })
        input.value = ''
        draw()
      }
      sendBtn.onclick = send
      input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
      input.focus()
      const msgsEl = document.getElementById('msgs')
      if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight
    }
  }

  async function addChannel() {
    await modal('Nouveau salon', (body) => {
      body.innerHTML = `
        <div class="field"><label>Nom du salon</label><input id="f-name" placeholder="ex: marketing"></div>
        <div class="field"><label>Description</label><input id="f-topic" placeholder="Sujet du salon"></div>`
    }, async () => {
      const name = document.getElementById('f-name').value.trim()
      if (!name) { toast('Nom requis', 'error'); return false }
      const { data } = await supabase.from('channels').insert({ name, topic: document.getElementById('f-topic').value.trim() }).select().single()
      toast('Salon créé', 'success')
      activeId = data.id
      renderChat(content)
    })
  }

  draw()
}

function msgHTML(m, user) {
  const time = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const isMe = user && (m.author || '').toLowerCase() === user.name.toLowerCase()
  const avatarBg = isMe ? (user.avatar_color || '#2563eb') : '#475569'
  return `
    <div class="msg${isMe ? ' mine' : ''}">
      <div class="avatar sm" style="background:${avatarBg}">${escape((m.author || '?')[0])}</div>
      <div class="msg-body">
        <div class="msg-author">${escape(m.author)} ${isMe ? '<span class="tag" style="background:var(--primary-soft);color:var(--primary);margin-left:4px">Vous</span>' : ''}<span class="msg-time">${time}</span></div>
        <div class="msg-text">${escape(m.content)}</div>
      </div>
    </div>`
}
