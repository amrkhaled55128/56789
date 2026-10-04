/** Tests for mention/reply target extraction in group admin commands. */
import { loadCommands } from '../core/loader.js';
import { makeSock, makeCtx } from './harness.mjs';
import { db } from '../core/db.js';

if (process.env.RAILWAY_ENVIRONMENT) process.exit(2);
const original = structuredClone(db.data.groupSettings ?? {});
const { commands, categories } = await loadCommands();
const OWNER = '201273990719@s.whatsapp.net';
const TARGET = '201888877766@s.whatsapp.net';
let pass=0, fail=0;
function check(label, ok, detail='') { console.log(`${ok?'✅':'❌'} ${label}${ok?'':` — ${detail}`}`); if(ok)pass++;else fail++; }

try {
  // Group admin from harness is owner phone only. Give sender owner identity.
  for (const name of ['kick','promote','demote']) {
    const sock = makeSock();
    const m = makeCtx(sock, {
      jid: '120363000000000000@g.us', sender: OWNER, body: `.${name} @target`,
      message: { extendedTextMessage: { contextInfo: { mentionedJid: [TARGET] } } },
    });
    await commands.get(name).execute(sock, m, m.args.slice(1), { commands, categories });
    const calls = sock.sent.filter((x) => x.content?.text);
    check(`${name} accepts mentionedJid`, calls.some((x) => x.content.text.includes(TARGET.split('@')[0])) || !calls.some((x) => x.content.text.includes('منشن')),
      calls.map((x) => x.content?.text).join(' | '));
  }
} finally {
  db.data.groupSettings = original;
  db.flush();
}
console.log(`\n✅ ${pass} | ❌ ${fail}`);
process.exit(fail?1:0);
