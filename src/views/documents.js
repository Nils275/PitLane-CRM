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
  const [{ data: docs }, { data: projects }, { data: clients }] = await Promise.all([
    supabase.from('documents').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('id,name,color').order('name'),
    supabase.from('clients').select('id,name,logo_color').order('name'),
  ])

  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p]))
  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]))
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
    <div class="drop-zone" id="drop-zone">
      <div style="text-align:center;padding:28px 20px;color:var(--text-3)">
        <div style="font-size:32px;margin-bottom:8px">${Icon.briefcase(32)}</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-2)">Glissez vos fichiers ici</div>
        <div style="font-size:12px;margin-top:4px">ou cliquez sur "Ajouter un document"</div>
      </div>
    </div>
    ${Object.entries(grouped).map(([key, items]) => {
      if (key === 'none' && !items.length) return ''
      const proj = key === 'none' ? null : projectMap[key]
      return `
        <div class="card" style="margin-bottom:16px;margin-top:16px">
          <div class="card-head">
            <div class="card-title" style="display:flex;align-items:center;gap:8px">
              ${proj ? `<span style="width:10px;height:10px;border-radius:50%;background:${proj.color || 'var(--primary)'}"></span>${escape(proj.name)}` : 'Documents généraux'}
            </div>
            <span class="badge badge-neutral">${items.length}</span>
          </div>
          <div style="padding:8px">
            ${items.map((d) => docRow(d, clientMap)).join('') || '<div class="empty">Aucun document</div>'}
          </div>
        </div>`
    }).join('')}`

  setupDropZone(content)
  document.getElementById('add-doc').onclick = () => openForm(content, {}, projects, clients)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, docs.find((d) => d.id === b.dataset.edit), projects, clients))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce document ?')) {
      const d = docs.find((x) => x.id === b.dataset.del)
      if (d?.file_path) {
        await supabase.storage.from('documents').remove([d.file_path])
      }
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

function setupDropZone(content) {
  const zone = document.getElementById('drop-zone')
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.multiple = true
  fileInput.style.display = 'none'
  content.appendChild(fileInput)

  zone.onclick = () => fileInput.click()
  fileInput.onchange = () => {
    if (fileInput.files.length) handleFiles(content, Array.from(fileInput.files))
    fileInput.value = ''
  }

  zone.addEventListener('dragover', (e) => {
    e.preventDefault()
    zone.classList.add('drop-zone--active')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-zone--active'))
  zone.addEventListener('drop', (e) => {
    e.preventDefault()
    zone.classList.remove('drop-zone--active')
    if (e.dataTransfer.files.length) handleFiles(content, Array.from(e.dataTransfer.files))
  })
}

async function handleFiles(content, files) {
  for (const file of files) {
    toast(`Upload de ${file.name}...`, 'info')
    const ext = file.name.split('.').pop()
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadErr) {
      toast(`Erreur upload: ${uploadErr.message}`, 'error')
      continue
    }

    const { data: pubData } = supabase.storage.from('documents').getPublicUrl(filePath)
    const fileUrl = pubData.publicUrl

    await supabase.from('documents').insert({
      name: file.name,
      file_url: fileUrl,
      file_path: filePath,
      size: file.size,
      type: file.type || '',
      uploaded_by: 'Moi',
    })
    toast(`${file.name} ajouté`, 'success')
  }
  renderDocuments(content)
}

function docRow(d, clientMap) {
  const client = clientMap[d.client_id]
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
      <div style="width:40px;height:40px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;font-size:18px;flex-shrink:0">${fileIcon(d.type)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px">
          ${escape(d.name)}
          ${d.locked ? `<span title="Verrouillé">🔒</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:6px">
          ${fmtSize(d.size)} · ${d.uploaded_by} · ${new Date(d.created_at).toLocaleDateString('fr-FR')}
          ${client ? `· <span style="color:${client.logo_color}">${escape(client.name)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:4px">
        ${d.file_url ? `<a href="${d.file_url}" target="_blank" download class="btn btn-ghost btn-sm btn-icon" title="Télécharger">${Icon.arrow(14)}</a>` : ''}
        <button class="btn btn-ghost btn-sm btn-icon" data-lock="${d.id}" title="Verrouiller">${d.locked ? '🔓' : '🔒'}</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-edit="${d.id}">${Icon.edit(13)}</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-del="${d.id}">${Icon.trash(13)}</button>
      </div>
    </div>`
}

async function openForm(content, d = {}, projects, clients) {
  if (!projects) {
    const res = await supabase.from('projects').select('id,name')
    projects = res.data || []
  }
  if (!clients) {
    const res = await supabase.from('clients').select('id,name')
    clients = res.data || []
  }
  await modal(d.id ? 'Modifier le document' : 'Nouveau document', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom</label><input id="f-name" value="${escape(d.name || '')}" placeholder="ex: Cahier des charges"></div>
      <div class="form-row">
        <div class="field"><label>Client</label><select id="f-client"><option value="">—</option>${(clients || []).map((c) => `<option value="${c.id}" ${d.client_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Projet</label><select id="f-project"><option value="">Documents généraux</option>${(projects || []).map((p) => `<option value="${p.id}" ${d.project_id === p.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Fichier</label><div class="drop-zone" id="modal-drop" style="margin-top:4px">
        <div style="text-align:center;padding:16px;color:var(--text-3);font-size:13px">
          ${d.file_url ? `Fichier actuel: ${escape(d.name)}` : 'Glissez un fichier ici ou cliquez'}
        </div>
      </div><input type="file" id="f-file" style="display:none"></div>`
    const modalZone = body.querySelector('#modal-drop')
    const modalInput = body.querySelector('#f-file')
    modalZone.onclick = () => modalInput.click()
    modalZone.addEventListener('dragover', (e) => { e.preventDefault(); modalZone.classList.add('drop-zone--active') })
    modalZone.addEventListener('dragleave', () => modalZone.classList.remove('drop-zone--active'))
    modalZone.addEventListener('drop', (e) => {
      e.preventDefault()
      modalZone.classList.remove('drop-zone--active')
      if (e.dataTransfer.files.length) {
        modalInput.files = e.dataTransfer.files
        modalZone.querySelector('div').textContent = `Fichier sélectionné: ${e.dataTransfer.files[0].name}`
      }
    })
  }, async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      project_id: document.getElementById('f-project').value || null,
      client_id: document.getElementById('f-client').value || null,
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }

    const fileInput = document.getElementById('f-file')
    if (fileInput.files.length) {
      const file = fileInput.files[0]
      const ext = file.name.split('.').pop()
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file)
      if (uploadErr) { toast(`Erreur upload: ${uploadErr.message}`, 'error'); return false }
      const { data: pubData } = supabase.storage.from('documents').getPublicUrl(filePath)
      payload.file_url = pubData.publicUrl
      payload.file_path = filePath
      payload.size = file.size
      payload.type = file.type || ''
      if (!payload.name) payload.name = file.name
    }

    if (d.id) {
      await supabase.from('documents').update(payload).eq('id', d.id)
      toast('Document mis à jour', 'success')
    } else {
      if (!payload.file_url) { toast('Aucun fichier sélectionné', 'error'); return false }
      await supabase.from('documents').insert(payload)
      toast('Document ajouté', 'success')
    }
    renderDocuments(content)
  })
}
