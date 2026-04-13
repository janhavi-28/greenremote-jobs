import { spawn } from "node:child_process";
import path from "node:path";

export interface ScraperRunResult {
  ok: boolean;
  total: number;
  inserted: number;
  matched: number;
  modified: number;
  snapshot_file?: string | null;
  source_files?: Record<string, string>;
  dry_run?: boolean;
  error?: string;
  jobs?: Array<{
    title: string;
    company: string;
    location: string;
    apply_url: string;
    category?: string | null;
    description?: string | null;
    publication_date?: string | null;
    experience_level?: string | null;
    salary?: string | null;
    source?: string | null;
    tags?: string[] | null;
  }>;
  scrapers: Array<{
    name: string;
    script: string;
    success: boolean;
    returncode: number;
    stdout?: string;
    stderr?: string;
  }>;
}

export async function runJobsScraper(scope = "all"): Promise<ScraperRunResult> {
  const scriptPath = path.join(process.cwd(), "Jobs_Scraper", "all.py");
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || "python";

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [scriptPath, "--scope", scope], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Scraper exited with code ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as ScraperRunResult;
        if (!parsed.ok) {
          reject(new Error(parsed.error || "Jobs_Scraper pipeline failed"));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse scraper output: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    });
  });
}
