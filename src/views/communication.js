import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape as esc } from './dashboard.js'

const CHANNELS = ['email', 'téléphone', 'réunion', 'visio', 'message', 'courrier']
const DIRECTIONS = ['outbound', 'inbound']
const STATUSES = ['sent', 'received', 'planned', 'missed', 'follow-up']

const channelIcon = (c) => {
  if (c === 'email') return '✉️'
  if (c === 'téléphone') return '📞'
  if (c === 'réunion') return '👥'
  if (c === 'visio') return '💻'
  if (c === 'message') return '💬'
  return ' envelopes'
}

export async function renderCommunication(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: comms }, { data: projects }] = await Promise.all([
    supabase.from('communications').select('*').order('comm_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('projects').select('id,name').order('name'),
  ])
  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))

  const byChannel = {}
  ;(comms || []).forEach((c) => { byChannel[c.channel] = (byChannel[c.channel] || 0) + 1 })
  const total = (comms || []).length
  const inbound = (comms || []).filter((c) => c.direction === 'inbound').length
  const outbound = (comms || []).filter((c) => c.direction === 'outbound').length
  const followUp = (comms || []).filter((c) => c.status === 'follow-up').length

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Communication</div><div class="page-sub">Suivi des échanges avec clients et partenaires</div></div>
      <button class="btn btn-primary" id="add-comm">${Icon.plus(16)} Nouvelle communication</button>
    </div>
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-label">Total échanges</div><div class="kpi-value">${total}</div></div>
      <div class="card kpi"><div class="kpi-label">Émis</div><div class="kpi-value" style="color:#2563eb">${outbound}</div></div>
      <div class="card kpi"><div class="kpi-label">Reçus</div><div class="kpi-value" style="color:#dc2626">${inbound}</div></div>
      <div class="card kpi"><div class="kpi-label">À relancer</div><div class="kpi-value" style="color:#f59e0b">${followUp}</div></div>
    </div>
    <div class="card" style="overflow:hidden">
      <div class="card-head"><div class="card-title">Historique des communications</div><span class="badge badge-neutral">${total}</span></div>
      <div style="padding:4px">
        ${(comms || []).map((c) => {
          const proj = c.project_id ? projectMap[c.project_id] : null
          const dirColor = c.direction === 'inbound' ? '#dc2626' : '#2563eb'
          const dirLabel = c.direction === 'inbound' ? 'Reçu' : 'Émis'
          const statusBadge = c.status === 'follow-up' ? '<span class="badge" style="background:rgba(245,158,11,.16);color:#f59e0b">À relancer</span>'
            : c.status === 'planned' ? '<span class="badge badge-neutral">Planifié</span>'
            : c.status === 'missed' ? '<span class="badge" style="background:rgba(220,38,38,.16);color:#dc2626">Manqué</span>'
            : `<span class="badge" style="background:rgba(37,99,235,.16);color:#2563eb">${c.status === 'received' ? 'Reçu' : 'Envoyé'}</span>`
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
              <div style="width:40px;height:40px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;font-size:18px;flex-shrink:0">${channelIcon(c.channel)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:600">${esc(c.subject || '(sans sujet)')}</div>
                <div style="font-size:12px;color:var(--text-3)">${esc(c.contact || '—')} · ${esc(c.channel)} ${proj ? '· ' + esc(proj) : ''} · ${c.user_name ? esc(c.user_name) + ' · ' : ''}${new Date(c.comm_date).toLocaleDateString('fr-FR')}</div>
              </div>
              <span class="badge badge-neutral" style="color:${dirColor};background:${dirColor}22">${dirLabel}</span>
              ${statusBadge}
              <div style="display:flex;gap:2px">
                <button class="btn btn-ghost btn-sm btn-icon" data-edit="${c.id}">${Icon.edit(13)}</button>
                <button class="btn btn-ghost btn-sm btn-icon" data-del="${c.id}">${Icon.trash(13)}</button>
              </div>
            </div>`
        }).join('') || '<div class="empty">Aucune communication enregistrée</div>'}
      </div>
    </div>`

  document.getElementById('add-comm').onclick = () => openForm(content, {}, projects || [])
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, comms.find((c) => c.id === b.dataset.edit), projects || []))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette communication ?')) {
      await supabase.from('communications').delete().eq('id', b.dataset.del)
      toast('Communication supprimée', 'success')
      renderCommunication(content)
    }
  })
}

async function openForm(content, c = {}, projects = []) {
  const dateVal = c.comm_date ? new Date(c.comm_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  await modal(c.id ? 'Modifier' : 'Nouvelle communication', (body) => {
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Canal</label><select id="f-channel">${CHANNELS.map((ch) => `<option value="${ch}" ${c.channel === ch ? 'selected' : ''}>${ch}</option>`).join('')}</select></div>
        <div class="field"><label>Direction</label><select id="f-direction">${DIRECTIONS.map((d) => `<option value="${d}" ${c.direction === d ? 'selected' : ''}>${d === 'inbound' ? 'Reçu' : 'Émis'}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Sujet</label><input id="f-subject" value="${esc(c.subject || '')}" placeholder="ex: Relance facture client"></div>
      <div class="form-row">
        <div class="field"><label>Contact</label><input id="f-contact" value="${esc(c.contact || '')}" placeholder="Nom / entreprise"></div>
        <div class="field"><label>Statut</label><select id="f-status">${STATUSES.map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s === 'sent' ? 'Envoyé' : s === 'received' ? 'Reçu' : s === 'planned' ? 'Planifié' : s === 'missed' ? 'Manqué' : 'À relancer'}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${projects.map((p) => `<option value="${p.id}" ${c.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Date</label><input type="date" id="f-date" value="${dateVal}"></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="f-notes">${esc(c.notes || '')}</textarea></div>`
  }, async () => {
    const payload = {
      channel: document.getElementById('f-channel').value,
      direction: document.getElementById('f-direction').value,
      subject: document.getElementById('f-subject').value.trim(),
      contact: document.getElementById('f-contact').value.trim(),
      status: document.getElementById('f-status').value,
      project_id: document.getElementById('f-project').value || null,
      comm_date: document.getElementById('f-date').value,
      notes: document.getElementById('f-notes').value.trim(),
    }
    if (!payload.subject) { toast('Sujet requis', 'error'); return false }
    if (c.id) {
      await supabase.from('communications').update(payload).eq('id', c.id)
      toast('Communication mise à jour', 'success')
    } else {
      await supabase.from('communications').insert(payload)
      toast('Communication enregistrée', 'success')
    }
    renderCommunication(content)
  })
}
