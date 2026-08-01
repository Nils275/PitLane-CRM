import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { modal, confirmDialog, toast } from '../router.js'
import { escape } from './dashboard.js'

const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
const euro0 = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export async function renderFinance(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const [{ data: tx }, { data: forecasts }] = await Promise.all([
    supabase.from('transactions').select('*').order('date', { ascending: false }),
    supabase.from('financial_forecasts').select('*').order('month', { ascending: true }),
  ])

  const income = (tx || []).filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
  const expense = (tx || []).filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  const profit = income - expense

  // forecast totals (current month)
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const fcIncome = (forecasts || []).filter((f) => f.type === 'income' && (isThisMonth(f.month, now) || f.recurring)).reduce((s, f) => s + Number(f.amount), 0)
  const fcExpense = (forecasts || []).filter((f) => f.type === 'expense' && (isThisMonth(f.month, now) || f.recurring)).reduce((s, f) => s + Number(f.amount), 0)
  const fcProfit = fcIncome - fcExpense

  // last 6 months actuals
  const months = []
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: dt.toLocaleDateString('fr-FR', { month: 'short' }), key: `${dt.getFullYear()}-${dt.getMonth()}`, inc: 0, exp: 0, fcInc: 0, fcExp: 0 })
  }
  ;(tx || []).forEach((r) => {
    if (!r.date) return
    const dt = new Date(r.date)
    const m = months.find((mm) => mm.key === `${dt.getFullYear()}-${dt.getMonth()}`)
    if (m) { r.type === 'income' ? m.inc += Number(r.amount) : m.exp += Number(r.amount) }
  })
  // forecast per month
  ;(forecasts || []).forEach((f) => {
    const dt = new Date(f.month)
    const m = months.find((mm) => mm.key === `${dt.getFullYear()}-${dt.getMonth()}`)
    if (m) { f.type === 'income' ? m.fcInc += Number(f.amount) : m.fcExp += Number(f.amount) }
    if (f.recurring) {
      // add recurring to all months from its start
      months.forEach((mm) => {
        const mDate = new Date(now.getFullYear(), now.getMonth() - 5 + months.indexOf(mm), 1)
        if (mDate >= new Date(dt.getFullYear(), dt.getMonth(), 1) && mm.key !== `${dt.getFullYear()}-${dt.getMonth()}`) {
          f.type === 'income' ? mm.fcInc += Number(f.amount) : mm.fcExp += Number(f.amount)
        }
      })
    }
  })

  const maxBar = Math.max(...months.map((m) => Math.max(m.inc, m.exp, m.fcInc, m.fcExp)), 1)

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Finance</div><div class="page-sub">Revenus, dépenses, trésorerie et prévisionnel</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="add-fc">${Icon.trend(16)} Prévision</button>
        <button class="btn btn-primary" id="add-tx">${Icon.plus(16)} Transaction</button>
      </div>
    </div>

    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Revenus réels</div><div class="kpi-ico tint-primary">${Icon.trend(18)}</div></div><div class="kpi-value" style="color:#2563eb">${euro(income)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Dépenses réelles</div><div class="kpi-ico tint-danger">${Icon.dollar(18)}</div></div><div class="kpi-value" style="color:#dc2626">${euro(expense)}</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="kpi-label">Résultat réel</div><div class="kpi-ico tint-primary">${Icon.briefcase(18)}</div></div><div class="kpi-value" style="color:${profit >= 0 ? '#2563eb' : '#dc2626'}">${euro(profit)}</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-head"><div class="card-title">Revenus vs Dépenses (6 mois)</div></div>
        <div class="card-pad">
          <div class="chart-bars">
            ${months.map((m) => `
              <div style="display:flex;flex-direction:column;align-items:center;flex:1;height:100%;justify-content:flex-end;gap:2px">
                <div style="display:flex;gap:3px;align-items:flex-end;height:100%;width:100%;justify-content:center">
                  <div class="chart-bar" style="height:${(m.inc / maxBar) * 100}%;background:#2563eb" title="Revenus: ${euro0(m.inc)}"></div>
                  <div class="chart-bar" style="height:${(m.exp / maxBar) * 100}%;background:#dc2626" title="Dépenses: ${euro0(m.exp)}"></div>
                </div>
                <div class="chart-bar-label">${m.label}</div>
              </div>`).join('')}
          </div>
          <div style="display:flex;gap:18px;margin-top:30px;justify-content:center">
            <div class="legend-item"><span class="legend-dot" style="background:#2563eb"></span>Revenus</div>
            <div class="legend-item"><span class="legend-dot" style="background:#dc2626"></span>Dépenses</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Prévisionnel vs Réel (ce mois)</div></div>
        <div class="card-pad">
          <div class="forecast-compare">
            <div class="forecast-row">
              <div class="forecast-label">Revenus prévus</div>
              <div class="forecast-bar"><div style="width:${(fcIncome / Math.max(fcIncome, income, 1)) * 100}%;background:#60a5fa"></div></div>
              <div class="forecast-val" style="color:#2563eb">${euro0(fcIncome)}</div>
            </div>
            <div class="forecast-row">
              <div class="forecast-label">Revenus réels</div>
              <div class="forecast-bar"><div style="width:${(income / Math.max(fcIncome, income, 1)) * 100}%;background:#2563eb"></div></div>
              <div class="forecast-val" style="color:#2563eb">${euro0(income)}</div>
            </div>
            <div class="forecast-row">
              <div class="forecast-label">Dépenses prévues</div>
              <div class="forecast-bar"><div style="width:${(fcExpense / Math.max(fcExpense, expense, 1)) * 100}%;background:#f87171"></div></div>
              <div class="forecast-val" style="color:#dc2626">${euro0(fcExpense)}</div>
            </div>
            <div class="forecast-row">
              <div class="forecast-label">Dépenses réelles</div>
              <div class="forecast-bar"><div style="width:${(expense / Math.max(fcExpense, expense, 1)) * 100}%;background:#dc2626"></div></div>
              <div class="forecast-val" style="color:#dc2626">${euro0(expense)}</div>
            </div>
            <div class="forecast-divider"></div>
            <div class="forecast-row">
              <div class="forecast-label">Résultat prévu</div>
              <div class="forecast-bar"><div style="width:${Math.abs(fcProfit) / Math.max(Math.abs(fcProfit), Math.abs(profit), 1) * 100}%;background:${fcProfit >= 0 ? '#60a5fa' : '#f87171'}"></div></div>
              <div class="forecast-val" style="color:${fcProfit >= 0 ? '#2563eb' : '#dc2626'}">${euro0(fcProfit)}</div>
            </div>
            <div class="forecast-row">
              <div class="forecast-label">Résultat réel</div>
              <div class="forecast-bar"><div style="width:${Math.abs(profit) / Math.max(Math.abs(fcProfit), Math.abs(profit), 1) * 100}%;background:${profit >= 0 ? '#2563eb' : '#dc2626'}"></div></div>
              <div class="forecast-val" style="color:${profit >= 0 ? '#2563eb' : '#dc2626'}">${euro0(profit)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div class="card-title">Prévisions financières</div><span class="badge badge-neutral">${(forecasts || []).length}</span></div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Mois</th><th>Libellé</th><th>Catégorie</th><th>Type</th><th>Récurrent</th><th style="text-align:right">Montant</th><th></th></tr></thead>
          <tbody>
            ${(forecasts || []).map((f) => `
              <tr>
                <td>${new Date(f.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td>
                <td style="font-weight:500">${escape(f.label)}</td>
                <td><span class="tag">${escape(f.category || '—')}</span></td>
                <td><span class="badge ${f.type === 'income' ? 'badge-success' : 'badge-danger'}">${f.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
                <td>${f.recurring ? '<span class="badge badge-primary">Oui</span>' : '—'}</td>
                <td style="text-align:right;font-weight:600;color:${f.type === 'income' ? 'var(--success)' : 'var(--danger)'}">${f.type === 'income' ? '+' : '-'}${euro(f.amount)}</td>
                <td style="text-align:right">
                  <button class="btn btn-ghost btn-sm btn-icon" data-fc-edit="${f.id}">${Icon.edit(13)}</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-fc-del="${f.id}">${Icon.trash(13)}</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="7"><div class="empty">Aucune prévision. Cliquez sur "Prévision" pour en ajouter une.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Transactions réelles</div></div>
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
                  <button class="btn btn-ghost btn-sm btn-icon" data-tx-edit="${r.id}">${Icon.edit(13)}</button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-del="${r.id}">${Icon.trash(14)}</button>
                </td>
              </tr>`).join('') || '<tr><td colspan="6"><div class="empty">Aucune transaction</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`

  document.getElementById('add-tx').onclick = () => openTxForm(content)
  document.getElementById('add-fc').onclick = () => openFcForm(content)
  content.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette transaction ?')) {
      await supabase.from('transactions').delete().eq('id', b.dataset.del)
      toast('Transaction supprimée', 'success')
      renderFinance(content)
    }
  })
  content.querySelectorAll('[data-tx-edit]').forEach((b) => b.onclick = () => openTxForm(content, tx.find((r) => r.id === b.dataset.txEdit)))
  content.querySelectorAll('[data-fc-edit]').forEach((b) => b.onclick = () => openFcForm(content, forecasts.find((f) => f.id === b.dataset.fcEdit)))
  content.querySelectorAll('[data-fc-del]').forEach((b) => b.onclick = async () => {
    if (await confirmDialog('Supprimer cette prévision ?')) {
      await supabase.from('financial_forecasts').delete().eq('id', b.dataset.fcDel)
      toast('Prévision supprimée', 'success')
      renderFinance(content)
    }
  })
}

