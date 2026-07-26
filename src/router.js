import { Icon } from './icons.js'

// Simple hash router with a store.
const listeners = new Set()
let current = { path: 'dashboard', params: {} }

export function navigate(path, params = {}) {
  current = { path, params }
  history.replaceState(null, '', `#${path}`)
  listeners.forEach((l) => l(current))
}

export function getRoute() {
  return current
}

export function onRoute(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function initRouter() {
  const hash = location.hash.replace('#', '') || 'dashboard'
  const [path, ...rest] = hash.split('/')
  current = { path: path || 'dashboard', params: { rest } }
}

// Toast helper
const toastWrap = document.createElement('div')
toastWrap.className = 'toast-wrap'
document.body.appendChild(toastWrap)

export function toast(msg, type = 'info') {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  toastWrap.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateX(20px)'
    setTimeout(() => el.remove(), 200)
  }, 2800)
}

// Modal helper — returns a container element to render into; exposes close.
export function openModal(title, opts = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    const modal = document.createElement('div')
    modal.className = 'modal' + (opts.large ? ' lg' : '')
    modal.innerHTML = `
      <div class="modal-head">
        <div class="modal-title">${title}</div>
        <button class="icon-btn close-btn">${Icon.close(18)}</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot">
        <button class="btn cancel-btn">Annuler</button>
        <button class="btn btn-primary save-btn">Enregistrer</button>
      </div>`
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const body = modal.querySelector('.modal-body')
    const foot = modal.querySelector('.modal-foot')
    if (opts.noFooter) foot.remove()

    const close = (val) => {
      overlay.remove()
      resolve(val)
    }
    modal.querySelector('.close-btn').onclick = () => close(null)
    modal.querySelector('.cancel-btn').onclick = () => close(null)
    overlay.onclick = (e) => { if (e.target === overlay) close(null) }
    modal.querySelector('.save-btn').onclick = () => close('save')

    close._body = body
    resolve._body = body
    // expose body via returned object
    return { body, close, modal }
  })
}

// Simpler modal that gives direct access to body
export function modal(title, bodyBuilder, onSave, opts = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    const modal = document.createElement('div')
    modal.className = 'modal' + (opts.large ? ' lg' : '')
    modal.innerHTML = `
      <div class="modal-head">
        <div class="modal-title">${title}</div>
        <button class="icon-btn close-btn">${Icon.close(18)}</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot">
        <button class="btn cancel-btn">Annuler</button>
        <button class="btn btn-primary save-btn">Enregistrer</button>
      </div>`
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const body = modal.querySelector('.modal-body')
    bodyBuilder(body)

    const close = (result) => {
      overlay.remove()
      resolve(result)
    }
    modal.querySelector('.close-btn').onclick = () => close(null)
    modal.querySelector('.cancel-btn').onclick = () => close(null)
    overlay.onclick = (e) => { if (e.target === overlay) close(null) }
    modal.querySelector('.save-btn').onclick = async () => {
      const ok = onSave ? await onSave(body) : true
      if (ok !== false) close('saved')
    }
  })
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    const m = document.createElement('div')
    m.className = 'modal'
    m.style.maxWidth = '400px'
    m.innerHTML = `
      <div class="modal-head"><div class="modal-title">Confirmer</div></div>
      <div class="modal-body"><p style="font-size:14px;color:var(--text-2)">${message}</p></div>
      <div class="modal-foot">
        <button class="btn cancel-btn">Annuler</button>
        <button class="btn btn-primary danger-btn">Supprimer</button>
      </div>`
    overlay.appendChild(m)
    document.body.appendChild(overlay)
    const close = (v) => { overlay.remove(); resolve(v) }
    m.querySelector('.cancel-btn').onclick = () => close(false)
    m.querySelector('.danger-btn').onclick = () => close(true)
    overlay.onclick = (e) => { if (e.target === overlay) close(false) }
  })
}
