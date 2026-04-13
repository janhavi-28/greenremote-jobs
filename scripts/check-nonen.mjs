import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines = readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/);
for (const l of envLines) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from("jobs").select("id,title,company,location").order("created_at", { ascending: false }).limit(300);

const nonEng = (data || []).filter(j => {
    const check = (t) => t && /[äöüßàáâãèéêëìíîïòóôõùúûüýÿñçğşøœæ]/i.test(t);
    return check(j.title) || check(j.company) || check(j.location);
});

console.log(`Non-English jobs in first 300: ${nonEng.length}`);
nonEng.slice(0, 15).forEach(j => console.log(`  Title: "${j.title}"\n  Loc: "${j.location}"\n`));
