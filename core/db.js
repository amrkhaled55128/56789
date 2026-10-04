import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ☁️ على Railway بيكون في volume واحد على /app/session — فبنخزن البيانات جواه
// عشان مايفقدش أي حاجة بعد إعادة النشر. محليًا بيفضل مجلد data منفصل.
const isCloud = !!process.env.RAILWAY_ENVIRONMENT;
const DATA_DIR = isCloud
  ? join(__dirname, '..', 'session', 'data')
  : join(__dirname, '..', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const saveTimers = new Map();

// قاعدة بيانات بسيطة بصيغة JSON (حفظ مؤجل عشان ميسبقش الأوامر)
// لما المشروع يكبر نقدر نرقّيها لـ SQLite من غير ما نغير واجهة الاستخدام
class DB {
  constructor(fileName) {
    this.file = join(DATA_DIR, fileName);
    this.backup = join(DATA_DIR, fileName.replace(/\.json$/, '') + '.lastgood.json');
    this.data = this.#read();
  }

  #read() {
    // ⚠️ كان بيرجع {} عند أي فشل — فملف مقطوع (redeploy أثناء الكتابة) كان
    // بيمسح كل الذاكرة والاقتصاد بصمت من غير أي لوج. دلوقتي بنحاول ملف
    // النسخة الصح قبل ما نستسلم.
    for (const file of [this.file, this.backup]) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (file !== this.file) {
          console.log(`⚠️ الملف الرئيسي تالف — رجعنا من النسخة: ${file}`);
        }
        return parsed;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`⚠️ تعذّر قراءة ${file}:`, err.message?.slice(0, 80));
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

  // ⚠️ الكتابة لازم تكون atomic: نكتب في ملف مؤقت وبعدين نعمل rename.
  // writeFileSync بيفتح الملف بـ O_TRUNC — فـ SIGKILL من Railway في نص الكتابة
  // كان بيسيب الملف مقطوع، والقراءة الجاية بتلاقي JSON.parse فاشل.
  #write() {
    saveTimers.delete(this.file);
    const tmp = `${this.file}.tmp`;
    try {
      const json = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tmp, json);
      // نحتفظ بالنسخة الصح قبل ما نستبدل
      try {
        if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.backup);
      } catch {
        // النسخة الاحتياطية رفاهية — لو فشلت هنكمل
      }
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('❌ فشل حفظ قاعدة البيانات:', err.message?.slice(0, 100));
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        // مفيش حاجة نعملها
      }
    }
  }

  // ⚠️ كان مفيش flush — آخر 250ms قبل إعادة النشر كانت بتضيع.
  // بناديه من index.js عند SIGTERM/SIGINT.
  flush() {
    const timer = saveTimers.get(this.file);
    if (timer) {
      clearTimeout(timer);
      this.#write();
      return true;
    }
    return false;
  }
}

export const db = new DB('db.json');
