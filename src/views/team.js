import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

export async function renderTeam(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data: team } = await supabase.from('team_members').select('*').order('created_at', { ascending: false })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Équipe</div><div class="page-sub">${(team || []).length} collaborateurs</div></div>
      <button class="btn btn-primary" id="add-member">${Icon.plus(16)} Ajouter</button>
    </div>
    <div class="team-grid" id="team-grid">
      ${(team || []).map(memberCard).join('') || '<div class="empty">Aucun membre</div>'}
    </div>`

  document.getElementById('add-member').onclick = () => openForm(content)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, team.find((m) => m.id === b.dataset.edit)))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce collaborateur ?')) {
      await supabase.from('team_members').delete().eq('id', b.dataset.del)
      toast('Membre supprimé', 'success')
      renderTeam(content)
    }
  })
}

function memberCard(m) {
  return `
    <div class="card team-card">
      <div style="display:flex;gap:6px;position:absolute;top:14px;right:14px">
        <button class="btn btn-ghost btn-sm btn-icon" data-edit="${m.id}">${Icon.edit(13)}</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-del="${m.id}">${Icon.trash(13)}</button>
      </div>
      <div class="avatar lg" style="background:${avatarColor(m.first_name + m.last_name)}">${initials(m.first_name, m.last_name)}</div>
      <div class="team-name">${escape(m.first_name)} ${escape(m.last_name)}</div>
      <div class="team-role">${escape(m.role || '—')}</div>
      <span class="badge ${m.status === 'active' ? 'badge-success' : 'badge-neutral'}">${m.status}</span>
      <div class="team-contact">
        <div>${escape(m.department || '—')}</div>
        ${m.email ? `<div>${escape(m.email)}</div>` : ''}
        ${m.phone ? `<div>${escape(m.phone)}</div>` : ''}
      </div>
    </div>`
}

async function openForm(content, m = {}) {
  await modal(m.id ? 'Modifier le membre' : 'Nouveau membre', (body) => {
    body.innerHTML = `
      <div class="form-row">
        <div class="field"><label>Prénom</label><input id="f-first" value="${escape(m.first_name || '')}"></div>
        <div class="field"><label>Nom</label><input id="f-last" value="${escape(m.last_name || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Fonction</label><input id="f-role" value="${escape(m.role || '')}"></div>
        <div class="field"><label>Service</label><input id="f-dept" value="${escape(m.department || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Email</label><input id="f-email" value="${escape(m.email || '')}"></div>
        <div class="field"><label>Téléphone</label><input id="f-phone" value="${escape(m.phone || '')}"></div>
      </div>
      <div class="field"><label>Statut</label><select id="f-status">
        <option value="active" ${m.status === 'active' ? 'selected' : ''}>Actif</option>
        <option value="away" ${m.status === 'away' ? 'selected' : ''}>Absent</option>
        <option value="inactive" ${m.status === 'inactive' ? 'selected' : ''}>Inactif</option>
      </select></div>`
  }, async () => {
    const payload = {
      first_name: document.getElementById('f-first').value.trim(),
      last_name: document.getElementById('f-last').value.trim(),
      role: document.getElementById('f-role').value.trim(),
      department: document.getElementById('f-dept').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      status: document.getElementById('f-status').value,
    }
    if (!payload.first_name || !payload.last_name) { toast('Nom et prénom requis', 'error'); return false }
    if (m.id) {
      await supabase.from('team_members').update(payload).eq('id', m.id)
      toast('Membre mis à jour', 'success')
    } else {
      await supabase.from('team_members').insert(payload)
      toast('Membre ajouté', 'success')
    }
    renderTeam(content)
  })
}
