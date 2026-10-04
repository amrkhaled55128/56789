import { sendText } from '../../core/send.js';
import { getSettings, updateSetting, isAdmin } from '../../core/protection.js';

// 👋 .welcome — تحديد رسالة الترحيب/الوداع
// المتغيرات: {user} = اسم العضو، {group} = اسم الجروب
export default {
  name: 'welcome',
  aliases: ['ترحيب', 'الترحيب'],
  description: 'تحديد رسالة الترحيب — .welcome النص | .welcome off | .welcome on',
  usage: '.welcome أهلاً {user} في جروبنا!',
  async execute(sock, m, args) {
    if (!(await isAdmin(sock, m.jid, m.sender))) return m.reply('🔐 الأمر ده للأدمن بس');
    const text = args.join(' ').trim();

    if (!text) {
      const s = getSettings(m.jid);
      return sendText(
        sock,
        m.jid,
        [
          `👋 الترحيب حاليًا: ${s.welcome ? '✅ شغال' : '❌ مقفول'}`,
          '',
          `📝 الرسالة الحالية:\n${s.welcomeText}`,
          '',
          '• `.welcome النص` — تغيير الرسالة',
          '• المتغيرات: {user} و {group}',
          '• `.welcome off` / `.welcome on`',
          '• `.goodbye نص` — رسالة الخروج',
        ].join('\n'),
      );
    }

    if (text === 'off') {
      updateSetting(m.jid, 'welcome', false);
      return m.reply('❌ الترحيب اتقفل');
    }
    if (text === 'on') {
      updateSetting(m.jid, 'welcome', true);
      return m.reply('✅ الترحيب اشتغل');
    }

    updateSetting(m.jid, 'welcomeText', text);
    updateSetting(m.jid, 'welcome', true);
    const preview = text
      .replaceAll('{user}', '@' + m.sender.split('@')[0])
      .replaceAll('{group}', 'اسم الجروب');
    return sendText(sock, m.jid, `✅ رسالة الترحيب اتحدثت!\n\nمعاينة:\n${preview}`, {
      mentions: [m.sender],
    });
  },
};
