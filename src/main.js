import './style.css'
import { Icon } from './icons.js'
import { navigate, onRoute, getRoute, initRouter, toast } from './router.js'
import { supabase } from './supabase.js'
import { renderDashboard, escape } from './views/dashboard.js'
import { renderTasks } from './views/tasks.js'
import { renderProjects } from './views/projects.js'
import { renderTeam } from './views/team.js'
import { renderCRM } from './views/crm.js'
import { renderChat } from './views/chat.js'
import { renderFinance } from './views/finance.js'
import { renderSettings } from './views/settings.js'
import { renderAgenda } from './views/agenda.js'
import { renderDocuments } from './views/documents.js'
import { renderPress } from './views/press.js'
import { renderCommunication } from './views/communication.js'
import { renderTemplates } from './views/templates.js'
import { renderLogin, getCurrentUser, logout } from './views/login.js'
import { initJarvis } from './views/jarvis.js'

const NAV = [
  { section: 'Pilotage', items: [
    { id: 'dashboard', label: 'Tableau de bord', icon: Icon.dashboard(18) },
    { id: 'tasks', label: 'Tâches', icon: Icon.tasks(18) },
    { id: 'projects', label: 'Projets', icon: Icon.projects(18) },
    { id: 'agenda', label: 'Agenda', icon: Icon.calendar(18) },
  ]},
  { section: 'Business', items: [
    { id: 'crm', label: 'CRM', icon: Icon.crm(18) },
    { id: 'finance', label: 'Finance', icon: Icon.finance(18) },
  ]},
  { section: 'Collaboration', items: [
    { id: 'team', label: 'Équipe', icon: Icon.team(18) },
    { id: 'chat', label: 'Discussions', icon: Icon.chat(18) },
    { id: 'communication', label: 'Communication', icon: Icon.chat(18) },
    { id: 'documents', label: 'Documents', icon: Icon.briefcase(18) },
  ]},
  { section: 'Création', items: [
    { id: 'templates', label: 'Templates', icon: Icon.briefcase(18) },
  ]},
  { section: 'Veille', items: [
    { id: 'press', label: 'Presse Sport Auto', icon: Icon.trend(18) },
  ]},
  { section: 'Système', items: [
    { id: 'settings', label: 'Paramètres', icon: Icon.settings(18) },
  ]},
]

const VIEWS = {
  dashboard: renderDashboard,
  tasks: renderTasks,
  projects: renderProjects,
  agenda: renderAgenda,
  crm: renderCRM,
  finance: renderFinance,
  team: renderTeam,
  chat: renderChat,
  communication: renderCommunication,
  documents: renderDocuments,
  templates: renderTemplates,
  press: renderPress,
  settings: renderSettings,
}

function shellHTML(user) {
  const initials = user.name.slice(0, 2).toUpperCase()
  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-logo" id="brand-logo">M</div>
        <div class="brand-name" id="brand-name">Mon Entreprise</div>
      </div>
      <nav class="nav" id="nav">
        ${NAV.map((g) => `
          <div class="nav-section">${g.section}</div>
          ${g.items.map((i) => `
            <button class="nav-item" data-route="${i.id}">
              <span class="nav-ico">${i.icon}</span>
              <span>${i.label}</span>
            </button>`).join('')}
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="avatar" style="background:${user.avatar_color || 'var(--primary)'}">${initials}</div>
          <div class="user-meta">
            <div class="user-name">${escape(user.name)}</div>
            <div class="user-role">${user.role === 'admin' ? 'Administrateur' : 'Membre'}</div>
          </div>
          <button class="icon-btn" id="logout-btn" title="Déconnexion">${Icon.close(16)}</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn">${Icon.menu(20)}</button>
        <div class="search">
          <span class="search-ico">${Icon.search(16)}</span>
          <input id="global-search" placeholder="Rechercher partout..." autocomplete="off">
          <div class="search-results" id="search-results" style="display:none"></div>
        </div>
        <div class="topbar-spacer"></div>
        <button class="icon-btn" id="theme-toggle">${Icon.moon(18)}</button>
        <button class="icon-btn" id="bell-btn">${Icon.bell(18)}<span class="dot"></span></button>
      </header>
      <main class="content" id="content"></main>
    </div>`
}

export function updateBrand(settings) {
  const nameEl = document.getElementById('brand-name')
  const logoEl = document.getElementById('brand-logo')
  if (!nameEl) return
  if (settings.name) nameEl.textContent = settings.name
  if (logoEl) {
    if (settings.logo_url) {
      logoEl.innerHTML = `<img src="${settings.logo_url}" style="width:100%;height:100%;border-radius:9px;object-fit:cover">`
    } else {
      logoEl.textContent = (settings.name || 'M')[0].toUpperCase()
    }
  }
  if (settings.primary_color) {
    document.documentElement.style.setProperty('--primary', settings.primary_color)
  }
}

async function boot() {
  initRouter()

  // Check login
  const user = getCurrentUser()
  if (!user) {
    renderLogin(document.getElementById('app'), () => location.reload())
    return
  }

  // theme
  const savedTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)
  document.querySelector('#app').innerHTML = shellHTML(user)
  updateThemeIcon()

  // brand from settings
  const { data: settings } = await supabase.from('company_settings').select('*').maybeSingle()
  if (settings) updateBrand(settings)

  // nav
  document.querySelectorAll('[data-route]').forEach((b) => b.onclick = () => { navigate(b.dataset.route); closeSidebar() })

  // logout
  document.getElementById('logout-btn').onclick = () => { if (confirm('Se déconnecter ?')) logout() }

  // mobile menu
  document.getElementById('menu-btn').onclick = () => document.getElementById('sidebar').classList.toggle('collapsed')

  // theme toggle
  document.getElementById('theme-toggle').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme')
    const next = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    updateThemeIcon()
  }

  // bell
  document.getElementById('bell-btn').onclick = () => toast('Aucune nouvelle notification', 'info')

  // global search
  setupSearch()

  // router
  onRoute(render)
  render(getRoute())

  // Jarvis chatbot
  initJarvis()
}

