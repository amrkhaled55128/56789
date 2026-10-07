import { sendImage, sendText, sendQuickReplies } from '../../core/send.js';
import api from '../../core/api.js';

// 🎬 .akwam — البحث عن أحدث الأفلام والمسلسلات وروابط التحميل المباشرة
export default {
  name: 'akwam',
  aliases: ['اكوام', 'فيلم', 'مسلسل', 'افلام'],
  description: 'البحث عن أحدث الأفلام والمسلسلات وروابط التحميل المباشرة من موقع أكوام — .akwam <اسم الفيلم>',
  usage: '.akwam <اسم الفيلم أو المسلسل>',
  async execute(sock, m, args) {
    const query = args.join(' ').trim();
    if (!query) {
      return m.reply(
        '🎬 *البحث في موقع أكوام (أفلام ومسلسلات)*\n\n' +
        'اكتب اسم الفيلم أو المسلسل للحصول على التفاصيل وروابط المشاهدة والتحميل:\n' +
        '`.akwam <اسم الفيلم أو المسلسل>`\n\n' +
        '💡 *أمثلة:*\n' +
        '• `.akwam Batman`\n' +
        '• `.akwam Spider-Man`\n' +
        '• `.akwam Game of Thrones`'
      );
    }

    await sendText(sock, m.jid, `🔍 جاري البحث في موقع أكوام عن: *${query}*...`);

    try {
      const results = await api.vexAkwam(query);
      if (!results || !results.length) {
        return m.reply(`❌ لم يتم العثور على أي نتائج في موقع أكوام لـ: "${query}".`);
      }

      const top = results[0];

      let caption = `🎬 *${top.title}*\n\n`;
      if (top.type) caption += `📌 النوع: ${top.type}\n`;
      if (top.year) caption += `📅 سنة الإنتاج: ${top.year}\n`;
      if (top.rating) caption += `⭐ التقييم: ${top.rating}/10\n`;
      if (top.quality) caption += `🎞️ الجودة: ${top.quality}\n`;
      if (top.url) caption += `🔗 رابط المشاهدة والتحميل المباشر:\n${top.url}\n`;

      if (results.length > 1) {
        caption += `\n🍿 *نتائج أخرى ذات صلة:*\n`;
        results.slice(1, 5).forEach((item, idx) => {
          const yr = item.year ? ` (${item.year})` : '';
          const q = item.quality ? ` [${item.quality}]` : '';
          caption += `• *${item.title}*${yr}${q}\n  🔗 ${item.url}\n`;
        });
      }

      if (top.poster) {
        try {
          await sendImage(sock, m.jid, top.poster, caption.trim());
        } catch {
          await sendText(sock, m.jid, caption.trim());
        }
      } else {
        await sendText(sock, m.jid, caption.trim());
      }

      if (top.url) {
        await sendQuickReplies(sock, m.jid, {
          text: '🍿 رابط المشاهدة المباشر:',
          buttons: [
            { label: '🔗 نسخ رابط المشاهدة', id: `copy:${top.url}` },
          ],
        }).catch(() => {});
      }
    } catch (err) {
      console.error('❌ خطأ في بحث أكوام:', err.message?.slice(0, 80));
      return m.reply('❌ حدث خطأ أثناء البحث في موقع أكوام، يرجى المحاولة لاحقاً.');
    }
  },
};
