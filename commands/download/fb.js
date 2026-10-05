import { sendText } from '../../core/send.js';
import { downloadYoutube } from '../../core/yt.js';

// 📘 .fb — فيسبوك: فيديو من رابط
export default {
  name: 'fb',
  aliases: ['فيسبوك', 'فيس', 'facebook', 'fbdl'],
  description: 'حمّل فيديو أو ريلز من فيسبوك — .fb <الرابط>',
  usage: '.fb https://facebook.com/...',
  async execute(sock, m, args) {
    const link = (args.find((a) => /https?:\/\//i.test(a)) ?? m.message?.extendedTextMessage?.contextInfo?.text ?? '')
      .match(/https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i)?.[0];

    if (!link) {
      return sendText(
        sock,
        m.jid,
        '📘 *تحميل فيديو أو ريلز من فيسبوك*\n\nابعت الأمر مع الرابط:\n`.fb https://www.facebook.com/watch?v=...`\n\n⚠️ تأكد أن الفيديو عام (Public) وليس في مجموعة خاصة.',
      );
    }

    await sendText(sock, m.jid, '⏳ جاري تنزيل فيديو فيسبوك... استنى لحظات');

    try {
      const buffer = await downloadYoutube(link, 'video', { height: 720 });
      if (!buffer || buffer.length < 1000) {
        throw new Error('الملف فارغ أو غير متاح');
      }

      return await sock.sendMessage(m.jid, {
        video: buffer,
        mimetype: 'video/mp4',
        caption: '📘 تم التحميل بنجاح من فيسبوك ✨',
      }, { quoted: m.msg });
    } catch (err) {
      console.error('❌ فشل تحميل فيسبوك:', err.message?.slice(0, 80));
      return m.reply('❌ مقدرتش أحمل الفيديو ده — تأكد أن الرابط سليم والفيديو عام مش خاص أو محذوف.');
    }
  },
};
