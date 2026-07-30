import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast, navigate } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

export async function renderClients(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data: clients } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
  drawList(content, clients || [])
}

function drawList(content, clients) {
  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Clients</div><div class="page-sub">${clients.length} client(s) enregistré(s)</div></div>
      <button class="btn btn-primary" id="add-client">${Icon.plus(16)} Nouveau client</button>
    </div>
    ${clients.length === 0 ? '<div class="empty">Aucun client. Cliquez sur "Nouveau client" ou demandez à JARVIS: "ajoute le client Oups-Club"</div>' : `
    <div class="grid grid-3" id="clients-grid">
      ${clients.map((c) => clientCard(c)).join('')}
    </div>`}`

  document.getElementById('add-client').onclick = () => openForm(content, null)
  content.querySelectorAll('[data-client]').forEach((card) => card.onclick = () => openDetail(content, card.dataset.client))
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const c = clients.find((x) => x.id === b.dataset.edit); openForm(content, c) })
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation()
    if (await confirmDialog('Supprimer ce client ?')) {
      await supabase.from('clients').delete().eq('id', b.dataset.del)
      toast('Client supprimé', 'success')
      renderClients(content)
    }
  })
}

function clientCard(c) {
  return `
    <div class="card client-card" data-client="${c.id}" style="cursor:pointer">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div class="avatar lg" style="background:${c.logo_color};width:48px;height:48px;border-radius:12px;font-size:18px">${escape(initials(c.name, c.company || ''))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escape(c.name)}</div>
          ${c.company ? `<div style="font-size:12px;color:var(--text-3)">${escape(c.company)}</div>` : ''}
        </div>
        <span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-muted'}">${c.status === 'active' ? 'Actif' : 'Inactif'}</span>
      </div>
      ${c.email ? `<div style="font-size:12px;color:var(--text-3);margin-bottom:4px">${escape(c.email)}</div>` : ''}
      ${c.phone ? `<div style="font-size:12px;color:var(--text-3);margin-bottom:4px">${escape(c.phone)}</div>` : ''}
      ${c.notes ? `<div style="font-size:12px;color:var(--text-2);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${escape(c.notes.slice(0, 100))}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:12px">
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">${Icon.edit(13)} Modifier</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-del="${c.id}">${Icon.trash(13)}</button>
      </div>
    </div>`
}

async function openForm(content, client) {
  await modal(client ? 'Modifier le client' : 'Nouveau client', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom du client</label><input id="f-name" value="${escape(client?.name || '')}" placeholder="ex: Oups-Club"></div>
      <div class="field"><label>Entreprise</label><input id="f-company" value="${escape(client?.company || '')}" placeholder="Nom de l'entreprise"></div>
      <div class="form-row">
        <div class="field"><label>Email</label><input id="f-email" value="${escape(client?.email || '')}" placeholder="contact@exemple.com"></div>
        <div class="field"><label>Téléphone</label><input id="f-phone" value="${escape(client?.phone || '')}" placeholder="06 12 34 56 78"></div>
      </div>
      <div class="field"><label>Adresse</label><input id="f-address" value="${escape(client?.address || '')}" placeholder="Adresse"></div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">
          <option value="active" ${client?.status === 'active' || !client ? 'selected' : ''}>Actif</option>
          <option value="inactive" ${client?.status === 'inactive' ? 'selected' : ''}>Inactif</option>
        </select></div>
        <div class="field"><label>Couleur</label><input type="color" id="f-color" value="${client?.logo_color || '#2563eb'}" style="height:40px;width:60px;border:1px solid var(--border);border-radius:8px;cursor:pointer"></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="f-notes">${escape(client?.notes || '')}</textarea></div>`
  }, async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      company: document.getElementById('f-company').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      status: document.getElementById('f-status').value,
      logo_color: document.getElementById('f-color').value,
      notes: document.getElementById('f-notes').value.trim(),
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }
    if (client) {
      await supabase.from('clients').update(payload).eq('id', client.id)
      toast('Client mis à jour', 'success')
    } else {
      await supabase.from('clients').insert(payload)
      toast('Client créé', 'success')
    }
    renderClients(content)
  })
}

async function openDetail(content, clientId) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: client }, { data: tasks }, { data: projects }, { data: docs }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
  ])

  if (!client) { toast('Client introuvable', 'error'); renderClients(content); return }

  const activeTasks = (tasks || []).filter((t) => t.status !== 'done')
  const doneTasks = (tasks || []).filter((t) => t.status === 'done')

  content.innerHTML = `
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:14px">
        <button class="btn btn-ghost btn-icon" id="back-btn">${Icon.arrow(16)}</button>
        <div class="avatar lg" style="background:${client.logo_color};width:52px;height:52px;border-radius:14px;font-size:20px">${escape(initials(client.name, client.company || ''))}</div>
        <div>
          <div class="page-title">${escape(client.name)}</div>
          <div class="page-sub">${escape(client.company || '')} ${client.email ? '· ' + escape(client.email) : ''} ${client.phone ? '· ' + escape(client.phone) : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="edit-client">${Icon.edit(16)} Modifier</button>
        <button class="btn btn-primary" id="add-task-client">${Icon.plus(16)} Tâche</button>
      </div>
    </div>

    ${client.notes ? `<div class="card" style="margin-bottom:18px"><div style="font-size:13px;color:var(--text-2)">${escape(client.notes)}</div></div>` : ''}

    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card stat-mini"><div class="stat-num">${(projects || []).length}</div><div class="stat-label">Projets</div></div>
      <div class="card stat-mini"><div class="stat-num">${activeTasks.length}</div><div class="stat-label">Tâches actives</div></div>
      <div class="card stat-mini"><div class="stat-num">${(docs || []).length}</div><div class="stat-label">Documents</div></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div class="card-title">Tâches (${(tasks || []).length})</div></div>
        <div style="padding:4px">
          ${(tasks || []).length === 0 ? '<div class="empty">Aucune tâche</div>' : (tasks || []).map((t) => `
            <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <span class="priority-dot priority-${t.priority}"></span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500">${escape(t.title)}</div>
                <div style="font-size:11px;color:var(--text-3)">${t.status === 'todo' ? 'À faire' : t.status === 'doing' ? 'En cours' : t.status === 'review' ? 'Revue' : 'Terminé'}${t.assignee ? ' · ' + escape(t.assignee) : ''}${t.due_date ? ' · ' + new Date(t.due_date).toLocaleDateString('fr-FR') : ''}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Projets (${(projects || []).length})</div></div>
        <div style="padding:4px">
          ${(projects || []).length === 0 ? '<div class="empty">Aucun projet</div>' : (projects || []).map((p) => `
            <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <div style="width:8px;height:8px;border-radius:50%;background:${p.color}"></div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500">${escape(p.name)}</div>
                <div style="font-size:11px;color:var(--text-3)">${p.status === 'planning' ? 'Planification' : p.status === 'active' ? 'En cours' : 'Terminé'} · ${p.progress || 0}%</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-head"><div class="card-title">Documents (${(docs || []).length})</div></div>
      <div style="padding:4px">
        ${(docs || []).length === 0 ? '<div class="empty">Aucun document</div>' : (docs || []).map((d) => `
          <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
            ${Icon.briefcase(15)}
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${escape(d.name)}</div>
              <div style="font-size:11px;color:var(--text-3)">${escape(d.type || 'Fichier')}${d.uploaded_by ? ' · ' + escape(d.uploaded_by) : ''}</div>
            </div>
            ${d.file_url ? `<a href="${d.file_url}" target="_blank" class="btn btn-ghost btn-sm">Ouvrir</a>` : ''}
          </div>`).join('')}
      </div>
    </div>`

  document.getElementById('back-btn').onclick = () => renderClients(content)
  document.getElementById('edit-client').onclick = () => openForm(content, client)
  document.getElementById('add-task-client').onclick = () => navigate('tasks')
}
