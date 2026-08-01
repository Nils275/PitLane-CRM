import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { toast } from '../router.js'
import { getCurrentUser } from './login.js'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

function isThisMonth(d, now) {
  const dt = new Date(d)
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()
}

export async function renderDashboard(content) {
  content.innerHTML = `<div class="spinner"></div>`

  const [tasks, projects, deals, tx, team, forecasts] = await Promise.all([
    supabase.from('tasks').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('crm_deals').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('team_members').select('*'),
    supabase.from('financial_forecasts').select('*'),
  ])

  const t = tasks.data || []
  const p = projects.data || []
  const d = deals.data || []
  const x = tx.data || []
  const fc = forecasts.data || []
  const user = getCurrentUser()

  const myTasks = user ? t.filter((k) => (k.assignee || '').toLowerCase().startsWith(user.name.toLowerCase())) : []
  const myDone = myTasks.filter((k) => k.status === 'done').length
  const myActive = myTasks.filter((k) => k.status !== 'done').length

  const done = t.filter((k) => k.status === 'done').length
  const todo = t.filter((k) => k.status === 'todo').length
  const inprog = t.filter((k) => k.status === 'doing').length
  const late = t.filter((k) => k.due_date && new Date(k.due_date) < new Date() && k.status !== 'done').length

  const income = x.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
  const expense = x.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  const profit = income - expense
  const signed = d.filter((k) => k.stage === 'signed').reduce((s, k) => s + Number(k.value), 0)
  const pipelineVal = d.filter((k) => k.stage !== 'signed' && k.stage !== 'lost').reduce((s, k) => s + Number(k.value), 0)

  // forecast for current month
  const fcNow = new Date()
  const fcIncome = fc.filter((f) => f.type === 'income' && (isThisMonth(f.month, fcNow) || f.recurring)).reduce((s, f) => s + Number(f.amount), 0)
  const fcExpense = fc.filter((f) => f.type === 'expense' && (isThisMonth(f.month, fcNow) || f.recurring)).reduce((s, f) => s + Number(f.amount), 0)
  const fcProfit = fcIncome - fcExpense

  // monthly bars (last 6 months)
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    months.push({ label: dt.toLocaleDateString('fr-FR', { month: 'short' }), key, income: 0, expense: 0 })
  }
  x.forEach((r) => {
    if (!r.date) return
    const dt = new Date(r.date)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    const m = months.find((mm) => mm.key === key)
    if (m) { if (r.type === 'income') m.income += Number(r.amount); else m.expense += Number(r.amount) }
  })
  const maxBar = Math.max(...months.map((m) => Math.max(m.income, m.expense)), 1)

  // donut: tasks by status
  const donutData = [
    { label: 'Terminées', val: done, color: '#2563eb' },
    { label: 'En cours', val: inprog, color: '#dc2626' },
    { label: 'À faire', val: todo, color: '#404040' },
  ]
  const totalDonut = donutData.reduce((s, d) => s + d.val, 0) || 1

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Tableau de bord</div>
        <div class="page-sub">Vue d'ensemble · Bienvenue ${escape(user ? user.name : '')}</div>
      </div>
      <div class="badge badge-neutral">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      ${kpiCard('Chiffre d\'affaires', fmt(income), fcIncome ? `Prévu: ${fmt(fcIncome)}` : '+12%', fcIncome ? (income >= fcIncome ? 'up' : 'down') : 'up', Icon.dollar(18), 'tint-success')}
      ${kpiCard('Bénéfice', fmt(profit), fcProfit ? `Prévu: ${fmt(fcProfit)}` : (profit >= 0 ? '+' + Math.round(profit / (income || 1) * 100) + '%' : '—'), fcProfit ? (profit >= fcProfit ? 'up' : 'down') : (profit >= 0 ? 'up' : 'down'), Icon.trend(18), 'tint-primary')}
      ${kpiCard('Tâches actives', inprog + todo, `${done} terminées`, 'up', Icon.tasks(18), 'tint-warning')}
      ${kpiCard('Pipeline', fmt(pipelineVal), `${d.length} opportunités`, 'up', Icon.crm(18), 'tint-accent')}
    </div>

    ${fc.length ? `
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><div class="card-title">Prévisionnel vs Réel — ${fcNow.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div><span class="badge badge-primary">${fc.length} prévisions</span></div>
      <div class="card-pad">
        <div class="forecast-compare">
          <div class="forecast-row">
            <div class="forecast-label">Revenus prévus</div>
            <div class="forecast-bar"><div style="width:${(fcIncome / Math.max(fcIncome, income, 1)) * 100}%;background:#60a5fa"></div></div>
            <div class="forecast-val" style="color:#2563eb">${fmt(fcIncome)}</div>
          </div>
          <div class="forecast-row">
            <div class="forecast-label">Revenus réels</div>
            <div class="forecast-bar"><div style="width:${(income / Math.max(fcIncome, income, 1)) * 100}%;background:#2563eb"></div></div>
            <div class="forecast-val" style="color:#2563eb">${fmt(income)}</div>
          </div>
          <div class="forecast-row">
            <div class="forecast-label">Dépenses prévues</div>
            <div class="forecast-bar"><div style="width:${(fcExpense / Math.max(fcExpense, expense, 1)) * 100}%;background:#f87171"></div></div>
            <div class="forecast-val" style="color:#dc2626">${fmt(fcExpense)}</div>
          </div>
          <div class="forecast-row">
            <div class="forecast-label">Dépenses réelles</div>
            <div class="forecast-bar"><div style="width:${(expense / Math.max(fcExpense, expense, 1)) * 100}%;background:#dc2626"></div></div>
            <div class="forecast-val" style="color:#dc2626">${fmt(expense)}</div>
          </div>
          <div class="forecast-divider"></div>
          <div class="forecast-row">
            <div class="forecast-label">Résultat prévu</div>
            <div class="forecast-bar"><div style="width:${Math.abs(fcProfit) / Math.max(Math.abs(fcProfit), Math.abs(profit), 1) * 100}%;background:${fcProfit >= 0 ? '#60a5fa' : '#f87171'}"></div></div>
            <div class="forecast-val" style="color:${fcProfit >= 0 ? '#2563eb' : '#dc2626'}">${fmt(fcProfit)}</div>
          </div>
          <div class="forecast-row">
            <div class="forecast-label">Résultat réel</div>
            <div class="forecast-bar"><div style="width:${Math.abs(profit) / Math.max(Math.abs(fcProfit), Math.abs(profit), 1) * 100}%;background:${profit >= 0 ? '#2563eb' : '#dc2626'}"></div></div>
            <div class="forecast-val" style="color:${profit >= 0 ? '#2563eb' : '#dc2626'}">${fmt(profit)}</div>
          </div>
        </div>
      </div>
    </div>` : ''}

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-head"><div class="card-title">Revenus vs Dépenses (6 mois)</div></div>
        <div class="card-pad">
          <div class="chart-bars">
            ${months.map((m) => `
              <div style="display:flex;flex-direction:column;align-items:center;flex:1;height:100%;justify-content:flex-end;gap:2px">
                <div style="display:flex;gap:3px;align-items:flex-end;height:100%;width:100%;justify-content:center">
                  <div class="chart-bar" style="height:${(m.income / maxBar) * 100}%;background:#2563eb" title="Revenus: ${fmt(m.income)}"></div>
                  <div class="chart-bar" style="height:${(m.expense / maxBar) * 100}%;background:#dc2626" title="Dépenses: ${fmt(m.expense)}"></div>
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
        <div class="card-head"><div class="card-title">Répartition des tâches</div></div>
        <div class="card-pad donut-wrap">
          ${donutSVG(donutData, totalDonut)}
          <div class="donut-legend">
            ${donutData.map((d) => `<div class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${d.label} — <strong>${d.val}</strong></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="card">
        <div class="card-head"><div class="card-title">Mes tâches</div><span class="badge badge-primary">${myActive} active${myActive > 1 ? 's' : ''}</span></div>
        <div style="padding:8px">
          ${myTasks.filter((k) => k.status !== 'done').slice(0, 6).map((k) => `
            <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <span class="priority-dot priority-${k.priority || 'medium'}"></span>
              <div style="flex:1;font-size:13px;font-weight:500">${escape(k.title)}</div>
              ${k.due_date ? `<div style="font-size:11px;color:var(--text-3)">${new Date(k.due_date).toLocaleDateString('fr-FR')}</div>` : ''}
            </div>`).join('') || '<div class="empty">Aucune tâche assignée</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Projets en cours</div><span class="badge badge-primary">${p.length}</span></div>
        <div style="padding:8px">
          ${p.slice(0, 5).map((pr) => `
            <div style="padding:10px;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="font-weight:600;font-size:13px">${escape(pr.name)}</div>
                <span class="badge badge-neutral">${pr.status}</span>
              </div>
              <div class="progress"><div class="progress-fill" style="width:${pr.progress || 0}%;background:${pr.color || 'var(--primary)'}"></div></div>
            </div>`).join('') || '<div class="empty">Aucun projet</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Tâches en retard</div><span class="badge ${late > 0 ? 'badge-danger' : 'badge-success'}">${late}</span></div>
        <div style="padding:8px">
          ${t.filter((k) => k.due_date && new Date(k.due_date) < new Date() && k.status !== 'done').slice(0, 5).map((k) => `
            <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <span class="priority-dot priority-${k.priority || 'medium'}"></span>
              <div style="flex:1;font-size:13px;font-weight:500">${escape(k.title)}</div>
              <div style="font-size:11px;color:var(--danger)">${new Date(k.due_date).toLocaleDateString('fr-FR')}</div>
            </div>`).join('') || '<div class="empty">Aucune tâche en retard</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Équipe</div><span class="badge badge-neutral">${(team.data || []).length}</span></div>
        <div style="padding:8px">
          ${(team.data || []).slice(0, 5).map((m) => `
            <div style="padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
              <div class="avatar sm" style="background:${avatarColor(m.first_name + m.last_name)}">${initials(m.first_name, m.last_name)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600">${escape(m.first_name)} ${escape(m.last_name)}</div>
                <div style="font-size:11px;color:var(--text-3)">${escape(m.role || '—')}</div>
              </div>
              <span class="badge ${m.status === 'active' ? 'badge-success' : 'badge-neutral'}">${m.status}</span>
            </div>`).join('') || '<div class="empty">Aucun membre</div>'}
        </div>
      </div>
    </div>`
}

function kpiCard(label, value, delta, dir, icon, tint) {
  return `
    <div class="card kpi">
      <div class="kpi-top">
        <div class="kpi-label">${label}</div>
        <div class="kpi-ico ${tint}">${icon}</div>
      </div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-delta ${dir}">${dir === 'up' ? '↑' : '↓'} ${delta}</div>
    </div>`
}

function donutSVG(data, total) {
  const r = 60, c = 2 * Math.PI * r
  let offset = 0
  const segments = data.map((d) => {
    const frac = d.val / total
    const seg = `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${d.color}" stroke-width="22" stroke-dasharray="${frac * c} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"/>`
    offset += frac * c
    return seg
  }).join('')
  return `<svg width="160" height="160" viewBox="0 0 160 160">${segments}<text x="80" y="84" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text)">${total}</text><text x="80" y="100" text-anchor="middle" font-size="10" fill="var(--text-3)">tâches</text></svg>`
}

export function escape(s) {
  if (s == null) return ''
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function initials(a, b) {
  return ((a || '')[0] || '') + ((b || '')[0] || '')
}

export function avatarColor(seed) {
  const colors = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488']
  let h = 0
  for (let i = 0; i < (seed || 'x').length; i++) h = (h * 31 + seed.charCodeAt(i)) % colors.length
  return colors[h]
}
