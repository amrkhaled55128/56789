import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Loads `.env` from the project root before any other module reads process.env.
// This file must be imported first (see server/index.ts) because ES module
// imports are evaluated in declaration order, and server/db.ts reads
// DATABASE_PATH while it is being loaded.
const envPath = resolve(process.env.ENV_FILE ?? '.env');

if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.warn(`تعذر قراءة ملف الإعدادات ${envPath}:`, error instanceof Error ? error.message : error);
  }
}

export const clinicName = process.env.CLINIC_NAME ?? 'عيادة أليف البيطرية';
export const sessionHours = Math.max(1, Number(process.env.SESSION_HOURS ?? 12) || 12);
