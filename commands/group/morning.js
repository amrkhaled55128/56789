import { sendText } from '../../core/send.js';
import { getSettings, updateSetting, isAdmin } from '../../core/protection.js';

// 🌅 .morning — الخدمات اليومية التلقائية للجروب (للأدمن)
// صباح الخير كل يوم 8 صباحًا + التحدي اليومي 10 صباحًا + صدارة الجمعة
export default {
  name: 'morning',
  aliases: ['صباح-تلقائي', 'يومي-تلقائي'],
  description: 'تشغيل/قفل رسائل الصباح والتحدي اليومي تلقائيًا — .morning on | off',
  usage: '.morning on',
  async execute(sock, m, args) {
    if (!(await isAdmin(sock, m.jid, m.sender))) return m.reply('🔐 الأمر ده للأدمن بس');
    const mode = (args[0] ?? '').toLowerCase();

    if (mode === 'on') {
      updateSetting(m.jid, 'morning', true);
      updateSetting(m.jid, 'questAuto', true);
      return sendText(sock, m.jid,
        '🌅 اتفتحت الخدمات اليومية!\n• صباح الخير تلقائيًا كل يوم 8 صباحًا ☀️\n• التحدي اليومي كل يوم 10 صباحًا 🎯\n• صدارة الأسبوع كل جمعة 8 مساءً 🏆\n\nاقفلهم بـ `.morning off`');
    }
    if (mode === 'off') {
      updateSetting(m.jid, 'morning', false);
      updateSetting(m.jid, 'questAuto', false);
      return sendText(sock, m.jid, '🔇 الخدمات اليومية اتقفلت.');
    }

    const s = getSettings(m.jid);
    return m.reply(`🌅 الخدمات اليومية: ${s.morning ? '✅ مفتوحة (صباح + تحدي + صدارة)' : '❌ مقفولة'}\n\nغيّرها بـ: \`.morning on\` أو \`.morning off\``);
  },
};
