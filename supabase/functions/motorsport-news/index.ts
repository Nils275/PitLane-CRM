import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FEEDS = [
  "https://www.autosport.com/rss/feed/f1",
  "https://www.autosport.com/rss/feed/all",
  "https://www.motorsport.com/rss/f1/news.xml",
  "https://www.motorsport.com/rss/all/news.xml",
  "https://www.gpblog.com/rss.xml",
  "https://www.racefans.net/feed/",
];

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  enclosure?: string;
  source?: string;
}

function stripHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractItems(xml: string, source: string): FeedItem[] {
  const items: FeedItem[] = [];
  const re = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
      return r ? r[1].trim() : "";
    };
    const title = stripHtml(get("title"));
    const link = stripHtml(get("link"));
    const pubDate = get("pubDate") || get("published") || get("date") || "";
    const desc = stripHtml(get("description"));
    let img = "";
    const enc = /<enclosure[^>]*url="([^"]+)"/i.exec(block);
    if (enc) img = enc[1];
    if (!img) {
      const md = /<media:content[^>]*url="([^"]+)"/i.exec(block);
      if (md) img = md[1];
    }
    if (!img) {
      const cd = /<content:encoded[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i.exec(block);
      if (cd) img = cd[1];
    }
    if (title && link) {
      items.push({ title, link, pubDate, description: desc, enclosure: img, source });
    }
  }
  return items;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const all: FeedItem[] = [];
    for (const url of FEEDS) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BoltNewsBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const src = new URL(url).hostname.replace("www.", "");
        all.push(...extractItems(xml, src));
      } catch {
        // skip failing feed
      }
    }

    // dedupe by title
    const seen = new Set<string>();
    const unique = all.filter((i) => {
      const k = i.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // sort by date desc
    unique.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    const articles = unique.slice(0, 40).map((i) => ({
      title: i.title,
      source: i.source || "",
      url: i.link,
      summary: (i.description || "").slice(0, 280),
      image_url: i.enclosure || "",
      published_at: i.pubDate ? new Date(i.pubDate).toISOString() : new Date().toISOString(),
    }));

    // cache into press_articles table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    if (articles.length) {
      await supabase.from("press_articles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("press_articles").insert(articles);
    }

    return new Response(JSON.stringify({ articles, count: articles.length, fetchedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
