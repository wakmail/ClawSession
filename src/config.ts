import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ScheduleEntry {
  time: string;
  message: string;
  model?: string;
}

export interface Config {
  model: string;
  title: string;
  schedule: ScheduleEntry[];
}

export function getConfigPath(): string {
  return resolve(__dirname, "..", "config.json");
}

export function loadConfig(): Config {
  const raw = readFileSync(getConfigPath(), "utf-8");
  return JSON.parse(raw);
}

export function saveConfig(config: Config): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}

export function getCredentials(): { cookie: string; orgId: string } {
  loadEnv();
  const cookie = process.env.CLAUDE_COOKIE;
  const orgId = process.env.ORG_ID;
  if (!cookie || !orgId) {
    console.error("Error: Set CLAUDE_COOKIE and ORG_ID in your .env file first.");
    process.exit(1);
  }
  return { cookie, orgId };
}
