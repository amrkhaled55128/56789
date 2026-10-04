import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { cleanIdentityMap } from './identity.js';
import { mergeDuplicateProfiles } from './memory.js';

// 🧹 نظام الصيانة الدوري — تنظيف + نسخ احتياطي

const __dirname = dirname(fileURLToPath(import.meta.url));

// نفس منطق db.js — على السحابة جوّه الـ volume
const isCloud = !!process.env.RAILWAY_ENVIRONMENT;
const DATA_DIR = isCloud ? join(__dirname, '..', 'session', 'data') : join(__dirname, '..', 'data');
const BACKUP_DIR = join(DATA_DIR, 'backups');

// مسح المفاتيح الفاضية القديمة (بقايا عيب الهوية القديم)
function purgeLegacyKeys() {
  const collections = ['rps', 'xo', 'quiz', 'users', 'aiState', 'searchCache', 'td', 'hang', 'math', 'mathStats', 'hangStats', 'groupSettings', 'botOff'];
  let removed = 0;
  for (const col of collections) {
    const all = db.get(col, {});
    if (typeof all !== 'object' || all === null) continue;
    // ⚠️ العدّاد كان بره اللوب فكان بينتسب للأول بس، وكمان `db.get` بيرجّع
    // نفس المرجع بالظبط فمقارنة الأطوال كانت دايمًا متساوية و db.set
    // مكانش بينادى أصلاً — يعني الحذف كان بيشتغل في الذاكرة بس.
    let removedHere = 0;
    for (const k of Object.keys(all)) {
      if (k === '' || (k.includes('@g.us') && col !== 'groupSettings' && col !== 'td' && col !== 'aiState')) {
        delete all[k];
        removedHere++;
      }
    }
    if (removedHere) {
      db.set(col, all);
      removed += removedHere;
    }
  }
  return removed;
}

// 🚫 تنظيف الردود الخايبة/المكرّرة من ذاكرة الناس (كانت بتخلي البوت يقلّد "يا ستي" طول الوقت)
const BAD_REPLY = /(?:يا ستي|يا عيون استرو|مجرد نموذج|لا أستطيع|لا يمكنني|لم أتمكن|تعذّر)/;

function purgeBadReplies() {
  const users = db.get('users', {});
  let cleaned = 0;
  for (const p of Object.values(users)) {
    if (!p?.lastMessages?.length) continue;
    const before = p.lastMessages.length;
    const kept = p.lastMessages
      .filter((msg) => msg.role !== 'bot' || (msg.text && !BAD_REPLY.test(msg.text)))
      .slice(-8); // تنظيف كاش الردود + قص لآخر 8
    if (kept.length !== before) {
      p.lastMessages = kept;
      cleaned += before - kept.length;
    }
  }
  if (cleaned) {
    db.set('users', users);
    const caches = db.get('replyCache', {});
    for (const c of Object.values(caches)) {
      for (const [k, v] of Object.entries(c)) {
        if (v?.reply && BAD_REPLY.test(v.reply)) delete c[k];
      }
    }
    db.set('replyCache', caches);
  }
  return cleaned;
}

// 🕹️ الألعاب المعلقة — دي اللي مالها TTL بتاعها، فكانت بتفضل شغالة بعد
// ريستارت البوت (maintenance بيشتغل بعد الإقلاع) وبتقفل الجروب للأبد.
// بنمسح أي لعبة older من TTL بتاعها + أي حاجة مالها وقت أساسًا.
function purgeStaleGames() {
  const HOUR = 3600000;
  const rules = [
    { col: 'race', ttl: 2 * 60 * 1000, usesAt: true },
    { col: 'duels', ttl: HOUR, usesAt: true },
    { col: 'guess', ttl: HOUR, usesAt: true },
    { col: 'guessWho', ttl: HOUR, usesAt: true },
    { col: 'hang', ttl: HOUR, usesAt: true },
    { col: 'rps', ttl: HOUR, usesAt: true },
    { col: 'xo', ttl: HOUR, usesAt: true },
    { col: 'td', ttl: 2 * HOUR },
    { col: 'math', ttl: 5 * 60 * 1000, usesAt: true },
    { col: 'quiz', ttl: HOUR, usesAt: true },
  ];
  let removed = 0;
  for (const { col, ttl, usesAt } of rules) {
    const all = db.get(col, {});
    if (typeof all !== 'object' || all === null) continue;
    let n = 0;
    for (const [k, v] of Object.entries(all)) {
      const age = usesAt && v?.at ? Date.now() - v.at : Infinity;
      if (age > ttl) {
        delete all[k];
        n++;
      }
    }
    if (n) {
      db.set(col, all);
      removed += n;
    }
  }

  // التذكيرات اللي فات موعدها وماتشتغلتش (بسبب بوت مقفول) — ما بتتراكمش
  const sched = db.get('scheduled', {});
  let staleJobs = 0;
  for (const [user, jobs] of Object.entries(sched)) {
    if (!jobs || typeof jobs !== 'object') continue;
    for (const [id, job] of Object.entries(jobs)) {
      if (job?.done || (job?.at && job.at < Date.now() - 6 * HOUR)) {
        delete jobs[id];
        staleJobs++;
      }
    }
    if (!Object.keys(jobs).length) delete sched[user];
  }
  if (staleJobs) db.set('scheduled', sched);

  return removed + staleJobs;
}

