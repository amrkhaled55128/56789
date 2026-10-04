/** اختبارات regressions للخصوصية والحماية. ممنوع تشغيلها على Railway. */
if (process.env.RAILWAY_ENVIRONMENT) {
  console.error('❌ اختبارات DB المحلية ممنوعة على Railway');
  process.exit(2);
}

import { db } from '../core/db.js';
import { checkMessage, isSpamText } from '../core/protection.js';
import { loadCommands } from '../core/loader.js';
import { makeSock, makeCtx } from './harness.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const originalData = structuredClone(db.data);
let pass = 0, fail = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${extra}`}`);
  if (ok) pass++; else fail++;
}

try {
  console.log('🔒 خصوصية anti-delete');
  const handler = await readFile(new URL('../core/handler.js', import.meta.url), 'utf8');
  check('لا يعيد نشر نص آخر رسالة محفوظة', !/async function announceDeleted[\s\S]{0,800}lastMessages/.test(handler));
  check('إشعار حذف عام مربوط بصاحب الرسالة فقط', /رسالة من @\$\{digits\} اتحذفت/.test(handler));

  console.log('\n🧹 فلترة الرسائل');
  check('رسالة join طبيعية لا تُصنّف spam', !isSpamText('I will join you tomorrow'));
  check('دعوة WhatsApp قصيرة تتصنف spam', isSpamText('https://chat.whatsapp.com/AbCdEf'));
  check('click-here spam يتصنف', isSpamText('click here to get free money'));

  console.log('\n🪪 خصوصية mystats');
  const { commands } = await loadCommands();
  const mystats = commands.get('mystats');
  const key = '201122233344@s.whatsapp.net';
  db.set('users', { [key]: { name: 'Test', memories: [{ text: 'PRIVATE_MARKER' }] } });
  db.set('economy', { [key]: { xp: 0, level: 1, coins: 100 } });
  const sock = makeSock();
  const m = makeCtx(sock, { jid: '120363099999@g.us', sender: key, body: '.mystats' });
  await mystats.execute(sock, m, [], { commands, categories: new Map() });
  check('كارت الجروب لا يعرض الذكرى الشخصية', !sock.sent.some((x) => JSON.stringify(x).includes('PRIVATE_MARKER')));

  console.log('\n🛡️ anti-spam');
  const sender = '201155566677@s.whatsapp.net';
  const group = '120363099998@g.us';
  db.set('groupSettings', { [group]: { antispam: true, antilink: false, antibot: false, antiflood: false, capslock: false, nsfw: false } });
  let eighthBlocked = false;
  for (let i = 0; i < 8; i++) {
    const sockMsg = makeSock();
    const raw = { key: { remoteJid: group, participant: sender, id: `SPAM_TEST_${i}`, fromMe: false }, message: { conversation: `message-${i}` }, pushName: 'test' };
    const ctx = makeCtx(sockMsg, { jid: group, sender, body: `message-${i}`, message: raw.message });
    ctx.msg = raw;
    const blocked = await checkMessage(sockMsg, ctx);
    if (i === 7) eighthBlocked = blocked === true;
  }
  check('الرسالة الثامنة تتحذف وتتوقف قبل الأوامر', eighthBlocked);
} finally {
  db.data = originalData;
  db.flush();
}

console.log(`\n✅ ${pass} | ❌ ${fail}`);
process.exit(fail ? 1 : 0);
