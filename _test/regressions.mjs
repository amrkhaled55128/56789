/**
 * اختبارات إصلاحات مؤكدة (v11) — كل علة_peculiar إصلاح ليها assertion.
 * التشغيل: node _test/regressions.mjs
 */
import { isErrorText } from '../core/ai.js';
import { TRIGGERS } from '../core/persona.js';
import { dueJobs, addJob, removeJob } from '../core/scheduler.js';
import { SECTIONS } from '../core/menu.js';
import { db } from '../core/db.js';

if (process.env.RAILWAY_ENVIRONMENT) {
  console.error('❌ اختبار الـDB ممنوع على Railway');
  process.exit(2);
}

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) pass++; else fail++;
};

console.log('💬 ردود قصيرة مش بتترفض كخطأ');
for (const reply of ['تمام', 'أيوه', 'لا', 'يا معلم', 'ماشي', 'حلو أوي ❤️', 'أنا كويس']) {
  check(`"${reply}" رد صالح`, !isErrorText(reply));
}
check('فراغ فاضي مرفوض', isErrorText(''));
check('حرف واحد مرفوض', isErrorText('ا'));
check('رد المزود الفاشل مرفوض', isErrorText('لم أتمكن من الإجابة على سؤالك'));
check('رد "I cannot" مرفوض', isErrorText('I cannot do that'));

console.log('\n🎪 ردود المزاج الاحتياطية');
const { readFileSync } = await import('node:fs');
const ai = readFileSync(new URL('../core/ai.js', import.meta.url), 'utf8');
for (const mood of ['زعلان', 'مبسوط', 'تعبان', 'قلقان', 'حبيت']) {
  check(`مزاج "${mood}" ليه رد احتياطي`, ai.includes(`${mood}:`));
}
check('lastMood المخزّن object بيتبقري صح', ai.includes('profile?.lastMood?.mood'));
check('regex الشكر نضيف من التلف', !ai.includes('-merci') && ai.includes('merci'));

console.log('\n🚫 تلف في نصوص المستخدم');
for (const s of SECTIONS) {
  check(`وصف "${s.label}" نضيف`, !/[\uFFFD\u0400-\u04FF\u4e00-\u9fff]/.test(s.desc), s.desc);
}
check('TRIGGERS من غير اسم قديم', !TRIGGERS.includes('نوفا') && !TRIGGERS.includes('nova'));
check('TRIGGERS فيها الاسم الصح', TRIGGERS.includes('استرو'));

console.log('\n⏰ التذكيرات ما بتضيعش لو الإرسال فشل');
const scheduled = { ...(db.get('scheduled', {}) ?? {}) };
try {
  const jobId = addJob('reminder', '201273990719@s.whatsapp.net', Date.now() - 1000, {
    text: 'اختبار الضياع',
    who: '201273990719@s.whatsapp.net',
    whoName: 'اختبار',
  });
  check('التذكير المستحق موجود في الكاش', dueJobs().some((j) => j.id === jobId));

  // سلوك حقيقي: socket بيبعت فاشل — لازم التذكير يفضل موجود ومحاول يُعاد
  const { startScheduler } = await import('../core/proactive.js');
  const failSock = { sendMessage: async () => { throw new Error('network down'); } };
  const stop = startScheduler(failSock);
  await new Promise((r) => setTimeout(r, 400));
  stop();
  check('التذكير بيفضل محفوظ بعد فشل الإرسال', dueJobs().some((j) => j.id === jobId));
  check('مفيش استبدال للتذكير بعد الفشل', dueJobs().filter((j) => j.id === jobId).length === 1);
} finally {
  db.data.scheduled = scheduled;
  db.flush();
}

console.log(`\n✅ ${pass} | ❌ ${fail}`);
process.exit(fail ? 1 : 0);
