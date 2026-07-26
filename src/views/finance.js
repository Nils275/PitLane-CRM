import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)

export async function renderFinance(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data: tx } = await supabase.from('transactions').select('*').order('date', { ascending: false })

  const income = (tx || []).filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
  const expense = (tx || []).filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  const profit = income - expense

  // last 6 months
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: dt.toLocaleDateString('fr-FR', { month: 'short' }), key: `${dt.getFullYear()}-${dt.getMonth()}`, inc: 0, exp: 0 })
  }
  ;(tx || []).forEach((r) => {
    if (!r.date) return
    const dt = new Date(r.date)
    const m = months.find((mm) => mm.key === `${dt.getFullYear()}-${dt.getMonth()}`)
    if (m) { r.type === 'income' ? m.inc += Number(r.amount) : m.exp += Number(r.amount) }
  })

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Finance</div><div class="page-sub">Revenus, dépenses et trésorerie</div></div>
      <button class="btn btn-primary" id="add-tx">${Icon.plus(16)} Transaction</button>
    </div>

    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Revenus</div><div class="kpi-ico tint-primary">${Icon.trend(18)}</div></div><div class="kpi-value" style="color:#2563eb">${euro(income)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Dépenses</div><div class="kpi-ico tint-danger">${Icon.dollar(18)}</div></div><div class="kpi-value" style="color:#dc2626">${euro(expense)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Résultat</div><div class="kpi-ico tint-primary">${Icon.briefcase(18)}</div></div><div class="kpi-value" style="color:${profit >= 0 ? '#2563eb' : '#dc2626'}">${euro(profit)}</div></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div class="card-title">Flux mensuel</div></div>
      <div class="card-pad">
        <svg class="line-chart" viewBox="0 0 600 200" preserveAspectRatio="none">
          ${linePath(months.map((m) => m.inc), '#2563eb')}
          ${linePath(months.map((m) => m.exp), '#dc2626')}
        </svg>
        <div style="display:flex;gap:18px;justify-content:center;margin-top:8px">
          <div class="legend-item"><span class="legend-dot" style="background:#2563eb"></span>Revenus</div>
          <div class="legend-item"><span class="legend-dot" style="background:#dc2626"></span>Dépenses</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Transactions</div></div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Type</th><th style="text-align:right">Montant</th><th></th></tr></thead>
          <tbody>
            ${(tx || []).map((r) => `
              <tr>
                <td>${r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</td>
                <td style="font-weight:500">${escape(r.label)}</td>
                <td><span class="tag">${escape(r.category || '—')}</span></td>
                <td><span class="badge ${r.type === 'income' ? 'badge-success' : 'badge-danger'}">${r.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
                <td style="text-align:right;font-weight:600;color:${r.type === 'income' ? 'var(--success)' : 'var(--danger)'}">${r.type === 'income' ? '+' : '-'}${euro(r.amount)}</td>
                <td style="text-align:right">
                  <button class="btn btn-ghost btn-sm btn-icon" data-del="${r.id}">${Icon.trash(14)}</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="6"><div class="empty">Aucune transaction</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`

  document.getElementById('add-tx').onclick = () => openForm(content)
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette transaction ?')) {
      await supabase.from('transactions').delete().eq('id', b.dataset.del)
      toast('Transaction supprimée', 'success')
      renderFinance(content)
    }
  })
}

function linePath(values, color) {
  const max = Math.max(...values, 1)
  const w = 600, h = 200, pad = 10
  const step = (w - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => `${pad + i * step},${h - pad - (v / max) * (h - pad * 2)}`)
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`
}

async function openForm(content, t = {}) {
  await modal(t.id ? 'Modifier' : 'Nouvelle transaction', (body) => {
    body.innerHTML = `
      <div class="field"><label>Libellé</label><input id="f-label" value="${escape(t.label || '')}"></div>
      <div class="form-row">
        <div class="field"><label>Type</label><select id="f-type">
          <option value="expense" ${t.type === 'expense' ? 'selected' : ''}>Dépense</option>
          <option value="income" ${t.type === 'income' ? 'selected' : ''}>Revenu</option>
        </select></div>
        <div class="field"><label>Montant (€)</label><input type="number" id="f-amount" value="${t.amount || 0}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Catégorie</label><input id="f-cat" value="${escape(t.category || '')}" placeholder="ex: Salaires, Marketing"></div>
        <div class="field"><label>Date</label><input type="date" id="f-date" value="${t.date || new Date().toISOString().slice(0, 10)}"></div>
      </div>`
  }, async () => {
    const payload = {
      label: document.getElementById('f-label').value.trim(),
      type: document.getElementById('f-type').value,
      amount: Number(document.getElementById('f-amount').value) || 0,
      category: document.getElementById('f-cat').value.trim(),
      date: document.getElementById('f-date').value,
    }
    if (!payload.label) { toast('Libellé requis', 'error'); return false }
    if (t.id) {
      await supabase.from('transactions').update(payload).eq('id', t.id)
    } else {
      await supabase.from('transactions').insert(payload)
    }
    toast('Transaction enregistrée', 'success')
    renderFinance(content)
  })
}
