import { Icon } from '../icons.js'
import { toast } from '../router.js'
import { escape } from './dashboard.js'
import { supabase } from '../supabase.js'

export async function renderPress(content) {
  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Presse — Sport Automobile</div><div class="page-sub">Actualité F1 et sport auto en temps réel</div></div>
      <button class="btn btn-primary" id="refresh-news">${Icon.trend(16)} Actualiser</button>
    </div>
    <div id="news-feed"><div class="spinner"></div></div>`

  document.getElementById('refresh-news').onclick = () => loadNews(content, true)
  loadNews(content, false)
}

async function loadNews(content, force) {
  const feed = document.getElementById('news-feed')
  feed.innerHTML = `<div class="spinner"></div>`

  let articles = []
  if (force) {
    // call edge function to fetch fresh RSS and cache
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/motorsport-news`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      })
      if (res.ok) {
        const json = await res.json()
        articles = json.articles || []
        toast(`${articles.length} articles récupérés`, 'success')
      } else {
        toast('Erreur lors de la récupération', 'error')
      }
    } catch (e) {
      toast('Erreur réseau', 'error')
    }
  } else {
    // try cached articles first
    const { data } = await supabase.from('press_articles').select('*').order('published_at', { ascending: false }).limit(40)
    articles = data || []
    if (!articles.length) {
      // no cache yet — fetch live
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/motorsport-news`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        })
        if (res.ok) {
          const json = await res.json()
          articles = json.articles || []
        }
      } catch {
        // ignore
      }
    }
  }

  if (!articles.length) {
    feed.innerHTML = `<div class="empty">Aucun article. Cliquez sur "Actualiser" pour récupérer l'actualité.</div>`
    return
  }

  feed.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
      ${articles.map((a) => `
        <a href="${escape(a.url || '#')}" target="_blank" class="card" style="overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
          ${a.image_url ? `<div style="height:160px;background:#111 url('${escape(a.image_url)}') center/cover;flex-shrink:0"></div>` : `<div style="height:120px;background:var(--surface-2);display:grid;place-items:center;color:var(--text-3);flex-shrink:0">${Icon.briefcase(32)}</div>`}
          <div style="padding:14px;display:flex;flex-direction:column;gap:6px;flex:1">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge badge-primary">${escape(a.source || 'Presse')}</span>
              <span style="font-size:11px;color:var(--text-3)">${a.published_at ? new Date(a.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>
            <div style="font-size:14px;font-weight:600;line-height:1.4">${escape(a.title)}</div>
            ${a.summary ? `<div style="font-size:12px;color:var(--text-3);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escape(a.summary)}</div>` : ''}
          </div>
        </a>`).join('')}
    </div>`
}