// مسح كاش البحث الأقدم من 10 دقايق
function purgeExpiredCache() {
  const all = db.get('searchCache', {});
  let removed = 0;
  for (const [jid, entry] of Object.entries(all)) {
    if (!entry?.at || Date.now() - entry.at > 10 * 60 * 1000) {
      delete all[jid];
      removed++;
    }
  }
  if (removed) db.set('searchCache', all);
  return removed;
}

// 💾 نسخة احتياطية لقاعدة البيانات — بنحتفظ بآخر 5
export function backupDb() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const src = join(DATA_DIR, 'db.json');
    if (!fs.existsSync(src)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(src, join(BACKUP_DIR, `db-${stamp}.json`));
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort();
    while (files.length > 5) fs.unlinkSync(join(BACKUP_DIR, files.shift()));
  } catch (err) {
    console.error('⚠️ فشل النسخ الاحتياطي:', err.message);
  }
}

// التنظيف الكامل عند الإقلاع
export function bootCleanup() {
  try {
    const removed = purgeLegacyKeys();
    const merged = mergeDuplicateProfiles(); // 🧬 دمج البروفايلات المكررة (LID ورقم لنفس الشخص)
    const replies = purgeBadReplies();
    const games = purgeStaleGames();
    cleanIdentityMap();
    purgeExpiredCache();
    if (removed) console.log(`🧹 تنظيف: ${removed} مفتاح قديم اتشال`);
    if (merged) console.log(`🧹 تنظيف: ${merged} بروفايل مكرر اتجمعوا في بروفايل واحد`);
    if (replies) console.log(`🧹 تنظيف: ${replies} رد مكرر/خايب اتشال من الذاكرة`);
    if (games) console.log(`🧹 تنظيف: ${games} لعبة/تذكير معلق اتشال`);
  } catch (err) {
    console.error('⚠️ خطأ في التنظيف:', err.message);
  }
}

// تشغيل دوري
//
// ⚠️ كان بيعمل setInterval جديد في كل مرة بينادى (وكل نداء = إعادة اتصال).
// بعد 5 انقطاعاتبقى عندك 5 interval شغّالين بنفس الشغل والـ memory ماشي طالع.
// دلوقتي: بنوقف القديم قبل ما نعمل جديد، وبنرجّع دالة إيقاف.
let timers = [];

export function startMaintenance() {
  stopMaintenance();
  bootCleanup();
  backupDb();
  timers = [
    setInterval(() => {
      try {
        purgeExpiredCache();
        purgeBadReplies();
        purgeStaleGames(); // ⏰ كل ساعة: أي لعبة معلّقة تنضف بدل ما تقفل جروب
      } catch (err) {
        console.error('⚠️ فشل التنظيف الدوري:', err.message);
      }
    }, 3600000),
    setInterval(() => {
      try {
        backupDb();
      } catch (err) {
        console.error('⚠️ فشل النسخ الاحتياطي:', err.message);
      }
    }, 6 * 3600000),
  ];
  for (const t of timers) t.unref?.();
  return stopMaintenance;
}

export function stopMaintenance() {
  for (const t of timers) clearInterval(t);
  timers = [];
}
