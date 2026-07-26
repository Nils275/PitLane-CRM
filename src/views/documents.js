import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const fileIcon = (type) => {
  if (!type) return Icon.briefcase(18)
  if (type.includes('pdf')) return '📄'
  if (type.includes('image')) return '🖼️'
  if (type.includes('video')) return '🎬'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  if (type.includes('word') || type.includes('document')) return '📝'
  return Icon.briefcase(18)
}

const fmtSize = (b) => {
  if (!b) return '—'
  if (b < 1024) return b + ' o'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko'
  return (b / 1024 / 1024).toFixed(1) + ' Mo'
}

export async function renderDocuments(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: docs }, { data: projects }] = await Promise.all([
    supabase.from('documents').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('id,name,color').order('name'),
  ])

  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p]))
  const grouped = { none: [] }
  ;(projects || []).forEach((p) => grouped[p.id] = [])
  ;(docs || []).forEach((d) => {
    const key = d.project_id || 'none'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(d)
  })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Documents</div><div class="page-sub">${(docs || []).length} document(s) organisés par projet</div></div>
      <button class="btn btn-primary" id="add-doc">${Icon.plus(16)} Ajouter un document</button>
    </div>
    ${Object.entries(grouped).map(([key, items]) => {
      if (key === 'none' && !items.length) return ''
      const proj = key === 'none' ? null : projectMap[key]
      return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-head">
            <div class="card-title" style="display:flex;align-items:center;gap:8px">
              ${proj ? `<span style="width:10px;height:10px;border-radius:50%;background:${proj.color || 'var(--primary)'}"></span>${escape(proj.name)}` : 'Documents généraux'}
            </div>
            <span class="badge badge-neutral">${items.length}</span>
          </div>
          <div style="padding:8px">
            ${items.map(docRow).join('') || '<div class="empty">Aucun document</div>'}
          </div>
        </div>`
    }).join('')}`

  document.getElementById('add-doc').onclick = () => openForm(content, {})
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, docs.find((d) => d.id === b.dataset.edit)))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce document ?')) {
      await supabase.from('documents').delete().eq('id', b.dataset.del)
      toast('Document supprimé', 'success')
      renderDocuments(content)
    }
  })
  content.querySelectorAll('[data-lock]').forEach((b) => b.onclick = async () => {
    const d = docs.find((x) => x.id === b.dataset.lock)
    await supabase.from('documents').update({ locked: !d.locked }).eq('id', d.id)
    renderDocuments(content)
  })
}

function docRow(d) {
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
      <div style="width:40px;height:40px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;font-size:18px;flex-shrink:0">${fileIcon(d.type)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px">
          ${escape(d.name)}
          ${d.locked ? `<span title="Verrouillé">🔒</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text-3)">${fmtSize(d.size)} · ${d.uploaded_by} · ${new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
      </div>
      <div style="display:flex;gap:4px">
        ${d.file_url ? `<a href="${d.file_url}" target="_blank" class="btn btn-ghost btn-sm btn-icon" title="Ouvrir">${Icon.arrow(14)}</a>` : ''}
        <button class="btn btn-ghost btn-sm btn-icon" data-lock="${d.id}" title="Verrouiller">${d.locked ? '🔓' : '🔒'}</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-edit="${d.id}">${Icon.edit(13)}</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-del="${d.id}">${Icon.trash(13)}</button>
      </div>
    </div>`
}

async function openForm(content, d = {}) {
  const { data: projects } = await supabase.from('projects').select('id,name')
  await modal(d.id ? 'Modifier le document' : 'Nouveau document', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom</label><input id="f-name" value="${escape(d.name || '')}" placeholder="ex: Cahier des charges"></div>
      <div class="field"><label>Projet</label><select id="f-project"><option value="">Documents généraux</option>${(projects || []).map((p) => `<option value="${p.id}" ${d.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Fichier (URL)</label><input id="f-url" value="${escape(d.file_url || '')}" placeholder="https://... (PDF, image, etc.)"></div>
      <div class="form-row">
        <div class="field"><label>Taille (octets)</label><input type="number" id="f-size" value="${d.size || 0}"></div>
        <div class="field"><label>Type MIME</label><input id="f-type" value="${escape(d.type || '')}" placeholder="application/pdf"></div>
      </div>`
  }, async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      project_id: document.getElementById('f-project').value || null,
      file_url: document.getElementById('f-url').value.trim(),
      size: Number(document.getElementById('f-size').value) || 0,
      type: document.getElementById('f-type').value.trim(),
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }
    if (d.id) {
      await supabase.from('documents').update(payload).eq('id', d.id)
      toast('Document mis à jour', 'success')
    } else {
      await supabase.from('documents').insert(payload)
      toast('Document ajouté', 'success')
    }
    renderDocuments(content)
  })
}
