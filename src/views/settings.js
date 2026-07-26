import { supabase } from '../supabase.js'
import { Icon } from '../icons.js'
import { toast } from '../router.js'
import { escape } from './dashboard.js'
import { updateBrand } from '../main.js'

export async function renderSettings(content) {
  content.innerHTML = `<div class="spinner"></div>`
  const { data } = await supabase.from('company_settings').select('*').maybeSingle()
  const s = data || { name: 'Mon Entreprise', primary_color: '#2563eb', logo_url: '' }

  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Paramètres</div><div class="page-sub">Configuration de l'entreprise</div></div>
    </div>
    <div class="grid grid-2">
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">Entreprise</div>
        <div class="field" style="margin-bottom:14px"><label>Nom</label><input id="c-name" value="${escape(s.name)}"></div>
        <div class="field" style="margin-bottom:14px"><label>Logo (URL)</label><input id="c-logo" value="${escape(s.logo_url || '')}" placeholder="https://..."></div>
        <div class="field" style="margin-bottom:14px"><label>Couleur principale</label><input type="color" id="c-color" value="${s.primary_color}" style="height:38px"></div>
        <button class="btn btn-primary" id="save-company">Enregistrer</button>
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">Apparence</div>
        <div class="field" style="margin-bottom:14px">
          <label>Thème</label>
          <div style="display:flex;gap:10px">
            <button class="btn theme-opt" data-theme="light">${Icon.sun(16)} Clair</button>
            <button class="btn theme-opt" data-theme="dark">${Icon.moon(16)} Sombre</button>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-3);margin-top:10px">Le thème s'applique immédiatement et est sauvegardé localement.</div>
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">À propos</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.7">
          Plateforme de gestion d'entreprise — modules: Dashboard, Tâches, Projets, Équipe, CRM, Discussions, Finance.
          Données persistées via Supabase.
        </div>
      </div>
    </div>`

  document.getElementById('save-company').onclick = async () => {
    const payload = {
      name: document.getElementById('c-name').value.trim(),
      logo_url: document.getElementById('c-logo').value.trim(),
      primary_color: document.getElementById('c-color').value,
    }
    if (s.id) {
      await supabase.from('company_settings').update(payload).eq('id', s.id)
    } else {
      await supabase.from('company_settings').insert(payload)
    }
    toast('Paramètres enregistrés', 'success')
    document.documentElement.style.setProperty('--primary', payload.primary_color)
    updateBrand(payload)
  }

  content.querySelectorAll('.theme-opt').forEach((b) => b.onclick = () => {
    document.documentElement.setAttribute('data-theme', b.dataset.theme)
    localStorage.setItem('theme', b.dataset.theme)
    toast('Thème ' + b.dataset.theme, 'success')
  })
}
