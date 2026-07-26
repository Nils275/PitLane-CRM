import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape as esc } from './dashboard.js'

const TOOLS = [
  { id: 'canva', label: 'Canva', url: 'https://www.canva.com', color: '#2563eb', icon: '🎨' },
  { id: 'photoshop', label: 'Photoshop', url: 'https://www.adobe.com/products/photoshop.html', color: '#dc2626', icon: '🖌️' },
  { id: 'figma', label: 'Figma', url: 'https://www.figma.com', color: '#0891b2', icon: '🎭' },
  { id: 'illustrator', label: 'Illustrator', url: 'https://www.adobe.com/products/illustrator.html', color: '#f59e0b', icon: '✏️' },
  { id: 'indesign', label: 'InDesign', url: 'https://www.adobe.com/products/indesign.html', color: '#7c3aed', icon: '📐' },
  { id: 'custom', label: 'Autre', url: '', color: '#64748b', icon: '🔗' },
]

const TYPES = ['design', 'document', 'présentation', 'vidéo', 'social', 'print']

const toolIcon = (t) => TOOLS.find((x) => x.id === t)?.icon || '🔗'

export async function renderTemplates(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: templates }, { data: projects }] = await Promise.all([
    supabase.from('templates').select('*').order('created_at', { ascending: false }),
    supabase.from('projects').select('id,name').order('name'),
  ])
  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name]))

  const byTool = {}
  ;(templates || []).forEach((t) => { byTool[t.tool] = (byTool[t.tool] || 0) + 1 })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Templates</div><div class="page-sub">Accédez rapidement à vos outils de création</div></div>
      <button class="btn btn-primary" id="add-tpl">${Icon.plus(16)} Ajouter un template</button>
    </div>
    <div class="grid grid-4" style="margin-bottom:18px">
      ${TOOLS.filter((t) => t.id !== 'custom').map((t) => `
        <div class="card kpi" style="cursor:pointer" data-tool="${t.id}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:8px;background:${t.color}22;display:grid;place-items:center;font-size:18px">${t.icon}</div>
            <div>
              <div style="font-size:13px;font-weight:600">${t.label}</div>
              <div style="font-size:11px;color:var(--text-3)">${byTool[t.id] || 0} template(s)</div>
            </div>
          </div>
        </div>`).join('')}
    </div>
    <div class="card" style="overflow:hidden">
      <div class="card-head"><div class="card-title">Tous les templates</div><span class="badge badge-neutral">${(templates || []).length}</span></div>
      <div style="padding:8px">
        ${(templates || []).map((t) => {
          const tool = TOOLS.find((x) => x.id === t.tool) || TOOLS[5]
          const proj = t.project_id ? projectMap[t.project_id] : null
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
              <div style="width:44px;height:44px;border-radius:8px;background:${tool.color}22;display:grid;place-items:center;font-size:20px;flex-shrink:0">${tool.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:600">${esc(t.name)}</div>
                <div style="font-size:12px;color:var(--text-3)">${tool.label} · ${esc(t.type)} ${proj ? '· ' + esc(proj) : ''}</div>
                ${t.description ? `<div style="font-size:12px;color:var(--text-2);margin-top:2px">${esc(t.description)}</div>` : ''}
              </div>
              <a href="${esc(t.url)}" target="_blank" class="btn btn-primary btn-sm" style="text-decoration:none">Ouvrir ${Icon.arrow(12)}</a>
              <button class="btn btn-ghost btn-sm btn-icon" data-edit="${t.id}">${Icon.edit(13)}</button>
              <button class="btn btn-ghost btn-sm btn-icon" data-del="${t.id}">${Icon.trash(13)}</button>
            </div>`
        }).join('') || '<div class="empty">Aucun template. Cliquez sur "Ajouter un template" pour commencer.</div>'}
      </div>
    </div>`

  document.getElementById('add-tpl').onclick = () => openForm(content, {}, projects || [])
  content.querySelectorAll('[data-tool]').forEach((c) => c.onclick = () => {
    const tool = TOOLS.find((x) => x.id === c.dataset.tool)
    if (tool?.url) window.open(tool.url, '_blank')
  })
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, templates.find((t) => t.id === b.dataset.edit), projects || []))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer ce template ?')) {
      await supabase.from('templates').delete().eq('id', b.dataset.del)
      toast('Template supprimé', 'success')
      renderTemplates(content)
    }
  })
}

async function openForm(content, t = {}, projects = []) {
  await modal(t.id ? 'Modifier le template' : 'Nouveau template', (body) => {
    body.innerHTML = `
      <div class="field"><label>Nom</label><input id="f-name" value="${esc(t.name || '')}" placeholder="ex: Affiche Grand Prix"></div>
      <div class="form-row">
        <div class="field"><label>Outil</label><select id="f-tool">${TOOLS.map((tool) => `<option value="${tool.id}" ${t.tool === tool.id ? 'selected' : ''}>${tool.label}</option>`).join('')}</select></div>
        <div class="field"><label>Type</label><select id="f-type">${TYPES.map((ty) => `<option value="${ty}" ${t.type === ty ? 'selected' : ''}>${ty}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>URL du template</label><input id="f-url" value="${esc(t.url || '')}" placeholder="https://www.canva.com/design/..."></div>
      <div class="field"><label>Projet</label><select id="f-project"><option value="">—</option>${projects.map((p) => `<option value="${p.id}" ${t.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${esc(t.description || '')}</textarea></div>`
  }, async () => {
    const toolId = document.getElementById('f-tool').value
    const tool = TOOLS.find((x) => x.id === toolId)
    let url = document.getElementById('f-url').value.trim()
    if (!url && tool?.url) url = tool.url
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      tool: toolId,
      type: document.getElementById('f-type').value,
      url,
      project_id: document.getElementById('f-project').value || null,
      description: document.getElementById('f-desc').value.trim(),
    }
    if (!payload.name) { toast('Nom requis', 'error'); return false }
    if (!payload.url) { toast('URL requise', 'error'); return false }
    if (t.id) {
      await supabase.from('templates').update(payload).eq('id', t.id)
      toast('Template mis à jour', 'success')
    } else {
      await supabase.from('templates').insert(payload)
      toast('Template ajouté', 'success')
    }
    renderTemplates(content)
  })
}
