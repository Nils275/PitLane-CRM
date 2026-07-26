import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const STAGES = [
  { id: 'prospect', label: 'Prospect' },
  { id: 'contacted', label: 'Contacté' },
  { id: 'meeting', label: 'Rendez-vous' },
  { id: 'proposal', label: 'Proposition' },
  { id: 'negotiation', label: 'Négociation' },
  { id: 'signed', label: 'Signé' },
  { id: 'lost', label: 'Perdu' },
]

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export async function renderCRM(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data: deals } = await supabase.from('crm_deals').select('*').order('created_at', { ascending: false })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">CRM</div><div class="page-sub">Pipeline commercial</div></div>
      <button class="btn btn-primary" id="add-deal">${Icon.plus(16)} Nouvelle opportunité</button>
    </div>
    <div class="pipeline" id="pipeline">
      ${STAGES.map((s) => {
        const items = (deals || []).filter((d) => d.stage === s.id)
        const sum = items.reduce((a, d) => a + Number(d.value), 0)
        return `
          <div class="pipe-col">
            <div class="pipe-col-head"><span>${s.label}</span><span class="pipe-sum">${items.length} · ${euro(sum)}</span></div>
            ${items.map(dealCard).join('')}
          </div>`
      }).join('')}
    </div>`

  document.getElementById('add-deal').onclick = () => openForm(content)
  content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(content, deals.find((d) => d.id === b.dataset.edit)))
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette opportunité ?')) {
      await supabase.from('crm_deals').delete().eq('id', b.dataset.del)
      toast('Opportunité supprimée', 'success')
      renderCRM(content)
    }
  })
  // drag between columns
  let dragId = null
  content.querySelectorAll('.deal').forEach((card) => {
    card.draggable = true
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.id; e.dataTransfer.effectAllowed = 'move' })
    card.addEventListener('dragend', () => { dragId = null })
  })
  content.querySelectorAll('.pipe-col').forEach((col) => {
    col.addEventListener('dragover', (e) => e.preventDefault())
    col.addEventListener('drop', async (e) => {
      e.preventDefault()
      if (!dragId) return
      const stage = STAGES[col.querySelector('.pipe-col-head span').textContent === 'Prospect' ? 0 : STAGES.findIndex((s) => col.innerHTML.includes(`>${s.label}<`))]
      // simpler: find stage by index of col
      const cols = [...content.querySelectorAll('.pipe-col')]
      const newStage = STAGES[cols.indexOf(col)].id
      await supabase.from('crm_deals').update({ stage: newStage }).eq('id', dragId)
      toast('Opportunité déplacée', 'success')
      renderCRM(content)
    })
  })
}

function dealCard(d) {
  return `
    <div class="deal" data-id="${d.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="deal-co">${escape(d.company)}</div>
        <div style="display:flex;gap:2px">
          <button class="btn btn-ghost btn-sm btn-icon" data-edit="${d.id}">${Icon.edit(12)}</button>
          <button class="btn btn-ghost btn-sm btn-icon" data-del="${d.id}">${Icon.trash(12)}</button>
        </div>
      </div>
      <div class="deal-contact">${escape(d.contact || '—')}</div>
      <div class="deal-val">${euro(d.value)}</div>
      <div class="deal-foot">
        <span class="tag">${escape(d.owner || '—')}</span>
      </div>
    </div>`
}

async function openForm(content, d = {}) {
  await modal(d.id ? 'Modifier l\'opportunité' : 'Nouvelle opportunité', (body) => {
    body.innerHTML = `
      <div class="field"><label>Entreprise</label><input id="f-co" value="${escape(d.company || '')}"></div>
      <div class="form-row">
        <div class="field"><label>Contact</label><input id="f-contact" value="${escape(d.contact || '')}"></div>
        <div class="field"><label>Email</label><input id="f-email" value="${escape(d.email || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Montant (€)</label><input type="number" id="f-value" value="${d.value || 0}"></div>
        <div class="field"><label>Étape</label><select id="f-stage">${STAGES.map((s) => `<option value="${s.id}" ${d.stage === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Responsable</label><input id="f-owner" value="${escape(d.owner || '')}"></div>
      <div class="field"><label>Notes</label><textarea id="f-notes">${escape(d.notes || '')}</textarea></div>`
  }, async () => {
    const payload = {
      company: document.getElementById('f-co').value.trim(),
      contact: document.getElementById('f-contact').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      value: Number(document.getElementById('f-value').value) || 0,
      stage: document.getElementById('f-stage').value,
      owner: document.getElementById('f-owner').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
    }
    if (!payload.company) { toast('Entreprise requise', 'error'); return false }
    if (d.id) {
      await supabase.from('crm_deals').update(payload).eq('id', d.id)
      toast('Opportunité mise à jour', 'success')
    } else {
      await supabase.from('crm_deals').insert(payload)
      toast('Opportunité créée', 'success')
    }
    renderCRM(content)
  })
}
