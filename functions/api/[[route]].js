/**
 * Cloudflare Pages Function — /functions/api/[[route]].js
 *
 * Routes:
 *   GET    /api/settings                → fetch settings blob
 *   PUT    /api/settings                → save settings blob
 *
 *   GET    /api/templates               → list all templates
 *   POST   /api/templates               → create template
 *   PUT    /api/templates/:id           → update template
 *   DELETE /api/templates/:id           → delete template
 *
 *   GET    /api/clauses                 → list all clauses
 *   POST   /api/clauses                 → create clause
 *   PUT    /api/clauses/:id             → update clause (snapshots old content)
 *   DELETE /api/clauses/:id             → delete clause
 *   GET    /api/clauses/:id/usage       → list templates referencing this clause
 *   GET    /api/clauses/:id/versions    → list saved content versions
 *
 *   GET    /api/rules                   → list all rules
 *   POST   /api/rules                   → create rule
 *   PUT    /api/rules/:id               → update rule
 *   DELETE /api/rules/:id               → delete rule
 *
 *   GET    /api/audit                   → list audit log entries (?action=&recordType=&userName=&from=&to=&limit=&offset=)
 *   POST   /api/audit                   → write audit log entry
 *
 *   GET    /api/generations             → list generation snapshots (?search=&from=&to=&limit=&offset=)
 *   POST   /api/generations             → save generation snapshot
 *   GET    /api/generations/:id         → fetch single generation snapshot
 *
 *   GET    /api/users                   → list all users
 *   POST   /api/users                   → create user
 *   PUT    /api/users/:id               → update user
 *   DELETE /api/users/:id               → delete user
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── EMEA Law Monitor — Official source definitions ───────────────────────────
const LAW_SOURCES = [
  // ── EU ───────────────────────────────────────────────────────────────────────
  { id: "eurlex-social",      country: "EU", region: "Europe",        name: "EUR-Lex – Employment & Social Policy",            url: "https://eur-lex.europa.eu/search.html?scope=EURLEX&type=quick&lang=en&SUBDOM_INIT=ALL_ALL&DTS_DOM=ALL&typeDocument=REGULATION&DTS_SUBDOM=EMPLOYMENT_SOCIAL", feed_url: "https://eur-lex.europa.eu/RSSONE.do?locale=en&ihmlang=en&type=OJ&DD_YEAR=2025", feed_type: "rss" },
  // ── UK ───────────────────────────────────────────────────────────────────────
  { id: "uk-legislation",     country: "GB", region: "Europe",        name: "UK Legislation – New Acts & SIs",                 url: "https://www.legislation.gov.uk", feed_url: "https://www.legislation.gov.uk/new/data.feed", feed_type: "atom" },
  { id: "uk-gov-employment",  country: "GB", region: "Europe",        name: "GOV.UK – Employment Guidance & Consultations",    url: "https://www.gov.uk/employment", feed_url: "https://www.gov.uk/search/all.atom?keywords=employment+law&order=updated", feed_type: "atom" },
  { id: "uk-acas",            country: "GB", region: "Europe",        name: "Acas – Guidance Updates",                        url: "https://www.acas.org.uk", feed_url: "https://www.acas.org.uk/feeds/news", feed_type: "rss" },
  // ── Germany ──────────────────────────────────────────────────────────────────
  { id: "de-bmas",            country: "DE", region: "Europe",        name: "BMAS – Federal Ministry of Labour (Germany)",     url: "https://www.bmas.de/EN/Home/home.html", feed_url: "https://www.bmas.de/SiteGlobals/Forms/Webs/BMAS/rss-en/rss.html", feed_type: "rss" },
  { id: "de-bgbl",            country: "DE", region: "Europe",        name: "Bundesgesetzblatt – Federal Law Gazette",         url: "https://www.bgbl.de", feed_url: null, feed_type: "html" },
  // ── France ───────────────────────────────────────────────────────────────────
  { id: "fr-legifrance",      country: "FR", region: "Europe",        name: "Légifrance – Journal Officiel (Labour)",          url: "https://www.legifrance.gouv.fr", feed_url: "https://www.legifrance.gouv.fr/rss/jorf.xml", feed_type: "rss" },
  { id: "fr-travail",         country: "FR", region: "Europe",        name: "Ministère du Travail (France)",                   url: "https://travail-emploi.gouv.fr", feed_url: null, feed_type: "html" },
  // ── Spain ────────────────────────────────────────────────────────────────────
  { id: "es-boe-labour",      country: "ES", region: "Europe",        name: "BOE – Boletín Oficial del Estado (Labour)",       url: "https://www.boe.es", feed_url: "https://www.boe.es/rss/boe.php?s=3", feed_type: "rss" },
  { id: "es-mites",           country: "ES", region: "Europe",        name: "Ministerio de Trabajo (Spain)",                   url: "https://www.mites.gob.es", feed_url: null, feed_type: "html" },
  // ── Italy ────────────────────────────────────────────────────────────────────
  { id: "it-gazzetta",        country: "IT", region: "Europe",        name: "Gazzetta Ufficiale (Italy)",                      url: "https://www.gazzettaufficiale.it", feed_url: "https://www.gazzettaufficiale.it/rss/homepage.xml", feed_type: "rss" },
  // ── Netherlands ──────────────────────────────────────────────────────────────
  { id: "nl-officieel",       country: "NL", region: "Europe",        name: "Officiële bekendmakingen (Netherlands)",          url: "https://zoek.officielebekendmakingen.nl", feed_url: "https://zoek.officielebekendmakingen.nl/rss/staatscourant", feed_type: "rss" },
  // ── Belgium ──────────────────────────────────────────────────────────────────
  { id: "be-ejustice",        country: "BE", region: "Europe",        name: "Belgian Official Gazette (Moniteur/Staatsblad)",  url: "https://www.ejustice.just.fgov.be/cgi/welcome.pl", feed_url: null, feed_type: "html" },
  // ── Ireland ──────────────────────────────────────────────────────────────────
  { id: "ie-legislation",     country: "IE", region: "Europe",        name: "Irish Statute Book – Employment Acts",            url: "https://www.irishstatutebook.ie/eli/IsAct.html", feed_url: null, feed_type: "html" },
  { id: "ie-workplace",       country: "IE", region: "Europe",        name: "Workplace Relations Commission (Ireland)",        url: "https://www.workplacerelations.ie/en/news-media/", feed_url: null, feed_type: "html" },
  // ── Poland ───────────────────────────────────────────────────────────────────
  { id: "pl-dziennikustaw",   country: "PL", region: "Europe",        name: "Dziennik Ustaw – Polish Journal of Laws",         url: "https://dziennikustaw.gov.pl", feed_url: "https://dziennikustaw.gov.pl/DU/rss.xml", feed_type: "rss" },
  // ── Sweden ───────────────────────────────────────────────────────────────────
  { id: "se-riksdagen",       country: "SE", region: "Europe",        name: "Riksdagen – Labour Committee (Sweden)",           url: "https://www.riksdagen.se/sv/arbete-lagar-och-regler/", feed_url: "https://riksdagen.se/sv/RSS/Dokument/?organ=AU&type=bet", feed_type: "rss" },
  // ── Denmark ──────────────────────────────────────────────────────────────────
  { id: "dk-retsinformation", country: "DK", region: "Europe",        name: "Retsinformation.dk (Denmark)",                   url: "https://www.retsinformation.dk/eli/lta/", feed_url: null, feed_type: "html" },
  // ── Switzerland ──────────────────────────────────────────────────────────────
  { id: "ch-fedlex",          country: "CH", region: "Europe",        name: "Fedlex – Swiss Federal Law",                     url: "https://www.fedlex.admin.ch/en/home", feed_url: "https://www.fedlex.admin.ch/feed/recent", feed_type: "atom" },
  // ── Norway ───────────────────────────────────────────────────────────────────
  { id: "no-arbeidstilsynet", country: "NO", region: "Europe",        name: "Arbeidstilsynet – Norwegian Labour Inspectorate", url: "https://www.arbeidstilsynet.no/en/news/", feed_url: null, feed_type: "html" },
  // ── Austria ──────────────────────────────────────────────────────────────────
  { id: "at-ris",             country: "AT", region: "Europe",        name: "RIS – Austrian Federal Law Register",             url: "https://www.ris.bka.gv.at/default.aspx", feed_url: null, feed_type: "html" },
  // ── Portugal ─────────────────────────────────────────────────────────────────
  { id: "pt-dre",             country: "PT", region: "Europe",        name: "DRE – Diário da República (Portugal)",            url: "https://dre.pt", feed_url: "https://dre.pt/rss/rss.html", feed_type: "rss" },
  // ── Finland ──────────────────────────────────────────────────────────────────
  { id: "fi-finlex",          country: "FI", region: "Europe",        name: "Finlex – Finnish Legislation",                   url: "https://www.finlex.fi/en/", feed_url: null, feed_type: "html" },
  // ── International ────────────────────────────────────────────────────────────
  { id: "ilo-news",           country: "INT", region: "International", name: "ILO – International Labour Organization News",   url: "https://www.ilo.org/global/news-and-events/news/lang--en/index.htm", feed_url: "https://www.ilo.org/rss/news-en.xml", feed_type: "rss" },
  { id: "ilo-natlex",         country: "INT", region: "International", name: "ILO NATLEX – New Legislation Database",          url: "https://natlex.ilo.org/dyn/natlex2/natlex2.home?p_lang=en", feed_url: null, feed_type: "html" },
  // ── UAE ──────────────────────────────────────────────────────────────────────
  { id: "ae-mohre",           country: "AE", region: "Middle East",   name: "UAE MOHRE – Ministry of HR & Emiratisation",     url: "https://www.mohre.gov.ae/en/laws-and-regulations/federal-laws.aspx", feed_url: null, feed_type: "html" },
  { id: "ae-uaelegislation",  country: "AE", region: "Middle East",   name: "UAE Legislation – Official Portal",              url: "https://uaelegislation.gov.ae/en/legislations", feed_url: null, feed_type: "html" },
  // ── Saudi Arabia ─────────────────────────────────────────────────────────────
  { id: "sa-hrsd",            country: "SA", region: "Middle East",   name: "HRSD Saudi Arabia – Ministry of HR",             url: "https://www.hrsd.gov.sa/en/news", feed_url: null, feed_type: "html" },
  { id: "sa-ncar",            country: "SA", region: "Middle East",   name: "Saudi NCAR – National Centre for Labour Regs",   url: "https://ncar.hrsd.gov.sa/En/Home", feed_url: null, feed_type: "html" },
  // ── Qatar ────────────────────────────────────────────────────────────────────
  { id: "qa-mol",             country: "QA", region: "Middle East",   name: "Qatar Ministry of Labour",                       url: "https://www.mol.gov.qa/en/news/", feed_url: null, feed_type: "html" },
  { id: "qa-adlsaq",          country: "QA", region: "Middle East",   name: "Qatar Legal Portal – Labour Laws",               url: "https://www.almeezan.qa/LawPage.aspx?id=3971&language=en", feed_url: null, feed_type: "html" },
  // ── Bahrain ──────────────────────────────────────────────────────────────────
  { id: "bh-lmra",            country: "BH", region: "Middle East",   name: "Bahrain LMRA – Labour Regulations",              url: "https://www.lmra.gov.bh/en/page/show/regulation-and-procedures", feed_url: null, feed_type: "html" },
  // ── Kuwait ───────────────────────────────────────────────────────────────────
  { id: "kw-msal",            country: "KW", region: "Middle East",   name: "Kuwait Ministry of Social Affairs & Labour",     url: "https://www.msal.gov.kw/index.php/en/msal-news", feed_url: null, feed_type: "html" },
  // ── Oman ─────────────────────────────────────────────────────────────────────
  { id: "om-mol",             country: "OM", region: "Middle East",   name: "Oman Ministry of Labour",                        url: "https://mol.gov.om/en/laws-and-regulations/", feed_url: null, feed_type: "html" },
  // ── Israel ───────────────────────────────────────────────────────────────────
  { id: "il-labour",          country: "IL", region: "Middle East",   name: "Israel Ministry of Labour",                     url: "https://www.gov.il/en/departments/ministry_of_labor", feed_url: null, feed_type: "html" },
  // ── South Africa ─────────────────────────────────────────────────────────────
  { id: "za-labour",          country: "ZA", region: "Africa",        name: "South Africa – Dept Employment & Labour",        url: "https://www.labour.gov.za/legislation/acts/labour-relations-act", feed_url: null, feed_type: "html" },
  { id: "za-gazette",         country: "ZA", region: "Africa",        name: "South Africa Government Gazette",                url: "https://www.gpwonline.co.za/Gazettes/Pages/Government-Gazettes.aspx", feed_url: null, feed_type: "html" },
  // ── Nigeria ──────────────────────────────────────────────────────────────────
  { id: "ng-fml",             country: "NG", region: "Africa",        name: "Nigeria Federal Ministry of Labour & Employment",url: "https://labour.gov.ng/ministry/media/news", feed_url: null, feed_type: "html" },
  // ── Kenya ────────────────────────────────────────────────────────────────────
  { id: "ke-labour",          country: "KE", region: "Africa",        name: "Kenya Ministry of Labour & Social Protection",   url: "https://www.labour.go.ke/laws-and-regulations", feed_url: null, feed_type: "html" },
  // ── Egypt ────────────────────────────────────────────────────────────────────
  { id: "eg-manpower",        country: "EG", region: "Africa",        name: "Egypt Ministry of Manpower",                     url: "https://www.manpower.gov.eg/en-us/", feed_url: null, feed_type: "html" },
  // ── Morocco ──────────────────────────────────────────────────────────────────
  { id: "ma-emploi",          country: "MA", region: "Africa",        name: "Morocco Ministry of Employment (ANAPEC)",        url: "https://www.emploi.gov.ma/index.php/en/actualites.html", feed_url: null, feed_type: "html" },
  // ── Ghana ────────────────────────────────────────────────────────────────────
  { id: "gh-melr",            country: "GH", region: "Africa",        name: "Ghana Ministry of Employment & Labour Relations",url: "https://www.melr.gov.gh/legislation/", feed_url: null, feed_type: "html" },
];

// Keywords that indicate employment law relevance (used to filter general feeds like EUR-Lex)
const EMPLOYMENT_KEYWORDS = [
  "employ", "labour", "labor", "worker", "working time", "wage", "salary", "pay ",
  "dismissal", "redundan", "termination", "annual leave", "maternity", "paternity",
  "parental leave", "discriminat", "equal pay", "minimum wage", "overtime", "collective",
  "trade union", "pension", "social securi", "health and safety", "contract of employ",
  "flexible working", "zero hour", "gig economy", "platform work", "posted worker",
  "agency work", "apprentice", "internship", "remuneration",
];

// Sources that are broad (not employment-specific) — need keyword filtering
const BROAD_FEED_SOURCES = new Set([
  "eurlex-social", "fr-legifrance", "es-boe-labour", "it-gazzetta", "pl-dziennikustaw",
  "nl-officieel", "pt-dre", "se-riksdagen", "ch-fedlex",
]);

function needsKeywordFilter(sourceId) {
  return BROAD_FEED_SOURCES.has(sourceId);
}

function isEmploymentRelated(title, summary) {
  const text = ((title || "") + " " + (summary || "")).toLowerCase();
  return EMPLOYMENT_KEYWORDS.some(kw => text.includes(kw));
}

function detectCategory(title, summary) {
  const text = ((title || "") + " " + (summary || "")).toLowerCase();
  if (/minimum.?wage|pay.?rate|wage.?floor|wage.?increase|national.?living.?wage/.test(text)) return "minimum_wage";
  if (/working.?time|working.?hour|overtime|rest.?period|right.?to.?disconnect/.test(text))   return "working_time";
  if (/dismissal|redundanc|termination|unfair.?dismiss|severance/.test(text))                  return "termination";
  if (/annual.?leave|holiday|maternity|paternity|parental.?leave|sick.?leave|carer/.test(text)) return "leave";
  if (/discriminat|equal.?pay|equalit|harassment|diversity|inclusion/.test(text))             return "equality";
  if (/health.?safety|accident|injury|workplace.?safe|occupational/.test(text))               return "health_safety";
  if (/pension|retirement|social.?securi|auto.?enrol/.test(text))                             return "pensions";
  if (/trade.?union|collective.?bargain|industrial.?action|strike/.test(text))                return "collective_rights";
  if (/immigrat|visa|work.?permit|right.?to.?work|sponsorship/.test(text))                   return "immigration";
  return "general";
}

async function hashContent(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function makeChangeId(sourceId, link) {
  const key = `${sourceId}:${link}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).slice(0, 10).map(b => b.toString(16).padStart(2, "0")).join("");
}

function extractXmlTag(xml, tag) {
  const m = new RegExp(`<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  if (!m) return "";
  return ((m[1] || m[2] || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")).trim();
}

function extractXmlAttr(xml, tag, attr) {
  const m = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, "i").exec(xml);
  return m ? m[1].trim() : "";
}

function parseFeedItems(xml, feedType) {
  const items = [];
  const isAtom  = feedType === "atom";
  const itemTag  = isAtom ? "entry" : "item";
  const regex    = new RegExp(`<${itemTag}[\\s>]([\\s\\S]*?)<\\/${itemTag}>`, "gi");
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const block = m[1];
    const title   = extractXmlTag(block, "title");
    const link    = extractXmlAttr(block, "link", "href") || extractXmlTag(block, "link");
    const summary = extractXmlTag(block, isAtom ? "summary" : "description") ||
                    extractXmlTag(block, isAtom ? "content" : "summary");
    const pubDate = extractXmlTag(block, isAtom ? "published" : "pubDate") ||
                    extractXmlTag(block, "updated") ||
                    extractXmlTag(block, "dc:date");
    if (title || link) items.push({ title, link, summary, pubDate });
  }
  return items;
}

async function scanFeedSource(source) {
  const res = await fetch(source.feed_url, {
    headers: { "User-Agent": "HRSC-EMEA-LawMonitor/1.0 (employment law compliance monitoring)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml   = await res.text();
  const items = parseFeedItems(xml, source.feed_type);
  return items.filter(item => {
    if (!needsKeywordFilter(source.id)) return true;
    return isEmploymentRelated(item.title, item.summary);
  });
}

async function scanHtmlSource(source, storedHash) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "HRSC-EMEA-LawMonitor/1.0 (employment law compliance monitoring)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const newHash = await hashContent(body.slice(0, 50000)); // first 50 KB for stability
  return { changed: newHash !== storedHash, newHash };
}

async function ensureSourcesSeeded(DB) {
  const existing = await DB.prepare("SELECT id FROM law_sources").all();
  const existingIds = new Set((existing.results || []).map(r => r.id));

  const toInsert = LAW_SOURCES.filter(s => !existingIds.has(s.id));
  if (toInsert.length === 0) return;

  // Batch insert (D1 has 100-statement limit per batch)
  for (const s of toInsert) {
    await DB.prepare(
      "INSERT OR IGNORE INTO law_sources (id, country, region, name, url, feed_url, feed_type) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(s.id, s.country, s.region, s.name, s.url, s.feed_url || null, s.feed_type).run();
  }
}

async function runLawMonitorScan(DB) {
  await ensureSourcesSeeded(DB);

  const rows   = await DB.prepare("SELECT * FROM law_sources WHERE active = 1").all();
  const sources = rows.results || [];
  let newItems = 0;
  let sourcesScanned = 0;
  const errors = [];

  for (const source of sources) {
    try {
      const now = new Date().toISOString();

      if (source.feed_url && (source.feed_type === "rss" || source.feed_type === "atom")) {
        // ── Feed-based source ──────────────────────────────────────────────────
        const items = await scanFeedSource(source);
        for (const item of items.slice(0, 50)) { // cap at 50 per source per scan
          if (!item.title && !item.link) continue;
          const id = await makeChangeId(source.id, item.link || item.title);
          const existing = await DB.prepare("SELECT id FROM law_changes WHERE id = ?").bind(id).first();
          if (!existing) {
            const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : null;
            await DB.prepare(
              "INSERT OR IGNORE INTO law_changes (id, source_id, title, summary, link, published_at, category) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              id, source.id,
              (item.title || "").slice(0, 500),
              (item.summary || "").slice(0, 1000),
              (item.link || "").slice(0, 2000),
              pubDate,
              detectCategory(item.title, item.summary),
            ).run();
            newItems++;
          }
        }
      } else {
        // ── HTML hash-based source ─────────────────────────────────────────────
        const { changed, newHash } = await scanHtmlSource(source, source.content_hash);
        if (changed) {
          const id = await makeChangeId(source.id, now);
          await DB.prepare(
            "INSERT OR IGNORE INTO law_changes (id, source_id, title, summary, link, category) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(
            id, source.id,
            `${source.name} — page updated`,
            "The official source page has changed. Review for new legislation, guidance, or circulars.",
            source.url,
            "general",
          ).run();
          newItems++;
        }
        await DB.prepare("UPDATE law_sources SET content_hash = ? WHERE id = ?")
          .bind(newHash, source.id).run();
      }

      await DB.prepare("UPDATE law_sources SET last_checked = ? WHERE id = ?")
        .bind(now, source.id).run();
      sourcesScanned++;
    } catch (e) {
      errors.push({ source: source.id, error: e.message });
    }
  }

  return { sources_scanned: sourcesScanned, new_items: newItems, errors };
}

// ─── Cloudflare Cron Trigger — runs every 4 hours ─────────────────────────────
export async function onScheduled(event, env) {
  if (!env.DB) return;
  try {
    await runLawMonitorScan(env.DB);
  } catch (e) {
    console.error("Law monitor scheduled scan failed:", e);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Guard: D1 binding must be present
  if (!DB) {
    return json({
      error: "Database not available. The D1 binding 'DB' is not configured. " +
             "Go to Cloudflare Dashboard → Pages project → Settings → Functions → " +
             "D1 database bindings and add: Variable name = DB, Database = hrsc-contract-builder. " +
             "Then redeploy. If the database does not exist yet, run: " +
             "npx wrangler d1 create hrsc-contract-builder && npx wrangler d1 execute hrsc-contract-builder --remote --file=schema.sql"
    }, 503);
  }

  const url = new URL(request.url);
  // Strip /api/ prefix, split into parts
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = parts[0]; // templates | clauses | rules | settings | audit | generations | users
  const id       = parts[1]; // optional record id
  const sub      = parts[2]; // optional sub-resource (usage, versions)

  try {
    // ── SETTINGS ──────────────────────────────────────────────────────────────
    if (resource === "settings") {
      if (request.method === "GET") {
        const row = await DB.prepare("SELECT value FROM settings WHERE key = 'main'").first();
        return json(row ? JSON.parse(row.value) : null);
      }
      if (request.method === "PUT") {
        const body = await request.json();
        await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('main', ?)")
          .bind(JSON.stringify(body)).run();
        return json({ ok: true });
      }
    }

    // ── TEMPLATES ─────────────────────────────────────────────────────────────
    if (resource === "templates") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT data FROM templates ORDER BY rowid").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO templates (id, data, country, entity_id) VALUES (?, ?, ?, ?)")
          .bind(body.id, JSON.stringify(body), body.country || null, body.entityId || null).run();
        return json(body, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE templates SET data = ?, country = ?, entity_id = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(body), body.country || null, body.entityId || null, id).run();
        return json(body);
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── CLAUSES ───────────────────────────────────────────────────────────────
    if (resource === "clauses") {
      // Sub-resource: usage
      if (request.method === "GET" && id && sub === "usage") {
        const rows = await DB.prepare("SELECT id, data FROM templates").all();
        const using = rows.results
          .filter(r => r.data.includes(`"clauseId":"${id}"`))
          .map(r => { const t = JSON.parse(r.data); return { id: t.id, name: t.name }; });
        return json({ templates: using, count: using.length });
      }

      // Sub-resource: versions
      if (request.method === "GET" && id && sub === "versions") {
        const rows = await DB.prepare(
          "SELECT id, clause_id, name, saved_by, saved_at, substr(content,1,200) AS preview FROM clause_versions WHERE clause_id = ? ORDER BY saved_at DESC LIMIT 30"
        ).bind(id).all();
        return json(rows.results);
      }

      if (request.method === "GET" && !id) {
        const rows = await DB.prepare("SELECT data FROM clauses ORDER BY rowid").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        const { _savedBy: _, ...cleanBody } = body;
        await DB.prepare("INSERT INTO clauses (id, data, is_global) VALUES (?, ?, ?)")
          .bind(cleanBody.id, JSON.stringify(cleanBody), cleanBody.global ? 1 : 0).run();
        return json(cleanBody, 201);
      }
      if (request.method === "PUT" && id && !sub) {
        const body = await request.json();
        const savedBy = body._savedBy || "Unknown";
        const { _savedBy: _, ...cleanBody } = body;

        // Snapshot old content if it changed
        const old = await DB.prepare("SELECT data FROM clauses WHERE id = ?").bind(id).first();
        if (old) {
          const oldData = JSON.parse(old.data);
          if (oldData.content !== cleanBody.content) {
            await DB.prepare(
              "INSERT INTO clause_versions (id, clause_id, content, name, saved_by, saved_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
            ).bind(crypto.randomUUID(), id, oldData.content || "", oldData.name || "", savedBy).run();
          }
        }

        await DB.prepare("UPDATE clauses SET data = ?, is_global = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(cleanBody), cleanBody.global ? 1 : 0, id).run();
        return json(cleanBody);
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM clauses WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── RULES ─────────────────────────────────────────────────────────────────
    if (resource === "rules") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT data FROM rules ORDER BY priority").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO rules (id, data, country, entity_id, priority, active) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(body.id, JSON.stringify(body), body.country || null, body.entityId || null, body.priority || 1, body.active ? 1 : 0).run();
        return json(body, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE rules SET data = ?, country = ?, entity_id = ?, priority = ?, active = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(body), body.country || null, body.entityId || null, body.priority || 1, body.active ? 1 : 0, id).run();
        return json(body);
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM rules WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── AUDIT LOG ─────────────────────────────────────────────────────────────
    if (resource === "audit") {
      if (request.method === "GET") {
        const limit      = parseInt(url.searchParams.get("limit")  || "25", 10);
        const offset     = parseInt(url.searchParams.get("offset") || "0",  10);
        const action     = url.searchParams.get("action")     || "";
        const recordType = url.searchParams.get("recordType") || "";
        const userName   = url.searchParams.get("userName")   || "";
        const fromDate   = url.searchParams.get("from")       || "";
        const toDate     = url.searchParams.get("to")         || "";

        const conds = [], filterArgs = [];
        if (action)     { conds.push("action = ?");             filterArgs.push(action); }
        if (recordType) { conds.push("record_type = ?");        filterArgs.push(recordType); }
        if (userName)   { conds.push("user_name LIKE ?");       filterArgs.push(`%${userName}%`); }
        if (fromDate)   { conds.push("timestamp >= ?");         filterArgs.push(fromDate); }
        if (toDate)     { conds.push("timestamp <= ?");         filterArgs.push(toDate + "T23:59:59"); }
        const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

        const rows = await DB.prepare(
          `SELECT id, action, record_type, record_name, user_name, detail, timestamp FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
        ).bind(...filterArgs, limit, offset).all();
        const total = await DB.prepare(`SELECT COUNT(*) AS n FROM audit_log ${where}`).bind(...filterArgs).first();
        return json({ entries: rows.results, total: total.n });
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare(
          "INSERT INTO audit_log (action, record_type, record_name, user_name, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          body.action      || "",
          body.recordType  || "",
          body.recordName  || "",
          body.userName    || "Unknown",
          body.detail      ? JSON.stringify(body.detail) : null,
          body.timestamp   || new Date().toISOString()
        ).run();
        return json({ ok: true }, 201);
      }
    }

    // ── DOCUMENT GENERATIONS ──────────────────────────────────────────────────
    if (resource === "generations") {
      if (request.method === "GET" && id) {
        const row = await DB.prepare("SELECT * FROM document_generations WHERE id = ?").bind(id).first();
        if (!row) return err("Not found", 404);
        return json({ ...row, snapshot: JSON.parse(row.snapshot) });
      }
      if (request.method === "GET") {
        const limit    = parseInt(url.searchParams.get("limit")  || "20", 10);
        const offset   = parseInt(url.searchParams.get("offset") || "0",  10);
        const search   = url.searchParams.get("search")   || "";
        const fromDate = url.searchParams.get("from")     || "";
        const toDate   = url.searchParams.get("to")       || "";

        const conds = [], filterArgs = [];
        if (search) {
          conds.push("(employee_name LIKE ? OR template_name LIKE ? OR user_name LIKE ?)");
          filterArgs.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (fromDate) { conds.push("generated_at >= ?"); filterArgs.push(fromDate); }
        if (toDate)   { conds.push("generated_at <= ?"); filterArgs.push(toDate + "T23:59:59"); }
        const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

        const rows = await DB.prepare(
          `SELECT id, template_name, employee_name, country, user_name, generated_at FROM document_generations ${where} ORDER BY generated_at DESC LIMIT ? OFFSET ?`
        ).bind(...filterArgs, limit, offset).all();
        const total = await DB.prepare(`SELECT COUNT(*) AS n FROM document_generations ${where}`).bind(...filterArgs).first();
        return json({ entries: rows.results, total: total.n });
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare(
          "INSERT INTO document_generations (id, template_name, employee_name, country, user_name, generated_at, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          body.id            || crypto.randomUUID(),
          body.templateName  || "",
          body.employeeName  || "",
          body.country       || null,
          body.userName      || "Unknown",
          body.generatedAt   || new Date().toISOString(),
          JSON.stringify(body.snapshot || {})
        ).run();
        return json({ ok: true }, 201);
      }
    }

    // ── USERS ─────────────────────────────────────────────────────────────────
    if (resource === "users") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT id, name, email, role, created_at FROM users ORDER BY name").all();
        return json(rows.results);
      }
      if (request.method === "POST") {
        const body = await request.json();
        const newId = body.id || crypto.randomUUID();
        await DB.prepare("INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)")
          .bind(newId, body.name || "", body.email || "", body.role || "Adviser").run();
        return json({ id: newId, name: body.name, email: body.email || "", role: body.role || "Adviser" }, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?")
          .bind(body.name || "", body.email || "", body.role || "Adviser", id).run();
        return json({ ok: true });
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── KNOWLEDGE BASE ────────────────────────────────────────────────────────
    if (resource === "kb") {
      // sub = "articles" | "categories" | "stats" | "next-num" | "search-miss" | "favourites" | "comments"
      const kbSub    = parts[1]; // e.g. "articles"
      const kbId     = parts[2]; // e.g. article id or category id
      const kbAction = parts[3]; // e.g. "status" | "feedback" | "related" | "versions" | "comments"
      const kbExtra  = parts[4]; // e.g. relatedId for DELETE

      // ── next article number ──
      if (kbSub === "next-num" && request.method === "GET") {
        const row = await DB.prepare("SELECT article_num FROM kb_articles ORDER BY rowid DESC LIMIT 1").first();
        let next = 1;
        if (row) {
          const m = row.article_num.match(/KB-(\d+)/);
          if (m) next = parseInt(m[1], 10) + 1;
        }
        return json({ num: `KB-${String(next).padStart(4, "0")}` });
      }

      // ── search miss logging ──
      if (kbSub === "search-miss" && request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO kb_search_misses (query, user_name, searched_at) VALUES (?, ?, datetime('now'))")
          .bind(body.query || "", body.userName || "Unknown").run();
        return json({ ok: true }, 201);
      }

      // ── export (AI / RAG friendly bulk dump) ──
      if (kbSub === "export" && request.method === "GET") {
        // Returns all published articles as clean, semantically-labelled JSON.
        // Sections are renamed to their article-type label (e.g. "Resolution" not "section3").
        // HTML tags are stripped so content is plain readable text.
        // Optional ?type= filter; optional ?updated_since=ISO8601 for incremental sync.
        const exportUrl     = new URL(request.url);
        const typeFilter    = exportUrl.searchParams.get("type")          || "";
        const updatedSince  = exportUrl.searchParams.get("updated_since") || "";
        const baseOrigin    = "https://hrscgpt.com";

        const SECTION_LABELS = {
          kcs: ["Issue", "Environment", "Resolution", "Cause"],
          qrg: ["Purpose", "Prerequisites", "Steps", "Notes"],
          sop: ["Purpose & Scope", "Roles & Responsibilities", "Procedure", "Related Documents"],
        };
        const TYPE_LABELS = {
          kcs: "KCS Article",
          qrg: "Quick Reference Guide",
          sop: "Standard Operating Procedure",
        };

        function stripHtml(html) {
          if (!html) return "";
          return html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<\/h[1-6]>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        }

        let q = "SELECT a.*, c.name as category_name FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id WHERE a.status = 'published'";
        const binds = [];
        if (typeFilter)   { q += " AND a.article_type = ?"; binds.push(typeFilter); }
        if (updatedSince) { q += " AND a.updated_at >= ?"; binds.push(updatedSince); }
        q += " ORDER BY a.article_num ASC";

        const rows = await DB.prepare(q).bind(...binds).all();
        const exportedArticles = (rows.results || []).map(a => {
          const labels = SECTION_LABELS[a.article_type] || SECTION_LABELS.kcs;
          const sections = {};
          [a.section1, a.section2, a.section3, a.section4].forEach((raw, i) => {
            const text = stripHtml(raw);
            if (text) sections[labels[i]] = text;
          });

          let countries; try { countries = JSON.parse(a.countries || '["All EMEA"]'); } catch { countries = ["All EMEA"]; }
          let tags;      try { tags      = JSON.parse(a.tags      || "[]");            } catch { tags      = []; }

          const out = {
            id:            a.id,
            article_num:   a.article_num,
            url:           `${baseOrigin}/knowledge?article=${a.id}`,
            article_type:  a.article_type,
            type_label:    TYPE_LABELS[a.article_type] || a.article_type,
            title:         a.title,
            category:      a.category_name || "",
            countries,
            tags,
            author:        a.author_name,
            reviewed_by:   a.reviewed_by || "",
            last_reviewed: a.last_reviewed_at || "",
            updated_at:    a.updated_at,
            view_count:    a.view_count || 0,
            sections,
          };
          if (a.article_type === "qrg" && a.workday_path) out.workday_path = a.workday_path;
          return out;
        });

        return new Response(JSON.stringify({
          source:      "HRSC Knowledge Base",
          description: "HRSC internal knowledge base covering EMEA HR processes, Workday guides and standard operating procedures.",
          exported_at: new Date().toISOString(),
          total:       exportedArticles.length,
          articles:    exportedArticles,
        }, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        });
      }

      // ── stats ──
      if (kbSub === "stats" && request.method === "GET") {
        const counts = await DB.prepare(
          "SELECT status, COUNT(*) as n FROM kb_articles GROUP BY status"
        ).all();
        const topViewed = await DB.prepare(
          "SELECT id, article_num, title, article_type, view_count FROM kb_articles WHERE status='published' ORDER BY view_count DESC LIMIT 5"
        ).all();
        const recent = await DB.prepare(
          "SELECT id, article_num, title, article_type, created_at FROM kb_articles WHERE status='published' ORDER BY created_at DESC LIMIT 5"
        ).all();
        const searchMisses = await DB.prepare(
          "SELECT query, COUNT(*) as n FROM kb_search_misses GROUP BY query ORDER BY n DESC LIMIT 10"
        ).all();
        const statusMap = {};
        for (const r of counts.results) statusMap[r.status] = r.n;
        return json({ counts: statusMap, topViewed: topViewed.results, recent: recent.results, searchMisses: searchMisses.results });
      }

      // ── favourites ──
      if (kbSub === "favourites") {
        if (request.method === "GET") {
          const uName = url.searchParams.get("userName") || "";
          const rows = await DB.prepare(
            "SELECT f.article_id, a.article_num, a.title, a.article_type, a.status, a.category_id, a.updated_at FROM kb_favourites f JOIN kb_articles a ON a.id = f.article_id WHERE f.user_name = ? ORDER BY f.created_at DESC"
          ).bind(uName).all();
          return json(rows.results);
        }
        if (request.method === "POST") {
          const body = await request.json();
          await DB.prepare("INSERT OR IGNORE INTO kb_favourites (article_id, user_name) VALUES (?, ?)")
            .bind(body.articleId, body.userName || "Unknown").run();
          return json({ ok: true }, 201);
        }
        // DELETE /api/kb/favourites/:articleId?userName=
        if (request.method === "DELETE" && kbId) {
          const uName = url.searchParams.get("userName") || "";
          await DB.prepare("DELETE FROM kb_favourites WHERE article_id = ? AND user_name = ?")
            .bind(kbId, uName).run();
          return json({ ok: true });
        }
      }

      // ── categories ──
      if (kbSub === "categories") {
        if (request.method === "GET") {
          // Include article counts
          const rows = await DB.prepare(
            "SELECT c.*, (SELECT COUNT(*) FROM kb_articles a WHERE a.category_id = c.id AND a.status = 'published') AS article_count FROM kb_categories c ORDER BY c.sort_order"
          ).all();
          return json(rows.results);
        }
        if (request.method === "POST") {
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          await DB.prepare("INSERT INTO kb_categories (id, name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(newId, body.name || "", body.description || "", body.color || "#00A28A", body.icon || "", body.sortOrder || 0).run();
          return json({ id: newId, ...body }, 201);
        }
        if (request.method === "PUT" && kbId) {
          const body = await request.json();
          await DB.prepare("UPDATE kb_categories SET name = ?, description = ?, color = ?, icon = ?, sort_order = ? WHERE id = ?")
            .bind(body.name || "", body.description || "", body.color || "#00A28A", body.icon || "", body.sortOrder || 0, kbId).run();
          return json({ ok: true });
        }
        if (request.method === "DELETE" && kbId) {
          await DB.prepare("DELETE FROM kb_categories WHERE id = ?").bind(kbId).run();
          return json({ ok: true });
        }
      }

      // ── countries ──
      if (kbSub === "countries") {
        if (request.method === "GET") {
          const rows = await DB.prepare("SELECT * FROM kb_countries ORDER BY sort_order, name").all();
          return json(rows.results);
        }
        if (request.method === "POST") {
          const body = await request.json();
          if (!body.name?.trim()) return json({ error: "name required" }, 400);
          const maxRow = await DB.prepare("SELECT MAX(sort_order) as m FROM kb_countries").first();
          const nextOrder = (maxRow?.m || 0) + 1;
          const result = await DB.prepare("INSERT INTO kb_countries (name, sort_order) VALUES (?, ?)")
            .bind(body.name.trim(), body.sortOrder ?? nextOrder).run();
          return json({ id: result.meta.last_row_id, name: body.name.trim() }, 201);
        }
        if (request.method === "PUT" && kbId) {
          const body = await request.json();
          await DB.prepare("UPDATE kb_countries SET name = ?, sort_order = ? WHERE id = ?")
            .bind(body.name?.trim() || "", body.sortOrder ?? 0, kbId).run();
          return json({ ok: true });
        }
        if (request.method === "DELETE" && kbId) {
          await DB.prepare("DELETE FROM kb_countries WHERE id = ?").bind(kbId).run();
          return json({ ok: true });
        }
      }

      // ── resolve/unresolve a comment ──
      if (kbSub === "comments" && kbId && request.method === "PUT") {
        const body = await request.json();
        await DB.prepare("UPDATE kb_comments SET resolved = ? WHERE id = ?")
          .bind(body.resolved ? 1 : 0, kbId).run();
        return json({ ok: true });
      }

      // ── articles ──
      if (kbSub === "articles") {

        // ── sub-actions on a specific article ──
        if (kbId && kbAction) {
          // GET /api/kb/articles/:id/related
          if (kbAction === "related" && request.method === "GET") {
            const rows = await DB.prepare(
              "SELECT a.id, a.article_num, a.title, a.article_type, a.status, a.category_id FROM kb_articles a JOIN kb_related r ON a.id = r.related_id WHERE r.article_id = ?"
            ).bind(kbId).all();
            return json(rows.results);
          }
          // POST /api/kb/articles/:id/related
          if (kbAction === "related" && request.method === "POST") {
            const body = await request.json();
            const relId = body.relatedId;
            if (!relId || relId === kbId) return err("Invalid relatedId");
            await DB.prepare("INSERT OR IGNORE INTO kb_related (article_id, related_id) VALUES (?, ?)")
              .bind(kbId, relId).run();
            await DB.prepare("INSERT OR IGNORE INTO kb_related (article_id, related_id) VALUES (?, ?)")
              .bind(relId, kbId).run();
            return json({ ok: true }, 201);
          }
          // DELETE /api/kb/articles/:id/related/:relatedId
          if (kbAction === "related" && request.method === "DELETE" && kbExtra) {
            await DB.prepare("DELETE FROM kb_related WHERE (article_id = ? AND related_id = ?) OR (article_id = ? AND related_id = ?)")
              .bind(kbId, kbExtra, kbExtra, kbId).run();
            return json({ ok: true });
          }
          // GET /api/kb/articles/:id/versions
          if (kbAction === "versions" && request.method === "GET") {
            const rows = await DB.prepare(
              "SELECT id, article_id, saved_by, saved_at, substr(snapshot,1,300) AS preview FROM kb_versions WHERE article_id = ? ORDER BY saved_at DESC LIMIT 20"
            ).bind(kbId).all();
            return json(rows.results);
          }
          // GET /api/kb/articles/:id/comments
          if (kbAction === "comments" && request.method === "GET") {
            const rows = await DB.prepare(
              "SELECT * FROM kb_comments WHERE article_id = ? ORDER BY created_at ASC"
            ).bind(kbId).all();
            return json(rows.results);
          }
          // POST /api/kb/articles/:id/comments
          if (kbAction === "comments" && request.method === "POST") {
            const body = await request.json();
            await DB.prepare("INSERT INTO kb_comments (article_id, author_name, comment) VALUES (?, ?, ?)")
              .bind(kbId, body.authorName || "Unknown", body.comment || "").run();
            return json({ ok: true }, 201);
          }
          // POST /api/kb/articles/:id/feedback
          if (kbAction === "feedback" && request.method === "POST") {
            const body = await request.json();
            await DB.prepare("INSERT INTO kb_feedback (article_id, helpful, comment, user_name) VALUES (?, ?, ?, ?)")
              .bind(kbId, body.helpful ? 1 : 0, body.comment || "", body.userName || "Unknown").run();
            if (body.helpful) {
              await DB.prepare("UPDATE kb_articles SET helpful_yes = helpful_yes + 1 WHERE id = ?").bind(kbId).run();
            } else {
              await DB.prepare("UPDATE kb_articles SET helpful_no = helpful_no + 1 WHERE id = ?").bind(kbId).run();
            }
            return json({ ok: true }, 201);
          }
          // POST /api/kb/articles/:id/status
          if (kbAction === "status" && request.method === "POST") {
            const body = await request.json();
            const newStatus = body.status;
            const allowed = ["draft", "review", "published", "archived"];
            if (!allowed.includes(newStatus)) return err("Invalid status");
            const updates = { status: newStatus };
            if (newStatus === "published") {
              updates.reviewedBy = body.reviewedBy || "";
              updates.lastReviewedAt = new Date().toISOString();
              await DB.prepare("UPDATE kb_articles SET status = ?, reviewed_by = ?, last_reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
                .bind(newStatus, updates.reviewedBy, kbId).run();
            } else {
              await DB.prepare("UPDATE kb_articles SET status = ?, updated_at = datetime('now') WHERE id = ?")
                .bind(newStatus, kbId).run();
            }
            return json({ ok: true });
          }
        }

        // ── GET /api/kb/articles/:id (single article) ──
        if (request.method === "GET" && kbId && !kbAction) {
          const row = await DB.prepare("SELECT * FROM kb_articles WHERE id = ?").bind(kbId).first();
          if (!row) return err("Not found", 404);
          await DB.prepare("UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?").bind(kbId).run();
          return json(row);
        }

        // ── GET /api/kb/articles (list) ──
        if (request.method === "GET" && !kbId) {
          const limit    = parseInt(url.searchParams.get("limit")  || "20", 10);
          const offset   = parseInt(url.searchParams.get("offset") || "0",  10);
          const search   = url.searchParams.get("search")   || "";
          const status   = url.searchParams.get("status")   || "";
          const category = url.searchParams.get("category") || "";
          const country  = url.searchParams.get("country")  || "";
          const type     = url.searchParams.get("type")     || "";
          const role     = url.searchParams.get("role")     || "";
          const userName = url.searchParams.get("userName") || "";

          const conds = [], args = [];
          // Non-admins only see published (or their own drafts)
          if (role !== "Admin") {
            conds.push("(status = 'published' OR author_name = ?)");
            args.push(userName || "__nobody__");
          }
          if (status)   { conds.push("status = ?");         args.push(status); }
          if (category) { conds.push("category_id = ?");    args.push(category); }
          if (type)     { conds.push("article_type = ?");   args.push(type); }
          if (country)  { conds.push("countries LIKE ?");   args.push(`%${country}%`); }
          if (search) {
            conds.push("(title LIKE ? OR section1 LIKE ? OR section2 LIKE ? OR section3 LIKE ? OR section4 LIKE ? OR tags LIKE ?)");
            const s = `%${search}%`;
            args.push(s, s, s, s, s, s);
          }
          const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
          const rows = await DB.prepare(
            `SELECT id, article_num, article_type, title, section1, category_id, countries, tags, status, author_name, view_count, helpful_yes, helpful_no, workday_path, created_at, updated_at FROM kb_articles ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
          ).bind(...args, limit, offset).all();
          const total = await DB.prepare(`SELECT COUNT(*) AS n FROM kb_articles ${where}`).bind(...args).first();
          return json({ articles: rows.results, total: total.n });
        }

        // ── POST /api/kb/articles ──
        if (request.method === "POST" && !kbId) {
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          await DB.prepare(
            "INSERT INTO kb_articles (id, article_num, article_type, title, section1, section2, section3, section4, workday_path, category_id, countries, tags, status, author_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            newId,
            body.articleNum || "KB-0001",
            body.articleType || "kcs",
            body.title || "",
            body.section1 || "",
            body.section2 || "",
            body.section3 || "",
            body.section4 || "",
            body.workdayPath || "",
            body.categoryId || "",
            JSON.stringify(body.countries || ["All EMEA"]),
            JSON.stringify(body.tags || []),
            body.status || "draft",
            body.authorName || "Unknown"
          ).run();
          return json({ id: newId, ...body }, 201);
        }

        // ── PUT /api/kb/articles/:id ──
        if (request.method === "PUT" && kbId && !kbAction) {
          const body = await request.json();
          const savedBy = body._savedBy || "Unknown";
          const { _savedBy: _, ...clean } = body;

          // Snapshot previous version if content changed
          const old = await DB.prepare("SELECT * FROM kb_articles WHERE id = ?").bind(kbId).first();
          if (old) {
            const contentChanged =
              old.section1 !== (clean.section1 || "") ||
              old.section2 !== (clean.section2 || "") ||
              old.section3 !== (clean.section3 || "") ||
              old.section4 !== (clean.section4 || "");
            if (contentChanged) {
              await DB.prepare("INSERT INTO kb_versions (id, article_id, snapshot, saved_by) VALUES (?, ?, ?, ?)")
                .bind(crypto.randomUUID(), kbId, JSON.stringify(old), savedBy).run();
            }
          }

          await DB.prepare(
            "UPDATE kb_articles SET article_type=?, title=?, section1=?, section2=?, section3=?, section4=?, workday_path=?, category_id=?, countries=?, tags=?, updated_at=datetime('now') WHERE id=?"
          ).bind(
            clean.articleType || "kcs",
            clean.title || "",
            clean.section1 || "",
            clean.section2 || "",
            clean.section3 || "",
            clean.section4 || "",
            clean.workdayPath || "",
            clean.categoryId || "",
            JSON.stringify(clean.countries || ["All EMEA"]),
            JSON.stringify(clean.tags || []),
            kbId
          ).run();
          return json({ ok: true });
        }

        // ── DELETE /api/kb/articles/:id ──
        if (request.method === "DELETE" && kbId && !kbAction) {
          await DB.prepare("DELETE FROM kb_articles WHERE id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_related WHERE article_id = ? OR related_id = ?").bind(kbId, kbId).run();
          await DB.prepare("DELETE FROM kb_versions WHERE article_id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_comments WHERE article_id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_favourites WHERE article_id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_feedback WHERE article_id = ?").bind(kbId).run();
          return json({ ok: true });
        }
      }
    }

    // ── IDENTITY (Cloudflare Access) ──────────────────────────────────────────
    if (resource === "me") {
      if (request.method === "GET") {
        const email = request.headers.get("Cf-Access-Authenticated-User-Email") || "";
        const name  = email
          ? email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          : "";
        return json({ email, name });
      }
    }

    // ── LAW MONITOR ──────────────────────────────────────────────────────────
    if (resource === "law-monitor") {
      const lmSection = parts[1]; // changes | sources | scan
      const lmId      = parts[2]; // change id or source id
      const lmAction  = parts[3]; // read | unread | star | unstar

      // GET /api/law-monitor/scan/status
      if (lmSection === "scan" && lmId === "status" && request.method === "GET") {
        const [last, total, unread, active] = await Promise.all([
          DB.prepare("SELECT MAX(detected_at) as ts FROM law_changes").first(),
          DB.prepare("SELECT COUNT(*) as n FROM law_changes").first(),
          DB.prepare("SELECT COUNT(*) as n FROM law_changes WHERE is_read = 0").first(),
          DB.prepare("SELECT COUNT(*) as n FROM law_sources WHERE active = 1").first(),
        ]);
        return json({
          last_scan:      last?.ts || null,
          total_changes:  total?.n || 0,
          unread_count:   unread?.n || 0,
          sources_active: active?.n || 0,
        });
      }

      // POST /api/law-monitor/scan
      if (lmSection === "scan" && request.method === "POST") {
        const result = await runLawMonitorScan(DB);
        return json(result);
      }

      // GET /api/law-monitor/sources
      if (lmSection === "sources" && request.method === "GET") {
        const rows = await DB.prepare(
          "SELECT * FROM law_sources ORDER BY region, country, name"
        ).all();
        return json({ sources: rows.results || [] });
      }

      // PUT /api/law-monitor/sources/:id  (toggle active)
      if (lmSection === "sources" && lmId && request.method === "PUT") {
        const body = await request.json();
        await DB.prepare("UPDATE law_sources SET active = ? WHERE id = ?")
          .bind(body.active ? 1 : 0, lmId).run();
        return json({ ok: true });
      }

      // GET /api/law-monitor/changes
      if (lmSection === "changes" && !lmId && request.method === "GET") {
        const qp      = url.searchParams;
        const region   = qp.get("region")   || "";
        const country  = qp.get("country")  || "";
        const category = qp.get("category") || "";
        const search   = qp.get("search")   || "";
        const limit    = Math.min(parseInt(qp.get("limit") || "500"), 1000);

        let q = `
          SELECT lc.*, ls.name AS source_name, ls.country, ls.region, ls.feed_type
          FROM law_changes lc
          JOIN law_sources ls ON lc.source_id = ls.id
          WHERE 1=1`;
        const binds = [];
        if (region)   { q += " AND ls.region = ?";   binds.push(region); }
        if (country)  { q += " AND ls.country = ?";  binds.push(country); }
        if (category) { q += " AND lc.category = ?"; binds.push(category); }
        if (search)   { q += " AND (lc.title LIKE ? OR lc.summary LIKE ?)"; binds.push(`%${search}%`, `%${search}%`); }
        q += " ORDER BY lc.detected_at DESC LIMIT ?";
        binds.push(limit);

        const rows = await DB.prepare(q).bind(...binds).all();
        return json({ changes: rows.results || [] });
      }

      // POST /api/law-monitor/changes/mark-all-read
      if (lmSection === "changes" && lmId === "mark-all-read" && request.method === "POST") {
        await DB.prepare("UPDATE law_changes SET is_read = 1").run();
        return json({ ok: true });
      }

      // PUT /api/law-monitor/changes/:id/:action
      if (lmSection === "changes" && lmId && lmAction && request.method === "PUT") {
        if (lmAction === "read")   { await DB.prepare("UPDATE law_changes SET is_read = 1 WHERE id = ?").bind(lmId).run(); }
        if (lmAction === "unread") { await DB.prepare("UPDATE law_changes SET is_read = 0 WHERE id = ?").bind(lmId).run(); }
        if (lmAction === "star")   { await DB.prepare("UPDATE law_changes SET is_starred = 1 WHERE id = ?").bind(lmId).run(); }
        if (lmAction === "unstar") { await DB.prepare("UPDATE law_changes SET is_starred = 0 WHERE id = ?").bind(lmId).run(); }
        return json({ ok: true });
      }

      // DELETE /api/law-monitor/changes/:id
      if (lmSection === "changes" && lmId && !lmAction && request.method === "DELETE") {
        await DB.prepare("DELETE FROM law_changes WHERE id = ?").bind(lmId).run();
        return json({ ok: true });
      }
    }

    return err("Not found", 404);
  } catch (e) {
    console.error(e);
    return err("Internal server error: " + e.message, 500);
  }
}
