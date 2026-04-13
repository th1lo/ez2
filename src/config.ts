import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { z } from 'zod';

export const CONFIG_DIR = join(homedir(), '.config', 'ez2');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
export const MODELS_DIR = join(CONFIG_DIR, 'models');

const MicSchema = z.object({
  name: z.string(),
  deviceId: z.number(),
});

const ConfigSchema = z.object({
  mic: MicSchema,
  model: z.string(),
  language: z.string().optional(),
  outputDir: z.string().optional(),
});

export type Mic = z.infer<typeof MicSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/** Returns parsed config, or null if missing / unreadable / invalid schema. Never throws. */
export function readConfig(): Config | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return ConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

/** Writes config atomically (write tmp → rename). Creates directory if needed. */
export function writeConfig(config: Config): void {
  ensureConfigDir();
  const tmp = CONFIG_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
  renameSync(tmp, CONFIG_PATH);
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(MODELS_DIR)) {
    mkdirSync(MODELS_DIR, { recursive: true });
  }
}
