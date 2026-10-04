/**
 * اختبارات مسار الذكاء الاصطناعي:
 * - الرد الفاضي يفتح circuit breaker بعد العتبة ولا يستمر كل رسالة.
 * - الـ breaker المفتوح يتخطى المزود.
 * - offline fallback يرجع نص مفهوم لو كل المزودات معطلة.
 *
 * التشغيل: node _test/ai.mjs
 */
import { apiHealth, isOpen, noteEmpty } from '../core/api.js';
import { hintFor } from '../core/arabic.js';
import { chatWithAI } from '../core/ai.js';

let pass = 0;
let fail = 0;
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${detail}`); }
}

console.log('🧠 AI health / fallback');
const gemini = '/api/v1/ai/gemini';
check('مزود غير مختبر يظهر unknown لا healthy', aiProviderStatus().gemini === 'unknown');
for (let i = 0; i < 4; i++) noteEmpty(gemini);
check('ردود Gemini الفاضية تفتح breaker بعد 4 محاولات', isOpen(gemini));
check('حالة المزود تظهر open', aiProviderStatus().gemini === 'open');
check('endpoint المفتوح يمنع زيادة محاولات الرد الفاضي', (() => { noteEmpty(gemini); return aiProviderStatus().gemini === 'open'; })());
check('حالة API تجمع endpoint المفتوح', apiHealth().down.includes(gemini));

// منع طلبات network على باقي المزودات. throws بسرعة لإجبار fallback المحلي.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('test offline'); };
try {
  const result = await chatWithAI({
    text: 'ازيك؟',
    key: '201000000001@s.whatsapp.net',
    pushName: 'اختبار',
  });
  check('AI يرجع رد بديل مفهوم عند سقوط المصادر', !!result.reply && result.reply.length > 8, result.reply);
  check('الرد البديل لا يكشف أسماء/أخطاء مزودين', !/500|Groq|Gemini|API|كل المصادر فشلت/i.test(result.reply));
} catch (err) {
  check('AI لا يرمي خطأ إلى المستخدم', false, err.message);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('\n💡 توصيات الأمر');
check('اقتراح تنزيل الأغاني', hintFor('إزاي أنزل أغنية؟') === 'song');
check('اقتراح التذكيرات بالاسم الفعلي', hintFor('فكرني بعد ساعة') === 'ذكرني');
check('لا يخمن اقتراحًا من لا شيء', hintFor('السلام عليكم يا صاحبي') === null);

console.log(`\n✅ ${pass} | ❌ ${fail}`);
process.exit(fail ? 1 : 0);
