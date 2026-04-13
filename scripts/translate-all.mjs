/**
 * Bulk translate all non-English jobs to English using MyMemory.
 * Forces de→en for jobs detected as German.
 * Run: node scripts/translate-all.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local ──────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const envLines = readFileSync(envPath, "utf8").split(/\r?\n/);
for (const line of envLines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing env vars"); process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────
const MYMEMORY = "https://api.mymemory.translated.net/get";
const DELAY = 400; // ms between API calls

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// German common words used in job titles
const GERMAN_WORDS = /\b(und|oder|für|mit|von|zur|zum|der|die|das|des|dem|den|ein|eine|einer|eines|einem|einen|ist|sind|wird|werden|werden|haben|hat|bei|nach|aus|auf|an|als|auch|noch|aber|wenn|dass|wir|sie|ich|er|ihr|uns|ihm|ihn|ihm|leiter|mitarbeiter|fach|kaufmann|kauffrau|kaufmännisch|werkstudent|praktikant|assistent|berater|betreuer|manager|entwickler|projektmanager|teamleiter|abteilungsleiter|geschäftsführer|vertrieb|finanzen|buchhaltung|steuer|recht|marketing|verwaltung|bereich|stelle|aufgabe|position|gesucht|vollzeit|teilzeit|homeoffice|remote)\b/i;

// Diacritics specific to European languages
const DIACRITICS = /[äöüßàáâãåèéêëìíîïòóôõùúûüýÿñçğşøœæ]/i;

function needsTranslation(text) {
    if (!text) return false;
    const t = text.trim();
    // Has diacritics
    if (DIACRITICS.test(t)) return true;
    // Has common German words
    if (GERMAN_WORDS.test(t)) return true;
    // Non-Latin characters (Arabic, Cyrillic, etc.)
    for (const c of t) {
        const code = c.codePointAt(0);
        if (code > 0x024f && code < 0x1e00) return true; // Beyond extended Latin
        if (code >= 0x0400) return true; // Cyrillic and beyond
    }
    return false;
}

// Detect likely German text
function detectLang(text) {
    if (!text) return "auto";
    if (DIACRITICS.test(text) || GERMAN_WORDS.test(text)) return "de";
    return "auto";
}

const JUNK = [
    /auto.*invalid.*source/i,
    /invalid.*langpair/i,
    /example:.*langpair/i,
    /please.*provide/i,
];
function isJunk(t) {
    return !t || JUNK.some((p) => p.test(t));
}

async function translate(text, forceLang) {
    const trimmed = (text || "").trim().slice(0, 480);
    if (!trimmed) return text;

    const lang = forceLang || detectLang(trimmed);
    const langpair = lang === "auto" ? "auto|en" : `${lang}|en`;

    try {
        const url = new URL(MYMEMORY);
        url.searchParams.set("q", trimmed);
        url.searchParams.set("langpair", langpair);
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
        if (!res.ok) return text;
        const data = await res.json();
        if (data.quotaFinished) return "___QUOTA___";
        const t = data.responseData?.translatedText?.trim();
        if (isJunk(t)) return text; // keep original
        if (!t || t === trimmed) return text; // no change
        return t;
    } catch {
        return text;
    }
}

// ── Main ─────────────────────────────────────────────────────────
const BATCH = 30;
let offset = 0;
let totalProcessed = 0;
let totalUpdated = 0;
let quota = false;

console.log("🌍 Bulk translating non-English jobs to English…\n");
const { count: total } = await supabase.from("jobs").select("id", { count: "exact", head: true });
console.log(`📊 Total jobs in DB: ${total}\n`);

while (offset < total && !quota) {
    const { data: jobs, error } = await supabase
        .from("jobs")
        .select("id, title, company, location, description")
        .order("created_at", { ascending: false })
        .range(offset, offset + BATCH - 1);

    if (error) { console.error("DB error:", error.message); break; }
    if (!jobs?.length) break;

    const toTranslate = jobs.filter(
        (j) => needsTranslation(j.title) || needsTranslation(j.company) ||
            needsTranslation(j.location) || needsTranslation(j.description)
    );

    console.log(`Batch ${offset}–${offset + jobs.length - 1}: ${toTranslate.length}/${jobs.length} need translation`);

    for (const job of toTranslate) {
        if (quota) break;
        const updates = {};
        let changed = false;

        const fields = [
            { key: "title", val: job.title },
            { key: "company", val: job.company },
            { key: "location", val: job.location },
            { key: "description", val: job.description },
        ];

        for (const { key, val } of fields) {
            if (!needsTranslation(val)) continue;
            const t = await translate(val);
            await sleep(DELAY);
            if (t === "___QUOTA___") { quota = true; break; }
            if (t && t !== val && !isJunk(t)) {
                updates[key] = t;
                changed = true;
            }
        }

        if (quota) break;

        if (changed) {
            const { error: err } = await supabase.from("jobs").update(updates).eq("id", job.id);
            if (err) {
                console.error(`  ❌ ${job.id.slice(0, 8)}: ${err.message}`);
            } else {
                totalUpdated++;
                const before = (job.title || "").slice(0, 45);
                const after = (updates.title || job.title || "").slice(0, 45);
                if (updates.title && before !== after) {
                    console.log(`  ✅ "${before}" → "${after}"`);
                } else {
                    console.log(`  ✅ #${job.id.slice(0, 8)} updated (location/desc/company)`);
                }
            }
        }
        totalProcessed++;
    }

    offset += jobs.length;
    const pct = Math.round((Math.min(offset, total) / total) * 100);
    console.log(`  ↳ ${Math.min(offset, total)}/${total} (${pct}%) scanned, ${totalUpdated} updated\n`);
}

if (quota) {
    console.log("\n⚠  MyMemory free quota exhausted. Run again tomorrow to continue.");
} else {
    console.log("\n🎉 All done!");
}
console.log(`   Processed : ${totalProcessed}`);
console.log(`   Updated   : ${totalUpdated}`);
