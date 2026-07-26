import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const STATUSES = ['planning', 'active', 'on-hold', 'completed']

export async function renderProjects(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data: projects } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  const { data: tasks } = await supabase.from('tasks').select('id,project_id,status')

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Projets</div><div class="page-sub">${(projects || []).length} projets</div></div>
      <button class="btn btn-primary" id="add-proj">${Icon.plus(16)} Nouveau projet</button>
    </div>
    <div class="grid grid-3" id="proj-grid">
      ${(projects || []).map((p) => projectCard(p, tasks || [])).join('') || '<div class="empty">Aucun projet. Créez-en un !</div>'}
    </div>`

  document.getElementById('add-proj').onclick = () => openForm(content)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, projects.find((p) => p.id === b.dataset.edit)))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce projet ?')) {
      await supabase.from('projects').delete().eq('id', b.dataset.del)
      toast('Projet supprimé', 'success')
      renderProjects(content)
    }
  })
}

function projectCard(p, tasks) {
  const projTasks = tasks.filter((t) => t.project_id === p.id)
  const done = projTasks.filter((t) => t.status === 'done').length
  const total = projTasks.length
  const pct = total ? Math.round((done / total) * 100) : (p.progress || 0)
  return `
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:10px;height:10px;border-radius:50%;background:${p.color}"></div>
          <div style="font-size:15px;font-weight:700">${escape(p.name)}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm btn-icon" data-edit="${p.id}">${Icon.edit(14)}</button>
          <button class="btn btn-ghost btn-sm btn-icon" data-del="${p.id}">${Icon.trash(14)}</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-3);margin-bottom:12px;min-height:38px">${escape(p.description || 'Aucune description')}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span class="badge badge-neutral">${escape(p.client || '—')}</span>
        <span class="badge ${p.status === 'active' ? 'badge-success' : p.status === 'completed' ? 'badge-primary' : 'badge-warning'}">${p.status}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:6px">
        <span>${done}/${total} tâches</span><span>${pct}%</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${p.color}"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--text-3)">
        <span>Budget: <strong style="color:var(--text)">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p.budget || 0)}</strong></span>
        ${p.end_date ? `<span>${new Date(p.end_date).toLocaleDateString('fr-FR')}</span>` : ''}
      </div>
    </div>`
}

async function openForm(content, project = {}) {
  await modal(project.id ? 'Modifier le projet' : 'Nouveau projet', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom</label><input id="f-name" value="${escape(project.name || '')}"></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${escape(project.description || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Client</label><input id="f-client" value="${escape(project.client || '')}"></div>
        <div class="field"><label>Budget (€)</label><input type="number" id="f-budget" value="${project.budget || 0}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">${STATUSES.map((s) => `<option value="${s}" ${project.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Couleur</label><input type="color" id="f-color" value="${project.color || '#2563eb'}" style="height:38px"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Début</label><input type="date" id="f-start" value="${project.start_date || ''}"></div>
        <div class="field"><label>Fin</label><input type="date" id="f-end" value="${project.end_date || ''}"></div>
      </div>`
  }, async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      client: document.getElementById('f-client').value.trim(),
      budget: Number(document.getElementById('f-budget').value) || 0,
      status: document.getElementById('f-status').value,
      color: document.getElementById('f-color').value,
      start_date: document.getElementById('f-start').value || null,
      end_date: document.getElementById('f-end').value || null,
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }
    if (project.id) {
      await supabase.from('projects').update(payload).eq('id', project.id)
      toast('Projet mis à jour', 'success')
    } else {
      await supabase.from('projects').insert(payload)
      toast('Projet créé', 'success')
    }
    renderProjects(content)
  })
}