function closeSidebar() {
  if (window.innerWidth <= 860) document.getElementById('sidebar').classList.add('collapsed')
}

function updateThemeIcon() {
  const t = document.documentElement.getAttribute('data-theme')
  document.getElementById('theme-toggle').innerHTML = t === 'dark' ? Icon.sun(18) : Icon.moon(18)
}

async function render(route) {
  document.querySelectorAll('[data-route]').forEach((b) => b.classList.toggle('active', b.dataset.route === route.path))
  const content = document.getElementById('content')
  content.innerHTML = ''
  const view = VIEWS[route.path] || renderDashboard
  try {
    await view(content)
  } catch (e) {
    content.innerHTML = `<div class="empty">Erreur: ${escape(e.message)}</div>`
  }
}

function setupSearch() {
  const input = document.getElementById('global-search')
  const results = document.getElementById('search-results')
  let timer
  input.addEventListener('input', () => {
    clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < 2) { results.style.display = 'none'; return }
    timer = setTimeout(() => doSearch(q, results), 200)
  })
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) results.style.display = 'none' })
}

async function doSearch(q, resultsEl) {
  const [tasks, projects, team, deals] = await Promise.all([
    supabase.from('tasks').select('id,title').ilike('title', `%${q}%`),
    supabase.from('projects').select('id,name').ilike('name', `%${q}%`),
    supabase.from('team_members').select('id,first_name,last_name').or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`),
    supabase.from('crm_deals').select('id,company').ilike('company', `%${q}%`),
  ])
  const groups = [
    { title: 'Tâches', items: (tasks.data || []).map((t) => ({ id: t.id, label: t.title, route: 'tasks' })) },
    { title: 'Projets', items: (projects.data || []).map((p) => ({ id: p.id, label: p.name, route: 'projects' })) },
    { title: 'Équipe', items: (team.data || []).map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name}`, route: 'team' })) },
    { title: 'CRM', items: (deals.data || []).map((d) => ({ id: d.id, label: d.company, route: 'crm' })) },
  ].filter((g) => g.items.length)

  if (!groups.length) { resultsEl.innerHTML = '<div class="empty">Aucun résultat</div>'; resultsEl.style.display = 'block'; return }
  resultsEl.innerHTML = groups.map((g) => `
    <div class="sr-group">
      <div class="sr-group-title">${g.title}</div>
      ${g.items.slice(0, 5).map((i) => `<div class="sr-item" data-route="${g.route}" data-id="${i.id}">${Icon.search(13)} ${escape(i.label)}</div>`).join('')}
    </div>`).join('')
  resultsEl.style.display = 'block'
  resultsEl.querySelectorAll('.sr-item').forEach((it) => it.onclick = () => {
    navigate(it.dataset.route)
    resultsEl.style.display = 'none'
    input.value = ''
  })
}

boot()
