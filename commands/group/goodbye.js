import { sendText } from '../../core/send.js';
import { getSettings, updateSetting, isAdmin } from '../../core/protection.js';

// 😢 .goodbye — رسالة خروج الأعضاء
export default {
  name: 'goodbye',
  aliases: ['وداع', 'الوداع'],
  description: 'تحديد رسالة الخروج — .goodbye النص | .goodbye off',
  usage: '.goodbye باي باي {user}',
  async execute(sock, m, args) {
    if (!(await isAdmin(sock, m.jid, m.sender))) return m.reply('🔐 الأمر ده للأدمن بس');
    const text = args.join(' ').trim();
    if (!text) {
      const s = getSettings(m.jid);
      return m.reply(`😢 رسالة الخروج:\n${s.goodbyeText}\n\nغيّرها بـ: \`.goodbye باي باي {user}\``);
    }
    if (text === 'off') {
      const s = updateSetting(m.jid, 'goodbyeText', '');
      return m.reply('✅ رسالة الخروج اتلغت');
    }
    updateSetting(m.jid, 'goodbyeText', text);
    return m.reply('✅ رسالة الخروج اتحدثت!');
  },
};
