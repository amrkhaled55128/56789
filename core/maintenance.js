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

// ⚠️ المفاتيح الجروبية (@g.us) مش دايمًا قمامة:
// - المفاتيح اللي بتتخزن بالمستخدم (users, rps, mathStats...) → أي مفتاح جروب
//   فيها بقايا عيب الهوية القديم → بنمسحها.
// - المفاتيح اللي تصميمها بالشات (xo/quiz/hang/math ألعاب شغالة، botOff حالة
//   إيقاف الجروب، searchCache كاش، groupSettings، td، aiState) → مفتاح جروب
//   فيها مشروع، ومسحها كان بيقتل ألعاب شغالة ويرجّع البوت يكتب في جروبات
//   المالك قافلها — كل ما البوت يعيد التشغيل. فبنمسح منها المفتاح الفاضي بس.
const USER_KEYED = new Set(['rps', 'users', 'mathStats', 'hangStats']);
const LEGACY_COLLECTIONS = [
  'rps', 'xo', 'quiz', 'users', 'aiState', 'searchCache', 'td', 'hang',
  'math', 'mathStats', 'hangStats', 'groupSettings', 'botOff',
];

function purgeLegacyKeys() {
  let removed = 0;
  for (const col of LEGACY_COLLECTIONS) {
    const all = db.get(col, {});
    if (typeof all !== 'object' || all === null) continue;
    // ⚠️ العدّاد كان بره اللوب فكان بينتسب للأول بس، وكمان `db.get` بيرجّع
    // نفس المرجع بالظبط فمقارنة الأطوال كانت دايمًا متساوية و db.set
    // مكانش بينادى أصلاً — يعني الحذف كان بيشتغل في الذاكرة بس.
    let removedHere = 0;
    for (const k of Object.keys(all)) {
      if (k === '' || (USER_KEYED.has(col) && k.includes('@g.us'))) {
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

// 🕹️ الألعاب المعلقة — اللي ليها عمر (`at`) بينضف لو عدّى الـ TTL بتاعها
// بدل ما تقفل الجروب للأبد. ⚠️ القديم كان بيحسب أي مدخلة من غير `at` عمرها
// لانهائي (= قديمة) — فكان بيمسح كل ساعة إحصائيات rps الدايمة والألعاب
// الشغالة في xo/quiz (اللي مبتخزنش `at` أصلاً). دلوقتي: اللي من غير `at`
// مبنقدرش نحكم على عمره فبنسيبه — لحد ما اللعبة نفسها تمسحه أو TTL قاعدة
// زي td (كاش "آخر سؤال" مش لعبة) يمسحه بالعمر الثابت.
function purgeStaleGames() {
  const HOUR = 3600000;
  const rules = [
    { col: 'race', ttl: 2 * 60 * 1000, usesAt: true },
    { col: 'duels', ttl: HOUR, usesAt: true },
    { col: 'guess', ttl: HOUR, usesAt: true },
    { col: 'guessWho', ttl: HOUR, usesAt: true },
    { col: 'hang', ttl: HOUR, usesAt: true },
    { col: 'xo', ttl: 6 * HOUR, usesAt: true },
    { col: 'quiz', ttl: HOUR, usesAt: true },
    { col: 'td', ttl: 2 * HOUR },
    { col: 'math', ttl: 5 * 60 * 1000, usesAt: true },
  ];
  let removed = 0;
  for (const { col, ttl, usesAt } of rules) {
    const all = db.get(col, {});
    if (typeof all !== 'object' || all === null) continue;
    let n = 0;
    for (const [k, v] of Object.entries(all)) {
      if (usesAt) {
        if (!v?.at) continue; // من غير طابع زمني مفيش حكم على العمر
        if (Date.now() - v.at <= ttl) continue;
      }
      delete all[k];
      n++;
    }
    if (n) {
      db.set(col, all);
      removed += n;
    }
  }

  // التذكيرات المنفذة واللي فات موعدها بعيد — ما بتتراكمش.
  // ⚠️ كان بيتعامل مع "scheduled" كخريطة متداخلة {user: {id: job}} وهي فعليًا
  // مسطحة {id: job} (شوف scheduler.js) — فالحذف كان بيمسح حقول جوّه الوظيفة
  // (at/meta...) بالغلط قبل ما يمسح الوظيفة نفسها بالصدفة.
  const sched = db.get('scheduled', {});
  let staleJobs = 0;
  if (typeof sched === 'object' && sched !== null) {
    for (const [id, job] of Object.entries(sched)) {
      if (job?.done || (job?.at && job.at < Date.now() - 6 * HOUR)) {
        delete sched[id];
        staleJobs++;
      }
    }
    if (staleJobs) db.set('scheduled', sched);
  }

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

// 🧹 المفاتيح اليتيمة — بقايا لأشخاص/شاتات مش موجودين تاني:
// بروفايلات فاضية تمامًا • وظائف مجدولة بايظة الشكل أو لمستخدم مش في الذاكرة
// (أقدم من 3 أيام احتياطي) • ردود كاش عدّى عليها وقت صلاحيتها (10 دقايق)
function purgeOrphanKeys() {
  let removed = 0;

  const users = db.get('users', {});
  let emptyProfiles = 0;
  if (typeof users === 'object' && users !== null) {
    for (const [k, p] of Object.entries(users)) {
      if (!p || typeof p !== 'object' || Object.keys(p).length === 0) {
        delete users[k]; // بروفايل فاضي مالوش أي معلومة — بقايا نظيفة
        emptyProfiles++;
      }
    }
    if (emptyProfiles) {
      db.set('users', users);
      removed += emptyProfiles;
    }
  }

  const sched = db.get('scheduled', {});
  let orphanJobs = 0;
  if (typeof sched === 'object' && sched !== null) {
    for (const [id, job] of Object.entries(sched)) {
      const malformed = !job || typeof job !== 'object' || typeof job.at !== 'number' || !job.type;
      const ownerGone =
        job?.meta?.who && users[job.meta.who] === undefined &&
        typeof job.created === 'number' && Date.now() - job.created > 3 * 86400000;
      if (malformed || ownerGone) {
        delete sched[id];
        orphanJobs++;
      }
    }
    if (orphanJobs) {
      db.set('scheduled', sched);
      removed += orphanJobs;
    }
  }

  const caches = db.get('replyCache', {});
  let staleReplies = 0;
  if (typeof caches === 'object' && caches !== null) {
    for (const [chat, inner] of Object.entries(caches)) {
      if (!inner || typeof inner !== 'object') {
        delete caches[chat];
        staleReplies++;
        continue;
      }
      for (const [q, v] of Object.entries(inner)) {
        if (!v?.at || Date.now() - v.at > 10 * 60 * 1000) {
          delete inner[q]; // القراءة نفسها ما بتقبلش رد أقدم من 10 دقايق
          staleReplies++;
        }
      }
      if (!Object.keys(inner).length) delete caches[chat];
    }
    if (staleReplies) {
      db.set('replyCache', caches);
      removed += staleReplies;
    }
  }

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
    const orphans = purgeOrphanKeys();
    if (removed) console.log(`🧹 تنظيف: ${removed} مفتاح قديم اتشال`);
    if (merged) console.log(`🧹 تنظيف: ${merged} بروفايل مكرر اتجمعوا في بروفايل واحد`);
    if (replies) console.log(`🧹 تنظيف: ${replies} رد مكرر/خايب اتشال من الذاكرة`);
    if (games) console.log(`🧹 تنظيف: ${games} لعبة/تذكير معلق اتشال`);
    if (orphans) console.log(`🧹 تنظيف: ${orphans} مفتاح يتيم اتشال`);
  } catch (err) {
    console.error('⚠️ خطأ في التنظيف:', err.message);
  }
}

// تشغيل دوري
//
// ⚠️ كان بيعمل setInterval جديد في كل مرة بينادى (وكل نداء = إعادة اتصال).
// بعد 5 انقطاعات بيبقى عندك 5 interval شغّالين بنفس الشغل والـ memory ماشي طالع.
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
        purgeOrphanKeys(); // 🧹 اليتيمة بتتراكم بالبطء — كل ساعة كفاية
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
