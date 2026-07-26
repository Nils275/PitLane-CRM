import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: Message[];
  search?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, search } = (await req.json()) as ChatRequest;

    // Gather context: recent news from press_articles table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let contextText = "";
    try {
      const { data: recentNews } = await supabase
        .from("press_articles")
        .select("title,summary,source,published_at,url")
        .order("published_at", { ascending: false })
        .limit(8);
      if (recentNews && recentNews.length) {
        contextText = "\n\nActualité sport automobile récente:\n" +
          recentNews.map((n: any) => `- ${n.title} (${n.source}, ${new Date(n.published_at).toLocaleDateString("fr-FR")})`).join("\n");
      }
    } catch {
      // ignore
    }

    // Try to use an LLM API if a key is configured, otherwise use a smart fallback.
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    let assistantReply = "";

    const systemPrompt = `Tu es JARVIS, un assistant IA intégré dans une plateforme de gestion d'entreprise spécialisée dans le sport automobile. Tu réponds en français, de manière concise et utile. Tu aides l'équipe avec des questions sur leurs projets, tâches, communication, et l'actualité du sport automobile. Tu es cordial et professionnel.${contextText}`;

    if (openaiKey) {
      assistantReply = await callOpenAI(openaiKey, systemPrompt, messages);
    } else if (anthropicKey) {
      assistantReply = await callAnthropic(anthropicKey, systemPrompt, messages);
    } else if (geminiKey) {
      assistantReply = await callGemini(geminiKey, systemPrompt, messages);
    } else {
      // No LLM key configured — use a helpful fallback that can still answer basic questions
      assistantReply = fallbackReply(messages, contextText);
    }

    return new Response(
      JSON.stringify({ reply: assistantReply, source: openaiKey ? "openai" : anthropicKey ? "anthropic" : geminiKey ? "gemini" : "fallback" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, reply: "Désolé, une erreur est survenue. Réessayez dans un instant." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callOpenAI(key: string, system: string, messages: Message[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "Je n'ai pas pu générer de réponse.";
}

async function callAnthropic(key: string, system: string, messages: Message[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      system,
      max_tokens: 800,
      messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const json = await res.json();
  return json.content?.[0]?.text || "Je n'ai pas pu générer de réponse.";
}

async function callGemini(key: string, system: string, messages: Message[]): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "Je n'ai pas pu générer de réponse.";
}

function fallbackReply(messages: Message[], context: string): string {
  const last = messages.filter((m) => m.role === "user").pop();
  const q = (last?.content || "").toLowerCase();

  if (!q) return "Bonjour, je suis JARVIS. Comment puis-je vous aider ?";

  if (/bonjour|salut|coucou|hello|hey/.test(q)) {
    return "Bonjour ! Je suis JARVIS, votre assistant IA. Je peux vous aider avec vos projets, tâches, et l'actualité du sport automobile. Posez-moi une question !";
  }
  if (/actualité|news|sport auto|formule 1|f1|résultat|grand prix|course/.test(q)) {
    if (context) {
      return "Voici les dernières actualités du sport automobile :\n" + context.replace("\n\nActualité sport automobile récente:\n", "");
    }
    return "Pour consulter l'actualité du sport automobile en temps réel, rendez-vous dans la section 'Presse Sport Auto' du menu. Vous pouvez cliquer sur 'Actualiser' pour récupérer les derniers articles.";
  }
  if (/projet|tâche|task/.test(q)) {
    return "Vous pouvez gérer vos projets et tâches depuis les sections dédiées dans le menu latéral. Créez un projet, ajoutez des tâches avec dates d'échéance, et elles apparaîtront automatiquement dans l'agenda.";
  }
  if (/document|fichier|doc/.test(q)) {
    return "La section Documents vous permet d'organiser vos fichiers par projet. Vous pouvez ajouter des documents avec leur lien, les verrouiller, et les retrouver facilement.";
  }
  if (/communication|contact|email|message/.test(q)) {
    return "La section Communication vous permet de suivre tous vos échanges (emails, appels, réunions) avec clients et partenaires, par canal et par projet.";
  }
  if (/template|canva|photoshop|design/.test(q)) {
    return "La section Templates vous donne un accès rapide à Canva, Photoshop, Figma et autres outils de création. Cliquez sur un template pour ouvrir l'outil correspondant.";
  }
  if (/agenda|calendrier|rendez-vous|évènement/.test(q)) {
    return "L'agenda affiche vos évènements et vos tâches automatiquement. Utilisez les vues Jour, Semaine ou Mois selon vos besoins.";
  }
  if (/merci|thanks|thank/.test(q)) {
    return "Avec plaisir ! N'hésitez pas si vous avez d'autres questions.";
  }
  if (/qui es.tu|ton nom|jarvis|présente/.test(q)) {
    return "Je suis JARVIS, l'assistant IA intégré à votre plateforme de gestion. Je peux répondre à vos questions sur vos projets, l'actualité du sport automobile, et vous guider dans l'utilisation de l'application.";
  }
  if (/aide|help|comment/.test(q)) {
    return "Je peux vous aider à :\n• Naviguer dans la plateforme (projets, tâches, agenda, documents, communication)\n• Consulter l'actualité du sport automobile\n• Comprendre le fonctionnement de chaque section\nPosez-moi votre question !";
  }

  return "Je n'ai pas de clé API IA configurée pour le moment, donc mes réponses sont limitées. Pour activer l'IA complète (réponses intelligentes et recherche web), ajoutez une clé OpenAI, Anthropic ou Gemini dans les secrets Supabase. En attendant, je peux vous guider dans l'utilisation de la plateforme.";
}
