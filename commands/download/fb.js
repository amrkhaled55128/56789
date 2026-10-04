import { sendVideo, sendText } from '../../core/send.js';
import api from '../../core/api.js';

// 📘 .fb — فيسبوك: فيديو من رابط
export default {
  name: 'fb',
  aliases: ['فيسبوك', 'فيس'],
  description: 'حمّل فيديو من فيسبوك — .fb <لينك>',
  usage: '.fb <لينك>',
  async execute(sock, m, args) {
    const link = (args.find((a) => /https?:\/\//i.test(a)) ?? m.message?.extendedTextMessage?.contextInfo?.text ?? '')
      .match(/https?:\/\/(?:www\.|m\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i)?.[0];

    if (!link) {
      return sendText(
        sock,
        m.jid,
        '📘 *تحميل فيسبوك*\n\nابعت اللينك: `.fb https://facebook.com/...`\n\n⚠️ لازم الفيديو يكون عام',
      );
    }

    await sendText(sock, m.jid, '⏳ بجيب الفيديو... استنى');
    const url = await api.tiktokDownload(link).catch(() => null);
    if (!url) {
      return m.reply('❌ مقدرتش أجيبه — تأكد إن الفيديو عام وجرّب تاني');
    }
    return sendVideo(sock, m.jid, url, '📘 اتحمّل من فيسبوك');
  },
};
