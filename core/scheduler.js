import { parseArabicNumber } from './arabic.js';
import { db } from './db.js';

// ⏰ المجدول — تذكيرات ونشر تلقائي محفوظ في قاعدة البيانات
// بيتنفذ من interval كل 30 ثانية (في proactive.js) — وبيكمل شغل بعد إعادة
// تشغيل البوت لأن الوظائف محفوظة في db تحت مفتاح "scheduled" كخريطة مسطحة
// { id → job }.

/**
 * بيضيف وظيفة مجدولة ويرجّع الـ id بتاعها.
 * meta بتحمل تفاصيل النوع (مثلاً نص التذكير ومين طلبه).
 */
export function addJob(type, chatJid, at, meta = {}) {
  const all = db.get('scheduled', {});
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  all[id] = { id, type, chatJid, at, meta, created: Date.now() };
  db.set('scheduled', all);
  return id;
}

export function removeJob(id) {
  const all = db.get('scheduled', {});
  if (all[id]) {
    delete all[id];
    db.set('scheduled', all);
    return true;
  }
  return false;
}

// الوظائف اللي وقتها جه — بترجع مرجع للوظائف الحية (التعديل بيأثر على db)
export function dueJobs(now = Date.now()) {
  return Object.values(db.get('scheduled', {})).filter((j) => j.at <= now);
}

// 📋 كل الوظائف، اختياريًا من نوع معيّن (الأمر بيفلتر بيها اللي للمستخدم)
export function listJobs(type) {
  return Object.values(db.get('scheduled', {})).filter((j) => !type || j.type === type);
}

// 📅 مهام يومية — بتتنفذ مرة واحدة في اليوم (بتوقيت القاهرة)
//
// ⚠️ `dailyRunKey` فحص بس، و`markDailyRun` التسجيل بيحصل بعد ما الشغل ينجح
// فعلاً — فأي فشل (fetch الجروبات وقع، الإرسال رفض) بيسيب المهمة تتكرر
// بعد 30 ثانية بدل ما تتخطى نهاردا كله.
export function dailyRunKey(task) {
  const runs = db.get('dailyRuns', {});
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  return runs[task] !== today;
}

export function markDailyRun(task) {
  const runs = db.get('dailyRuns', {});
  runs[task] = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  db.set('dailyRuns', runs);
}

export function cairoHour() {
  return Number(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false }));
}

export function cairoWeekday() {
  return new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' });
}

// 🗓️ مُحلل وقت مصري بسيط: "بعد 5 دقايق" / "بعد ساعتين" / "بعد يوم" / "بعد نص ساعة" (بدون رقم = 1)
export function parseEgyptianDuration(text) {
  const t = String(text).toLowerCase().trim();
  let minutes = null;

  if (/نص\s*ساعة/.test(t)) minutes = 30;
  else {
    const numMatch = /(\d+(?:\.\d+)?)/.exec(t);
    // كلمات العدد المزدوج: ساعتين/يومين/دقيقتين = 2
    // ⚠️ كان `/ (تين|ين) \b /` — و \b في جافاسكربت معرّف على [A-Za-z0-9_]
    // والحروف العربية مش منه، فمفيش حدود كلمة جنبها والمطابقة ميتحققش خالص.
    // النتيجة: "بعد ساعتين" كانت بتفكّرك بعد ساعة.
    const dual = /(?:تين|ين)(?![ء-ي])/.test(t) ? 2 : 1;
    // أرقام مكتوبة بالعربي: عشرين = 20، مية = 100
    const word = parseArabicNumber(t.replace(/بعد|ب\s*الظبط|بالظبط|و\s*نص/g, ' ').trim().split(/\s+/)[0] ?? '');
    const n = numMatch ? Number(numMatch[1]) : (word ?? dual);
    if (/دقيق|دقايق/.test(t)) minutes = n;
    else if (/ساع/.test(t)) minutes = n * 60;
    else if (/يوم|أيام|ايام/.test(t)) minutes = n * 1440;
    else if (/أسبوع|اسبوع/.test(t)) minutes = n * 10080;
    else if (/ثاني/.test(t)) minutes = n / 60;
  }

  if (minutes === null || !isFinite(minutes) || minutes <= 0) return null;
  return { minutes: Math.max(1, Math.round(minutes)), at: Date.now() + minutes * 60000, label: `${minutes} دقيقة` };
}
