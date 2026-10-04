import { sendText } from '../../core/send.js';
import { isOwner } from '../../lib/utils.js';
import { db } from '../../core/db.js';
import { config } from '../../config.js';

// 🟢 .boton — تشغيل البوت في شات (للمالك، أو الأدمن لو الجروب مقفول مش بيدخل من غيره)
export default {
  name: 'boton',
  aliases: ['شغلبوت'],
  description: 'تشغيل البوت في الشات الحالي',
  usage: '.boton',
  async execute(sock, m) {
    const all = db.get('botOff', {});
    if (!all[m.jid]) return m.reply('⚡ البوت شغال هنا خلاص');
    if (!isOwner(m, config)) return m.reply('🔐 اقفلته الأدمن — هتفتحه للمالك بس');
    delete all[m.jid];
    db.set('botOff', all);
    return sendText(sock, m.jid, '⚡ البوت اشتغل تاني هنا!');
  },
};
