import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape, initials, avatarColor } from './dashboard.js'
import { getCurrentUser } from './login.js'

const COLUMNS = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'review', label: 'Revue' },
  { id: 'done', label: 'Terminé' },
]

let filterMine = false

function myFullName(user) {
  if (!user) return null
  // user.name is the first name (e.g. "Julien"); match team member by first name
  return user.name
}

function isAssignedToMe(task, user) {
  if (!user) return false
  const assignee = (task.assignee || '').toLowerCase()
  return assignee.startsWith(user.name.toLowerCase() + ' ') || assignee === user.name.toLowerCase()
}

export async function renderTasks(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const user = getCurrentUser()
  const [{ data: tasks }, { data: projects }, { data: team }, { data: clients }] = await Promise.all([
    supabase.from('tasks').select('*').order('order', { ascending: true }),
    supabase.from('projects').select('id,name'),
    supabase.from('team_members').select('*'),
    supabase.from('clients').select('id,name,logo_color'),
  ])

  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))
  const teamMap = Object.fromEntries((team || []).map((m) => [`${m.first_name} ${m.last_name}`, m]))
  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))

  const visibleTasks = filterMine && user ? (tasks || []).filter((t) => isAssignedToMe(t, user)) : (tasks || [])
  const myCount = user ? (tasks || []).filter((t) => isAssignedToMe(t, user)).length : 0

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Tâches</div><div class="page-sub">${filterMine ? 'Tâches qui vous sont assignées' : 'Toutes les tâches'} · Glissez-déposez pour organiser</div></div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="seg-toggle">
          <button class="seg-btn ${!filterMine ? 'active' : ''}" data-filter="all">Toutes (${(tasks || []).length})</button>
          <button class="seg-btn ${filterMine ? 'active' : ''}" data-filter="mine">Mes tâches (${myCount})</button>
        </div>
        <button class="btn btn-primary" id="add-task">${Icon.plus(16)} Nouvelle tâche</button>
      </div>
    </div>
    <div class="kanban" id="kanban">
      ${COLUMNS.map((col) => {
        const items = visibleTasks.filter((t) => t.status === col.id)
        return `
          <div class="kanban-col">
            <div class="kanban-col-head">
              <div class="kanban-col-title"><span class="priority-dot priority-${col.id === 'done' ? 'low' : col.id === 'doing' ? 'medium' : col.id === 'review' ? 'medium' : 'low'}"></span>${col.label}</div>
              <span class="kanban-col-count">${items.length}</span>
            </div>
            <div class="kanban-col-body" data-status="${col.id}">
              ${items.map((t) => taskCard(t, projectMap, teamMap, user, clientMap)).join('')}
            </div>
            <button class="kanban-add" data-add="${col.id}">${Icon.plus(14)} Ajouter</button>
          </div>`
      }).join('')}
    </div>`

  content.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { filterMine = b.dataset.filter === 'mine'; renderTasks(content) })
  content.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => openTaskForm(content, { status: b.dataset.add }, user))
  document.getElementById('add-task').onclick = () => openTaskForm(content, {}, user)

  let dragId = null
  content.querySelectorAll('.kanban-card').forEach((card) => {
    card.draggable = true
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move' })
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragId = null })
    card.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); openTaskForm(content, tasks.find((t) => t.id === card.dataset.id), user) }
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

function taskCard(t, projectMap, teamMap, user, clientMap) {
  const m = teamMap[t.assignee]
  const mine = user && isAssignedToMe(t, user)
  const client = clientMap[t.client_id]
  return `
    <div class="kanban-card${mine ? ' mine' : ''}" data-id="${t.id}">
      <div class="kanban-card-title">${escape(t.title)}</div>
      ${t.description ? `<div style="font-size:12px;color:var(--text-3);margin-bottom:6px">${escape(t.description.slice(0, 80))}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
        <span class="tag"><span class="priority-dot priority-${t.priority}" style="margin-right:5px"></span>${t.priority}</span>
        ${t.project_id ? `<span class="tag">${escape(projectMap[t.project_id] || 'Projet')}</span>` : ''}
        ${client ? `<span class="tag" style="background:${client.logo_color}22;color:${client.logo_color}">${escape(client.name)}</span>` : ''}
        ${mine ? '<span class="tag" style="background:var(--primary-soft);color:var(--primary)">Moi</span>' : ''}
      </div>
      <div class="kanban-card-meta">
        <div class="kanban-card-assignee">
          ${m ? `<div class="avatar sm" style="background:${avatarColor(t.assignee)}">${initials(m.first_name, m.last_name)}</div>` : ''}
          ${escape(t.assignee || 'Non assigné')}
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          ${t.due_date ? `<span style="font-size:11px;color:var(--text-3)">${new Date(t.due_date).toLocaleDateString('fr-FR')}</span>` : ''}
          <button class="btn btn-ghost btn-sm btn-icon edit-btn">${Icon.edit(13)}</button>
          <button class="btn btn-ghost btn-sm btn-icon del-btn">${Icon.trash(13)}</button>
        </div>
      </div>
    </div>`
}

async function openTaskForm(content, task, user) {
  const { data: projects } = await supabase.from('projects').select('id,name')
  const { data: team } = await supabase.from('team_members').select('*')
  const { data: clients } = await supabase.from('clients').select('id,name').order('name', { ascending: true })

  // Pre-select the current user as assignee for new tasks
  let defaultAssignee = task.assignee || ''
  if (!task.id && user) {
    const me = (team || []).find((m) => m.first_name.toLowerCase() === user.name.toLowerCase())
    if (me) defaultAssignee = `${me.first_name} ${me.last_name}`
  }

  await modal(task.id ? 'Modifier la tâche' : 'Nouvelle tâche', (body) => {
    body.innerHTML = `
      <div class="field"><label>Titre</label><input id="f-title" value="${escape(task.title || '')}" placeholder="Titre de la tâche"></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${escape(task.description || '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Statut</label><select id="f-status">
          ${COLUMNS.map((c) => `<option value="${c.id}" ${task.status === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select></div>
        <div class="field"><label>Priorité</label><select id="f-priority">
          ${['low', 'medium', 'high'].map((p) => `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${p === 'low' ? 'Basse' : p === 'medium' ? 'Moyenne' : 'Haute'}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${task.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${(projects || []).map((p) => `<option value="${p.id}" ${task.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Responsable</label><select id="f-assignee"><option value="">—</option>${(team || []).map((m) => `<option value="${m.first_name} ${m.last_name}" ${defaultAssignee === `${m.first_name} ${m.last_name}` ? 'selected' : ''}>${escape(m.first_name)} ${escape(m.last_name)}</option>`).join('')}</select></div>
        <div class="field"><label>Date limite</label><input type="date" id="f-due" value="${task.due_date || ''}"></div>
      </div>`
  }, async () => {
    const payload = {
      title: document.getElementById('f-title').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      status: document.getElementById('f-status').value,
      priority: document.getElementById('f-priority').value,
      project_id: document.getElementById('f-project').value || null,
      client_id: document.getElementById('f-client').value || null,
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
