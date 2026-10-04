import { sendVideo, sendImage, sendText } from '../../core/send.js';
import api from '../../core/api.js';

// 📥 .ig — إنستجرام: بوست / ريلز / ستوري
// `.ig <لينك>` — وكمان بيقرا أي لينك إنستجرام لو حد بعتاله في الشات
export default {
  name: 'ig',
  aliases: ['انستجرام', 'انستا', 'ig', 'reels', 'ريلز'],
  description: 'حمّل بوست/ريلز/ستوري من إنستجرام — .ig <لينك>',
  usage: '.ig <لينك>',
  async execute(sock, m, args) {
    const link = (args.find((a) => /https?:\/\//i.test(a)) ?? m.message?.extendedTextMessage?.contextInfo?.text ?? '')
      .match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i)?.[0];

    if (!link) {
      return sendText(
        sock,
        m.jid,
        '📸 *تحميل إنستجرام*\n\n' +
          'ابعت اللينك: `.ig https://instagram.com/p/XXXX`\n' +
          'أو ابعت اللينك في الشات واكتب `.ig`\n\n' +
          'يدعم: البوستات • الريلز • الستوري',
      );
    }

    await sendText(sock, m.jid, '⏳ بجيب الفيديو... استنى');
    const url = await api.tiktokDownload(link).catch(() => null);
    if (!url) {
      return m.reply(
        '❌ مقدرتش أجيبه من اللينك ده.\n' +
          '💡 تأكد إن البوست عام، أو جرّب تبعتلي اللينك في الشات على طول',
      );
    }
    return sendVideo(sock, m.jid, url, '📸 اتحمّل من إنستجرام');
  },
};
