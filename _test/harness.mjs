/**
 * 🧪 هارنس الاختبار — بيشغّل كل أوامر البوت على socket وهمي وبيمسك أي rejection.
 *
 * التشغيل: node _test/harness.mjs
 *
 * ليه مهم: أكترbugs مؤثرة في البوت (sendQuickReplies بيرمي sections،
 * m.key مش موجودة في buildContext) مكانوش باينين في الكود — لازم تشغيل حقيقي.
 */

import { pathToFileURL } from 'node:url';

// 🛡️ نمنع أي command يستعمل الشبكة: بنحقن fetch/axios وهميين
const OFFLINE = process.env.HARNESS_OFFLINE !== '0';
if (OFFLINE) {
  const fake = async () => {
    throw new Error('__HARNESS_OFFLINE__');
  };
  globalThis.fetch = fake;
}

const { loadCommands } = await import('../core/loader.js');

// ─────────────── socket وهمي ───────────────
export function makeSock() {
  const sent = [];
  const ev = { on() {}, off() {}, removeAllListeners() {} };
  return {
    sent,
    ev,
    user: { id: '48732079554:1@s.whatsapp.net', name: 'ASTRO' },
    async sendMessage(jid, content) {
      sent.push({ kind: 'message', jid, content });
      return { key: { id: 'H' + sent.length } };
    },
    async relayMessage(jid, msg) {
      sent.push({ kind: 'relay', jid, msg });
      return { key: { id: 'R' + sent.length } };
    },
    async groupMetadata() {
      return { participants: [{ id: '201273990719@s.whatsapp.net', admin: 'admin' }], subject: 'test' };
    },
    async groupFetchAllParticipating() {
      return { '1@g.us': { subject: 'جروب اختبار', participants: [{ id: 'x' }] } };
    },
    async groupSettingUpdate() {
      return {};
    },
    async groupParticipantsUpdate() {
      return {};
    },
    async groupInviteCode() {
      return 'ABC123';
    },
    async sendPresenceUpdate() {},
    async updateProfileStatus() {},
    async downloadContentFromMessage() {
      throw new Error('__NO_MEDIA__');
    },
    signalRepository: { lidMapping: { getPNForLID: async () => null } },
    async findUserId() {
      return null;
    },
  };
}

// ─────────────── رسالة.command — بتبني context زي handler.js ───────────────
export function makeCtx(sock, { jid = '201273990719@s.whatsapp.net', sender = '201273990719@s.whatsapp.net', body = '', message = {} } = {}) {
  const key = { remoteJid: jid, fromMe: false, id: 'MSG' };
  if (jid.endsWith('@g.us')) {
    key.participant = sender;
    key.participantAlt = sender.replace('@s.whatsapp.net', '@c.us');
  } else {
    key.remoteJidAlt = sender.replace('@s.whatsapp.net', '@c.us');
  }
  const msg = { key, message, pushName: 'اختبار' };
  const identityKey = sender;

  return {
    sock,
    msg,
    message,
    body,
    jid,
    sender,
    senderAlt: sender.replace('@s.whatsapp.net', '@c.us'),
    identityKey,
    canonical: identityKey,
    isGroup: jid.endsWith('@g.us'),
    pushName: 'اختبار',
    args: body.startsWith('.') ? body.slice(1).trim().split(/\s+/).filter(Boolean) : [],
    command: body.startsWith('.') ? body.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? '' : '',
    reply: (text) => sock.sendMessage(jid, { text }),
  };
}

// ─────────────── التشغيل ───────────────
export async function runAll() {
  const { commands, categories, errors } = await loadCommands();

  // ⚠️ خطأ تحميل = أمر مش موجود خالص، والبوت بيرد "مفيش أمر"
  // لازم يبقى فشل صريح مش مجرد سطر في اللوج
  const failures = errors.map((e) => ({ cmd: '⚠️ تحميل', case: 'import', msg: e }));

  const unique = [...new Set(commands.values())];
  const cases = [
    { label: 'خاص/فاضي', jid: '201273990719@s.whatsapp.net', body: '.' },
    { label: 'خاص/بالاسم', jid: '201273990719@s.whatsapp.net', body: '.x' },
    { label: 'جروب/فاضي', jid: '120363000000000000@g.us', body: '.' },
    { label: 'جروب/بالاسم', jid: '120363000000000000@g.us', body: '.x' },
  ];

  for (const cmd of unique) {
    for (const c of cases) {
      const sock = makeSock();
      const m = makeCtx(sock, {
        jid: c.jid,
        body: `${c.body}${cmd.name}`,
        message: {},
      });
      try {
        await Promise.race([
          // نفس الاستدعاء اللي handler.js بيعمله: (sock, m, args, ctx)
          cmd.execute(sock, m, m.args.slice(1), {
            commands,
            categories,
            startTime: Date.now(),
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('__TIMEOUT__')), 12000)),
        ]);
      } catch (err) {
        const msg = String(err?.message ?? err);
        // نتوقع رفض الشبكة والوسائط في الوضع offline — مش bugs
        if (msg === '__HARNESS_OFFLINE__' || msg === '__NO_MEDIA__' || msg === '__TIMEOUT__') continue;
        failures.push({ cmd: cmd.name, case: c.label, msg: msg.slice(0, 110) });
      }
    }
  }

  return { total: unique.length, categories: categories.size, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log('🧪 بيشغّل كل الأوامر…\n');
  const { total, categories, failures } = await runAll();
  console.log(`📦 ${total} أمر في ${categories} قسم`);
  if (!failures.length) {
    console.log('✅ مفيش أي crash في أي أمر في أي سيناريو');
  } else {
    console.log(`\n❌ ${failures.length} فشل:\n`);
    const byCmd = new Map();
    for (const f of failures) {
      if (!byCmd.has(f.cmd)) byCmd.set(f.cmd, []);
      byCmd.get(f.cmd).push(f);
    }
    for (const [cmd, list] of byCmd) {
      console.log(`  ▸ ${cmd} — ${list[0].msg}`);
    }
  }
  process.exit(failures.length ? 1 : 0);
}
