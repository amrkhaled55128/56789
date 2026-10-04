import { sendText } from '../../core/send.js';
import { isOwner } from '../../lib/utils.js';
import { config } from '../../config.js';

// 📢 .broadcast — رسالة لكل الجروبات اللي فيها البوت (للمالك)
export default {
  name: 'broadcast',
  aliases: ['برودكاست', 'اذاعة'],
  description: 'إرسال رسالة لكل الجروبات — للمالك فقط',
  usage: '.broadcast النص',
  async execute(sock, m, args) {
    if (!isOwner(m, config)) return m.reply('🔐 الأمر ده للمالك بس');
    const text = args.join(' ').trim();
    if (!text) return m.reply('اكتب الرسالة: `.broadcast النص`');

    const groups = await sock.groupFetchAllParticipating();
    const jids = Object.keys(groups ?? {});
    let sent = 0;
    for (const jid of jids) {
      try {
        await sendText(sock, jid, `📢 *رسالة من المالك:*\n\n${text}`);
        sent++;
        await new Promise((r) => setTimeout(r, 1500)); // فاصل بين الرسايل
      } catch {}
    }
    return m.reply(`✅ اتبعت لـ *${sent}* جروب من ${jids.length}`);
  },
};
