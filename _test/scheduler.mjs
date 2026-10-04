/** اختبار scheduler دون تعديل DB: يثبت قواعد dailyRunKey فقط. */
import { dailyRunKey, markDailyRun } from '../core/scheduler.js';
import { db } from '../core/db.js';

if (process.env.RAILWAY_ENVIRONMENT) {
  console.error('❌ اختبارات scheduler التي تكتب DB ممنوعة على Railway');
  process.exit(2);
}

const original = structuredClone(db.data.dailyRuns ?? {});
let fail = 0;
function check(label, value) {
  console.log(`${value ? '✅' : '❌'} ${label}`);
  if (!value) fail++;
}
try {
  const key = `__test_${Date.now()}`;
  check('اليوم غير مسجل في البداية', dailyRunKey(key));
  check('الفحص لا يسجل المهمة تلقائيًا (الفشل يسمح بإعادة المحاولة)', dailyRunKey(key));
  markDailyRun(key);
  check('التسجيل يمنع التكرار بعد النجاح', !dailyRunKey(key));
  delete db.data.dailyRuns[key];
} finally {
  db.data.dailyRuns = original;
  db.flush();
}
console.log(`\n${fail ? '❌' : '✅'} failures=${fail}`);
process.exit(fail ? 1 : 0);
