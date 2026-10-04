import { sendText } from '../../core/send.js';
import { isAdmin } from '../../core/protection.js';
import { targetOf, mentionOf } from '../../core/groupadmin.js';

// 🦶 .kick — طرد عضو (منشنه أو اعمل رد على رسالته) — للأدمن
export default {
  name: 'kick',
  aliases: ['اطرد', 'طرد'],
  description: 'طرد عضو — منشنه أو اعمل رد على رسالته (للأدمن)',
  usage: '.kick @شخص',
  async execute(sock, m, args) {
    if (!(await isAdmin(sock, m.jid, m.sender))) return m.reply('🔐 الأمر ده للأدمن بس');
    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص أو اعمل رد على رسالته: `.kick @شخص`');
    try {
      await sock.groupParticipantsUpdate(m.jid, [target], 'remove');
      return sendText(sock, m.jid, `🦶 اتطرد ${mentionOf(target)} — الله يستر`, { mentions: [target] });
    } catch {
      return m.reply('❌ مقدرتش أطرده — اتأكد إني أدمن في الجروب');
    }
  },
};
