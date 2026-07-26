import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'

const COLUMNS = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'review', label: 'Revue' },
  { id: 'done', label: 'Terminé' },
]

export async function renderTasks(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: tasks }, { data: projects }, { data: team }] = await Promise.all([
    supabase.from('tasks').select('*').order('order', { ascending: true }),
    supabase.from('projects').select('id,name'),
    supabase.from('team_members').select('*'),
  ])

  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))
  const teamMap = Object.fromEntries((team || []).map((m) => [`${m.first_name} ${m.last_name}`, m]))

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Tâches</div><div class="page-sub">Glissez-déposez pour organiser</div></div>
      <button class="btn btn-primary" id="add-task">${Icon.plus(16)} Nouvelle tâche</button>
    </div>
    <div class="kanban" id="kanban">
      ${COLUMNS.map((col) => {
        const items = (tasks || []).filter((t) => t.status === col.id)
        return `
          <div class="kanban-col">
            <div class="kanban-col-head">
              <div class="kanban-col-title"><span class="priority-dot priority-${col.id === 'done' ? 'low' : col.id === 'doing' ? 'medium' : col.id === 'review' ? 'medium' : 'low'}"></span>${col.label}</div>
              <span class="kanban-col-count">${items.length}</span>
            </div>
            <div class="kanban-col-body" data-status="${col.id}">
              ${items.map((t) => taskCard(t, projectMap, teamMap)).join('')}
            </div>
            <button class="kanban-add" data-add="${col.id}">${Icon.plus(14)} Ajouter</button>
          </div>`
      }).join('')}
    </div>`

  // Add buttons
  content.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => openTaskForm(content, { status: b.dataset.add }))
  document.getElementById('add-task').onclick = () => openTaskForm(content, {})

  // Drag and drop
  let dragId = null
  content.querySelectorAll('.kanban-card').forEach((card) => {
    card.draggable = true
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move' })
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragId = null })
    card.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); openTaskForm(content, tasks.find((t) => t.id === card.dataset.id)) }
    card.querySelector('.del-btn').onclick = async (e) => {
      e.stopPropagation()
      if (await confirmDialog('Supprimer cette tâche ?')) {
        await supabase.from('tasks').delete().eq('id', card.dataset.id)
        toast('Tâche supprimée', 'success')
        renderTasks(content)
      }
    }
  })
  content.querySelectorAll('.kanban-col-body').forEach((body) => {
    body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drag-over') })
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'))
    body.addEventListener('drop', async (e) => {
      e.preventDefault()
      body.classList.remove('drag-over')
      if (!dragId) return
      const newStatus = body.dataset.status
      await supabase.from('tasks').update({ status: newStatus }).eq('id', dragId)
      toast('Tâche déplacée', 'success')
      renderTasks(content)
    })
  })
}

function taskCard(t, projectMap, teamMap) {
  const m = teamMap[t.assignee]
  return `
    <div class="kanban-card" data-id="${t.id}">
      <div class="kanban-card-title">${escape(t.title)}</div>
      ${t.description ? `<div style="font-size:12px;color:var(--text-3);margin-bottom:6px">${escape(t.description.slice(0, 80))}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
        <span class="tag"><span class="priority-dot priority-${t.priority}" style="margin-right:5px"></span>${t.priority}</span>
        ${t.project_id ? `<span class="tag">${escape(projectMap[t.project_id] || 'Projet')}</span>` : ''}
      </div>
      <div class="kanban-card-meta">
        <div class="kanban-card-assignee">
          ${m ? `<div class="avatar sm" style="background:${avatarColor(t.assignee)}">${initials(m.first_name, m.last_name)}</div>` : ''}
          ${escape(t.assignee || 'Non assigné')}
        </div>
        <div style="display:flex;gap:4px">
          ${t.due_date ? `<span style="font-size:11px;color:var(--text-3)">${new Date(t.due_date).toLocaleDateString('fr-FR')}</span>` : ''}
          <button class="btn btn-ghost btn-sm btn-icon edit-btn">${Icon.edit(13)}</button>
          <button class="btn btn-ghost btn-sm btn-icon del-btn">${Icon.trash(13)}</button>
        </div>
      </div>
    </div>`
}

async function openTaskForm(content, task) {
  const { data: projects } = await supabase.from('projects').select('id,name')
  const { data: team } = await supabase.from('team_members').select('*')

  await modal(task.id ? 'Modifier la tâche' : 'Nouvelle tâche', (body) => {
    body.innerHTML = `
      <div class="field"><label>Titre</label><input id="f-title" value="${escape(task.title || '')}" placeholder="Titre de la tâche"></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${escape(task.description || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">
          ${COLUMNS.map((c) => `<option value="${c.id}" ${task.status === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select></div>
        <div class="field"><label>Priorité</label><select id="f-priority">
          ${['low', 'medium', 'high'].map((p) => `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${task.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Responsable</label><select id="f-assignee"><option value="">—</option>${(team || []).map((m) => `<option value="${m.first_name} ${m.last_name}" ${task.assignee === `${m.first_name} ${m.last_name}` ? 'selected' : ''}>${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Date limite</label><input type="date" id="f-due" value="${task.due_date || ''}"></div>`
  }, async () => {
    const payload = {
      title: document.getElementById('f-title').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      status: document.getElementById('f-status').value,
      priority: document.getElementById('f-priority').value,
      project_id: document.getElementById('f-project').value || null,
      assignee: document.getElementById('f-assignee').value,
      due_date: document.getElementById('f-due').value || null,
    }
    if (!payload.title) { toast('Titre requis', 'error'); return false }
    if (task.id) {
      await supabase.from('tasks').update(payload).eq('id', task.id)
      toast('Tâche mise à jour', 'success')
    } else {
      await supabase.from('tasks').insert(payload)
      toast('Tâche créée', 'success')
    }
    renderTasks(content)
  })
}
