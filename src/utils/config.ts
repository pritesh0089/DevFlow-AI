import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';


type Cfg = { STORYBLOK_TOKEN?: string; FIGMA_TOKEN?: string; OPENAI_API_KEY?: string };
const dir = path.join(os.homedir(), '.config', 'devflow-ai');
const file = path.join(dir, 'config.json');


export function loadConfig(): Cfg {
try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
export function saveConfig(patch: Partial<Cfg>) {
fs.mkdirSync(dir, { recursive: true });
const cur = loadConfig();
const next = { ...cur, ...patch };
fs.writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 });
}