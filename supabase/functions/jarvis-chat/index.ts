import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// JARVIS autonomous assistant v2

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messages = body.messages || [];
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
    const query = (lastUserMsg?.content || "").toLowerCase();

    const actionResult = await tryAction(query, supabase);

    let reply = "";
    if (actionResult) {
      reply = actionResult;
    } else {
      let contextText = "";
      try {
        const newsRes = await supabase
          .from("press_articles")
          .select("title,source,published_at")
          .order("published_at", { ascending: false })
          .limit(8);
        if (newsRes.data && newsRes.data.length) {
          contextText = newsRes.data.map((n: any) => "- " + n.title + " (" + n.source + ")").join("\n");
        }
      } catch (e) {}
      reply = fallbackReply(messages, contextText);
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, reply: "Désolé, une erreur est survenue." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function tryAction(query: string, supabase: any): Promise<string | null> {
  const clientMatch = query.match(/(?:ajoute|cr[ée]e|nouveau|ajouter)\s+(?:le\s+)?(?:client|compte)\s+(.+)/i);
  if (clientMatch) return await createClient(supabase, clientMatch[1].trim());

  if (/(?:cr[ée]e|ajoute|ajouter|cr[ée]er)\s+(?:moi\s+)?(?:une\s+)?(?:la\s+)?t[âa]che/i.test(query) || /t[âa]che\s*:/i.test(query)) {
    return await createTask(query, supabase);
  }

  const projectMatch = query.match(/(?:cr[ée]e|ajoute|nouveau)\s+(?:le\s+)?projet\s+(.+)/i);
  if (projectMatch) return await createProject(supabase, projectMatch[1].trim());

  if (/(?:liste|affiche|montre|quelles sont)\s+(?:les\s+)?t[âa]ches/i.test(query) || /mes t[âa]ches/i.test(query)) {
    return await listTasks(supabase);
  }

  if (/(?:liste|affiche|montre|quels sont)\s+(?:les\s+)?clients/i.test(query)) {
    return await listClients(supabase);
  }

  return null;
}

async function createClient(supabase: any, name: string): Promise<string> {
  name = name.replace(/[.,;:!?]+$/, "").trim();
  const parts = name.split(",");
  const clientName = parts[0].trim();
  const company = (parts[1] || "").trim();

  const existingRes = await supabase.from("clients").select("id").ilike("name", clientName).maybeSingle();
  if (existingRes.data) return 'Le client "' + clientName + '" existe déjà.';

  const colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04"];
  const insRes = await supabase.from("clients").insert({
    name: clientName, company, logo_color: colors[Math.floor(Math.random() * colors.length)], status: "active",
  }).select().single();

  if (insRes.error) return "Erreur: " + insRes.error.message;
  let r = "Client créé avec succès !\n\nNom: " + clientName;
  if (company) r += "\nEntreprise: " + company;
  r += "\nStatut: Actif";
  return r;
}

async function createTask(query: string, supabase: any): Promise<string> {
  let title = "";
  const colonMatch = query.match(/t[âa]che\s*:\s*(.+)/i);
  if (colonMatch) {
    title = colonMatch[1].trim();
  } else {
    const afterTask = query.match(/t[âa]che(?:\s+(?:pour|à|au|d[ue]\s+))?\s+(.+)/i);
    title = afterTask ? afterTask[1].trim() : "Nouvelle tâche";
  }
  title = title.split(/\s+(?:pour|à|au|d[ue]\s+|par|avant|pour le)\s+/i)[0].trim();
  title = title.replace(/[.,;:!?]+$/, "").trim();

  const teamRes = await supabase.from("team_members").select("*");
  let assignee = "";
  if (teamRes.data) {
    for (const m of teamRes.data) {
      if (query.includes(m.first_name.toLowerCase()) || query.includes((m.first_name + " " + m.last_name).toLowerCase())) {
        assignee = m.first_name + " " + m.last_name;
        break;
      }
    }
  }
  if (!assignee) {
    const usersRes = await supabase.from("app_users").select("*");
    if (usersRes.data) {
      for (const u of usersRes.data) {
        if (query.includes(u.name.toLowerCase())) {
          const tm = (teamRes.data || []).find((m: any) => m.first_name.toLowerCase() === u.name.toLowerCase());
          assignee = tm ? (tm.first_name + " " + tm.last_name) : u.name;
          break;
        }
      }
    }
  }

  let dueDate: string | null = null;
  const months: Record<string, string> = {
    "janvier": "01", "février": "02", "fevrier": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "août": "08", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12", "decembre": "12",
  };
  const dayMatch = query.match(/(?:avant|pour le|pour|deadline)\s+(\d{1,2})\s*([a-zéûôà]+)/i);
  const dateMatch = query.match(/(\d{1,2})\s*([a-zéûôà]+)\s*(\d{4})?/i);
  let day: string | null = null, month: string | null = null, year: string | null = null;
  if (dayMatch) {
    day = dayMatch[1].padStart(2, "0");
    month = months[dayMatch[2].toLowerCase()] || null;
  } else if (dateMatch) {
    day = dateMatch[1].padStart(2, "0");
    month = months[dateMatch[2].toLowerCase()] || null;
    if (dateMatch[3]) year = dateMatch[3];
  }
  if (day && month) {
    if (!year) {
      const now = new Date();
      year = String(now.getFullYear());
      if (new Date(year + "-" + month + "-" + day) < now) year = String(now.getFullYear() + 1);
    }
    dueDate = year + "-" + month + "-" + day;
  }

  let clientId: string | null = null, clientName = "";
  const clientsRes = await supabase.from("clients").select("*");
  if (clientsRes.data) {
    for (const c of clientsRes.data) {
      if (query.includes(c.name.toLowerCase())) { clientId = c.id; clientName = c.name; break; }
    }
  }

  let priority = "medium";
  if (/priorit[ée]\s*(?:haute|élevée|high)/i.test(query) || /urgent/i.test(query)) priority = "high";
  else if (/priorit[ée]\s*(?:basse|low)/i.test(query)) priority = "low";

  const payload: any = { title, status: "todo", priority, assignee: assignee || "", due_date: dueDate, client_id: clientId };
  if (clientId) {
    const projRes = await supabase.from("projects").select("id").eq("client_id", clientId).maybeSingle();
    if (projRes.data) payload.project_id = projRes.data.id;
  }

  const insRes = await supabase.from("tasks").insert(payload).select().single();
  if (insRes.error) return "Erreur: " + insRes.error.message;

  let r = "Tâche créée avec succès !\n\nTitre: " + title + "\n";
  r += "Priorité: " + (priority === "high" ? "Haute" : priority === "low" ? "Basse" : "Moyenne") + "\n";
  if (assignee) r += "Assignée à: " + assignee + "\n";
  if (dueDate) r += "Date limite: " + new Date(dueDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "\n";
  if (clientName) r += "Client: " + clientName + "\n";
  r += "\nLa tâche est dans le tableau Kanban et l'agenda a été mis à jour.";
  return r;
}

async function createProject(supabase: any, name: string): Promise<string> {
  name = name.replace(/[.,;:!?]+$/, "").trim();
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];
  const res = await supabase.from("projects").insert({ name, status: "planning", color: colors[Math.floor(Math.random() * colors.length)] }).select().single();
  if (res.error) return "Erreur: " + res.error.message;
  return 'Projet "' + name + '" créé avec succès !';
}

async function listTasks(supabase: any): Promise<string> {
  const res = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(15);
  if (!res.data || !res.data.length) return "Aucune tâche pour le moment.";
  let r = "Voici les " + res.data.length + " tâches les plus récentes:\n\n";
  for (const t of res.data) {
    const st = t.status === "todo" ? "À faire" : t.status === "doing" ? "En cours" : t.status === "review" ? "Revue" : "Terminé";
    r += "• " + t.title + " [" + st + "]";
    if (t.assignee) r += " — " + t.assignee;
    if (t.due_date) r += " — " + new Date(t.due_date).toLocaleDateString("fr-FR");
    r += "\n";
  }
  return r;
}

async function listClients(supabase: any): Promise<string> {
  const res = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (!res.data || !res.data.length) return "Aucun client enregistré.";
  let r = "Voici les " + res.data.length + " client(s):\n\n";
  for (const c of res.data) r += "• " + c.name + (c.company ? " (" + c.company + ")" : "") + " — " + (c.status === "active" ? "Actif" : "Inactif") + "\n";
  return r;
}

function fallbackReply(messages: any[], context: string): string {
  const last = messages.filter((m: any) => m.role === "user").pop();
  const q = (last?.content || "").toLowerCase();
  if (!q) return "Bonjour, je suis JARVIS. Comment puis-je vous aider ?";
  if (/bonjour|salut|coucou|hello|hey/.test(q))
    return "Bonjour ! Je suis JARVIS, votre assistant IA autonome. Je peux créer des clients, des tâches, des projets et les assigner. Essayez: \"Crée le client Oups-Club\" ou \"Crée une tâche: maquette Instagram pour Oups-Club, Julien, 31 août\".";
  if (/qui es.tu|ton nom|jarvis|présente/.test(q))
    return "Je suis JARVIS, votre assistant IA autonome. Je peux:\n• Créer des clients\n• Créer des tâches avec assignation et date\n• Créer des projets\n• Lister les tâches et clients";
  if (/aide|help|comment|que peux.tu/.test(q))
    return "Voici ce que je peux faire:\n\n1. \"ajoute le client Oups-Club\"\n2. \"crée une tâche: maquette Instagram pour Oups-Club, Julien, 31 août\"\n3. \"crée le projet Campagne F1\"\n4. \"montre-moi les tâches\"\n5. \"quels sont nos clients ?\"";
  if (/merci|thanks|thank/.test(q)) return "Avec plaisir !";
  return "Je suis autonome pour les actions ! Essayez:\n• \"Crée le client Oups-Club\"\n• \"Crée une tâche: maquette Instagram pour Oups-Club, Julien, 31 août\"\n• \"Montre-moi les tâches\"";
}
