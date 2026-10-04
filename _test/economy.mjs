/** اختبارات اقتصاد على DB محلية مع snapshot/restore، ممنوع على Railway. */
if (process.env.RAILWAY_ENVIRONMENT) process.exit(2);
import { db } from '../core/db.js';
import { loadCommands } from '../core/loader.js';
import { makeSock, makeCtx } from './harness.mjs';

const original = structuredClone(db.data);
let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) pass++; else fail++;
}

try {
  const { commands, categories } = await loadCommands();
  const shop = commands.get('shop');
  const key = '201233344455@s.whatsapp.net';
  const jid = '120363088888@g.us';
  db.set('economy', { [key]: { xp: 0, level: 1, coins: 500 } });
  db.set('groupSettings', { [jid]: { warnings: { [key]: 2 } } });

  const s1 = makeSock();
  const m1 = makeCtx(s1, { jid, sender: key, body: '.shop buy hint' });
  await shop.execute(s1, m1, ['buy', 'hint'], { commands, categories });
  const afterHint = db.get('economy', {})[key];
  check('شراء hint يخصم 100 ويضيف 3 تلميحات', afterHint.coins === 400 && afterHint.hints === 3,
    `coins=${afterHint.coins}, hints=${afterHint.hints}`);

  const s2 = makeSock();
  const m2 = makeCtx(s2, { jid, sender: key, body: '.shop buy clearwarn' });
  await shop.execute(s2, m2, ['buy', 'clearwarn'], { commands, categories });
  const afterWarn = db.get('economy', {})[key];
  check('شراء clearwarn يخصم مرة واحدة ويحذف التحذير', afterWarn.coins === 150 && !db.get('groupSettings', {})[jid]?.warnings?.[key],
    `coins=${afterWarn.coins}`);
} finally {
  db.data = original;
  db.flush();
}
console.log(`\n✅ ${pass} | ❌ ${fail}`);
process.exit(fail ? 1 : 0);
