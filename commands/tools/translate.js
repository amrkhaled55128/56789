import { sendQuickReplies } from '../../core/send.js';
import api from '../../core/api.js';

// 🌐 .translate — ترجمة فورية لأكتر من 100 لغة
export default {
  name: 'translate',
  aliases: ['ترجم', 'ترجمة'],
  description: 'ترجمة نصوص — .translate النص  أو  .translate en النص (لغة معينة)',
  usage: '.translate النص  أو  .translate en hello',
  async execute(sock, m, args) {
    let text = args.join(' ').trim();
    let to = 'ar';
    const langMatch = /^([a-z]{2,3})\s+/i.exec(text);
    if (langMatch) {
      to = langMatch[1].toLowerCase();
      text = text.slice(langMatch[0].length);
    }
    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '🌐 الترجمة الفورية',
        text: 'اكتب: `.translate النص` (بيترجم للعربي)\nولغة معينة: `.translate en النص`\n\nأكواد اللغات: en • fr • de • es • tr • ru',
        buttons: [
          { label: '🇬🇧 عينة', id: '.translate Good morning my friend' },
          { label: '🇫🇷 عينة فرنسي', id: '.translate fr Je t\'aime' },
        ],
      });
    }
    if (text.length > 1500) return m.reply('🤐 النص طويل أوي — خليه أقصر من 1500 حرف');
    const res = await api.translate(text, to);
    if (!res.translated) return m.reply('❌ معرفتش أترجم — جرب تاني');
    return m.reply(`🌐 *الترجمة* (${res.from} → ${to}):\n\n${res.translated}`);
  },
};
