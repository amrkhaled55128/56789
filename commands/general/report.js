import { isOwner } from '../../lib/utils.js';
import { config } from '../../config.js';

// 📣 .report — بلاغ يوصل للمالك فورًا
export default {
  name: 'report',
  aliases: ['بلاغ', 'ابلاغ'],
  description: 'ابعت بلاغ أو اقتراح للمالك — .report كلامك',
  usage: '.report في مشكلة في كذا',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();
    if (!text) return m.reply('اكتب البلاغ: `.report المشكلة أو الاقتراح`');

    if (!config.owners?.length) {
      return m.reply('📬 المالك مش متسجل لسه — صاحب البوت لازم يحط رقمه في الإعدادات');
    }

    const where = m.isGroup ? 'في جروب' : 'في الخاص';
    const msg = [
      '📣 *بلاغ جديد*',
      '',
      `👤 من: ${m.pushName} (${String(m.sender).split('@')[0]})`,
      `📍 ${where}`,
      '',
      text,
    ].join('\n');

    for (const owner of config.owners.slice(0, 3)) {
      await sock.sendMessage(`${String(owner).replace(/\D/g, '')}@s.whatsapp.net`, { text: msg }).catch(() => {});
    }
    return m.reply('✅ بلاغك وصل للمالك — شكرًا ليك!');
  },
};
