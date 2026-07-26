import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { toast } from '../router.js'

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('app_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function logout() {
  sessionStorage.removeItem('app_user')
  location.reload()
}

export async function renderLogin(appEl, onLogin) {
  appEl.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">${Icon.dashboard(32)}</div>
        <div class="login-title">Espace équipe</div>
        <div class="login-sub">Connectez-vous pour accéder à votre plateforme</div>
        <div class="login-form">
          <div class="field">
            <label>Nom d'utilisateur</label>
            <input id="login-name" placeholder="Votre nom" autocomplete="off" autofocus>
          </div>
          <div class="field">
            <label>Mot de passe</label>
            <input id="login-pass" type="password" placeholder="Mot de passe" autocomplete="off">
          </div>
          <button class="btn btn-primary btn-block" id="login-btn">Se connecter</button>
          <div class="login-hint">
            <div style="font-size:12px;color:var(--text-3);text-align:center;margin-top:8px">
              Comptes de démonstration : Julien / 456 · Nils / 123
            </div>
          </div>
        </div>
      </div>
    </div>`

  const doLogin = async () => {
    const name = document.getElementById('login-name').value.trim()
    const pass = document.getElementById('login-pass').value
    if (!name || !pass) { toast('Veuillez remplir tous les champs', 'error'); return }
    const { data: user } = await supabase
      .from('app_users')
      .select('*')
      .eq('name', name)
      .eq('password', pass)
      .maybeSingle()
    if (!user) { toast('Nom ou mot de passe incorrect', 'error'); return }
    sessionStorage.setItem('app_user', JSON.stringify({ id: user.id, name: user.name, role: user.role, avatar_color: user.avatar_color }))
    toast(`Bienvenue ${user.name} !`, 'success')
    onLogin(user)
  }

  document.getElementById('login-btn').onclick = doLogin
  document.getElementById('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin() })
  document.getElementById('login-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin() })
}
