/**
 * اختبار ملكية الأسماء العربية: aliases العامة لا تتعارض بصمت.
 * بعض legacy spellings تبقى موثقة كـ compatibility mappings.
 */
import { loadCommands } from '../core/loader.js';
const { commands, collisions, errors } = await loadCommands();
let fails = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${extra}`}`);
  if (!ok) fails++;
}
check('كل ملفات الأوامر تحمّلت', errors.length === 0, errors.join('; '));
const expected = {
  تحدي: 'duel',
  سؤال: 'quiz',
  الترتيب: 'top',
  رتبتي: 'rank',
  شرح_الامر: 'help',
  صيغه: 'usage',
  ازاي_استعمل: 'how',
  سباق: 'race',
  سرعه: 'ping',
  الهكزة: 'hookah',
};
for (const [alias, winner] of Object.entries(expected)) {
  check(`.${alias} → ${winner}`, commands.get(alias)?.name === winner, `الفعلي=${commands.get(alias)?.name}`);
}
const unexpected = collisions.filter((c) => !['الترتيب','ترتيب','الهكزه','الهكزة'].includes(c.alias));
check('لا توجد تعارضات عربية غير مقصودة', unexpected.length === 0,
  unexpected.map((c) => `.${c.alias}:${c.winner}/${c.shadowed}`).join(', '));
process.exit(fails ? 1 : 0);
