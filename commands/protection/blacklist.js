import { requireAdmin } from '../../core/groupadmin.js';
import { getSettings, updateSetting } from '../../core/protection.js';
import { sendQuickReplies } from '../../core/send.js';

// 🚫 .blacklist — كلمات ممنوعة في الجروب
// .blacklist add كلمة  |  .blacklist remove كلمة  |  .blacklist list
export default {
  name: 'blacklist',
  aliases: ['كلمات_ممنوعه', 'الكلمات_الممنوعه'],
  description: 'كلمات ممنوعة في الجروب — .blacklist add كلمة',
  usage: '.blacklist add كلمة',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'القائمة السوداء')) return;

    const sub = (args[0] ?? 'list').toLowerCase();
    const s = getSettings(m.jid);
    const words = s.badwords ?? [];

    if (sub === 'list') {
      if (!words.length) {
        return m.reply(
          '📋 مفيش كلمات ممنوعة.\nضيف واحدة: `.blacklist add الكلمة`\n' +
          '⚠️ لازم تفعّل antibad الأول: `.gsettings antibad on`',
        );
      }
      return sendQuickReplies(sock, m.jid, {
        title: `🚫 الكلمات الممنوعة (${words.length})`,
        text: words.map((w) => `• ${w}`).join('\n'),
        buttons: [{ label: '🧹 نضف الكل', id: '.blacklist clear' }],
      });
    }

    if (sub === 'clear') {
      if (!words.length) return m.reply('مفيش حاجة تنضف 🤷');
      updateSetting(m.jid, 'badwords', []);
      return m.reply(`🧹 اتمسحت كل الكلمات الممنوعة (${words.length})`);
    }

    const word = args.slice(1).join(' ').trim();
    if (!word) return m.reply('اكتب الكلمة: `.blacklist add الكلمة`');
    if (word.length > 30) return m.reply('📏 الكلمة طويلة — 30 حرف كحد أقصى');

    if (sub === 'add') {
      if (words.some((w) => w.toLowerCase() === word.toLowerCase())) {
        return m.reply(`"${word}" موجودة خلاص 🤷`);
      }
      words.push(word);
      updateSetting(m.jid, 'badwords', words);
      if (!s.antibad) {
        return m.reply(
          `✅ ضفت "${word}" للقائمة\n⚠️ بس antibad مطفي — فعّلها: \`.gsettings antibad on\``,
        );
      }
      return m.reply(`✅ ضفت "${word}" — أي حد يكتبها هتتمسح وتتلمس إنذار 🚫`);
    }

    if (sub === 'remove' || sub === 'del') {
      const i = words.findIndex((w) => w.toLowerCase() === word.toLowerCase());
      if (i === -1) return m.reply(`"${word}" مش في القائمة 🤷`);
      words.splice(i, 1);
      updateSetting(m.jid, 'badwords', words);
      return m.reply(`🧹 شلت "${word}" من القائمة`);
    }

    return m.reply(
      '📖 الاستخدام:\n' +
        '`.blacklist add كلمة` — تضيف\n' +
        '`.blacklist remove كلمة` — تشيل\n' +
        '`.blacklist list` — تشوف\n' +
        '`.blacklist clear` — تنضف الكل',
    );
  },
};
