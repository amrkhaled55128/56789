import { sendText } from '../../core/send.js';
import { getSettings, updateSetting, isAdmin } from '../../core/protection.js';

// 💬 .aichat — وضع الشات الكامل: نوفا يرد على كل رسايل الجروب (للأدمن)
export default {
  name: 'aichat',
  aliases: ['شات-كامل', 'رد-عالكل'],
  description: 'تشغيل/قفل رد نوفا على كل رسايل الجروب — .aichat on | off',
  usage: '.aichat on',
  async execute(sock, m, args) {
    if (!(await isAdmin(sock, m.jid, m.sender))) return m.reply('🔐 الأمر ده للأدمن بس');
    const mode = (args[0] ?? '').toLowerCase();

    if (mode === 'on') {
      updateSetting(m.jid, 'aiChatAll', true);
      return sendText(sock, m.jid, '💬 اتفتح الشات الكامل! نوفا هيرد على كل الرسايل هنا.\n⚠️ لو زحمت أوي، اقفلوه بـ `.aichat off`');
    }
    if (mode === 'off') {
      updateSetting(m.jid, 'aiChatAll', false);
      return sendText(sock, m.jid, '🔇 الشات الكامل اتقفل — نوفا هيرد بس على المنشن والرد عليه.');
    }

    const s = getSettings(m.jid);
    return m.reply(`💬 الشات الكامل حاليًا: ${s.aiChatAll ? '✅ مفتوح (بيرد على الكل)' : '❌ مقفول (منشن/رد بس)'}\n\nغيّره بـ: \`.aichat on\` أو \`.aichat off\``);
  },
};
