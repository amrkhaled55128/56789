import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restoreKvFromDb, saveAllKvToDb } from './postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isCloud = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.CRANL || process.env.NODE_ENV === 'production';
const DATA_DIR = isCloud
  ? join(__dirname, '..', 'session', 'data')
  : join(__dirname, '..', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const saveTimers = new Map();

class DB {
  constructor(fileName) {
    this.file = join(DATA_DIR, fileName);
    this.backup = join(DATA_DIR, fileName.replace(/\.json$/, '') + '.lastgood.json');
    this.data = this.#read();
    this.#lastJson = JSON.stringify(this.data, null, 2);
    this.#initCloudSync();
  }

  #lastJson;

  async #initCloudSync() {
    try {
      const kv = await restoreKvFromDb();
      if (kv && typeof kv === 'object' && Object.keys(kv).length) {
        this.data = { ...this.data, ...kv };
        this.#lastJson = JSON.stringify(this.data, null, 2);
      }
    } catch (err) {
      console.warn('⚠️ تعذر مزامنة بيانات البوت من PostgreSQL:', err.message);
    }
  }

  #quarantineIfPresent(file) {
    try {
      if (!fs.existsSync(file)) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(file, `${file}.corrupt-${stamp}`);
      console.error(`🧊 تم عزل الملف التالف للتشخيص: ${file}.corrupt-${stamp}`);
    } catch {
    }
  }

  #read() {
    for (const file of [this.file, this.backup]) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (file !== this.file) {
            console.log(`⚠️ الملف الرئيسي تالف — رجعنا من النسخة: ${file}`);
          }
          return parsed;
        }
        console.error(`⚠️ محتوى ${file} مش شكل قاعدة بيانات — بنطمن منه`);
        this.#quarantineIfPresent(file);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`⚠️ تعذّر قراءة ${file}:`, err.message?.slice(0, 80));
          this.#quarantineIfPresent(file);
        }
      }
    }
    return {};
  }

  get(key, fallback) {
    return this.data[key] ?? fallback;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  save() {
    clearTimeout(saveTimers.get(this.file));
    saveTimers.set(
      this.file,
      setTimeout(() => this.#write(), 250),
    );
  }

  #write() {
    saveTimers.delete(this.file);
    const json = JSON.stringify(this.data, null, 2);
    if (json === this.#lastJson) return;

    const tmp = `${this.file}.tmp`;
    try {
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeSync(fd, json);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      try {
        if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.backup);
      } catch {
      }
      fs.renameSync(tmp, this.file);
      this.#lastJson = json;
      saveAllKvToDb(this.data);
    } catch (err) {
      console.error('❌ فشل حفظ قاعدة البيانات:', err.message?.slice(0, 100));
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
      }
    }
  }

  flush() {
    saveAllKvToDb(this.data);
    const timer = saveTimers.get(this.file);
    if (timer) {
      clearTimeout(timer);
      this.#write();
      return true;
    }
    if (JSON.stringify(this.data, null, 2) !== this.#lastJson) {
      this.#write();
      return true;
    }
    return false;
  }
}

export const db = new DB('db.json');
