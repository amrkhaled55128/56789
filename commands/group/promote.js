import { isAdmin } from '../../core/protection.js';
import { targetOf, mentionOf } from '../../core/groupadmin.js';

// ⬆️ .promote — ترقية عضو لأدمن (للمالك/الأدمن)
export default {
  name: 'promote',
  aliases: ['ترقية', 'ادمن'],
  description: 'ترقية عضو لأدمن — منشنه أو رد على رسالته',
  usage: '.promote @شخص',
  async execute(sock, m) {
    if (!(await isAdmin(sock, m.jid, m.sender))) return m.reply('🔐 الأمر ده للأدمن بس');
    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص أو اعمل رد على رسالته: `.promote @شخص`');
    try {
      await sock.groupParticipantsUpdate(m.jid, [target], 'promote');
      return sock.sendMessage(m.jid, { text: `⬆️ رقيت ${mentionOf(target)} لأدمن 🎉`, mentions: [target] });
    } catch {
      return m.reply('❌ مقدرتش — لازم المالك بتاع الجروب يعمل كده أو أنا مالك');
    }
  },
};