function isThisMonth(d, now) {
  const dt = new Date(d)
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()
}

async function openTxForm(content, t = {}) {
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

async function openFcForm(content, f = {}) {
  await modal(f.id ? 'Modifier la prévision' : 'Nouvelle prévision', (body) => {
    body.innerHTML = `
      <div class="field"><label>Libellé</label><input id="f-label" value="${escape(f.label || '')}" placeholder="ex: Salaires, Sponsor, Matériel"></div>
      <div class="form-row">
        <div class="field"><label>Type</label><select id="f-type">
          <option value="expense" ${f.type === 'expense' ? 'selected' : ''}>Dépense</option>
          <option value="income" ${f.type === 'income' ? 'selected' : ''}>Revenu</option>
        </select></div>
        <div class="field"><label>Montant (€)</label><input type="number" id="f-amount" value="${f.amount || 0}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Catégorie</label><input id="f-cat" value="${escape(f.category || '')}" placeholder="ex: Salaires, Sponsor, Logistique"></div>
        <div class="field"><label>Mois concerné</label><input type="month" id="f-month" value="${f.month ? new Date(f.month).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7)}"></div>
      </div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="f-recurring" ${f.recurring ? 'checked' : ''} style="width:auto"> Récurrent chaque mois</label></div>`
  }, async () => {
    const monthVal = document.getElementById('f-month').value
    const payload = {
      label: document.getElementById('f-label').value.trim(),
      type: document.getElementById('f-type').value,
      amount: Number(document.getElementById('f-amount').value) || 0,
      category: document.getElementById('f-cat').value.trim(),
      month: monthVal ? new Date(monthVal + '-01').toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      recurring: document.getElementById('f-recurring').checked,
    }
    if (!payload.label) { toast('Libellé requis', 'error'); return false }
    if (f.id) {
      await supabase.from('financial_forecasts').update(payload).eq('id', f.id)
    } else {
      await supabase.from('financial_forecasts').insert(payload)
    }
    toast('Prévision enregistrée', 'success')
    renderFinance(content)
  })
}
