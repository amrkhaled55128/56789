import axios from 'axios';
import { sendText } from '../../core/send.js';
import { downloadYoutube } from '../../core/yt.js';

// 📸 .انستا (.ig) — تنزيل ريلز وفيديوهات انستغرام
export default {
  name: 'ig',
  aliases: ['انستا', 'انستقرام', 'انستغرام', 'ريلز', 'insta', 'instagram'],
  description: 'حمّل ريلز أو فيديو من انستغرام — .انستا <الرابط>',
  usage: '.انستا https://www.instagram.com/reel/...',
  async execute(sock, m, args) {
    const raw = (args.find((a) => /https?:\/\//i.test(a)) ?? m.message?.extendedTextMessage?.contextInfo?.text ?? '');
    const link = raw.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[^\s/?#]+/i)?.[0];

    if (!link) {
      return sendText(
        sock,
        m.jid,
        '📸 *تحميل من انستغرام (Reels / Post)*\n\nابعت الأمر مع الرابط:\n`.انستا https://www.instagram.com/reel/...`\n\n💡 تأكد أن الحساب عام (Public).',
      );
    }

    await sendText(sock, m.jid, '⏳ جاري تنزيل ريلز انستغرام... لحظات');

    // 1) المحاولة الأولى: عبر واجهة السيرفر السريعة
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/d/ig?url=${encodeURIComponent(link)}`, {
        timeout: 20000,
      });

      const videoUrl = res.data?.data?.[0]?.url || res.data?.data?.url || res.data?.result?.[0]?.url;
      if (videoUrl) {
        const videoRes = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const buffer = Buffer.from(videoRes.data);
        if (buffer && buffer.length > 5000) {
          return await sock.sendMessage(m.jid, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: '📸 *تم التحميل بنجاح من انستغرام* ✨\n⚡ بواسطة *استرو بـوت*',
          }, { quoted: m.msg });
        }
      }
    } catch {}

    // 2) المحاولة الثانية: عبر yt-dlp
    try {
      const buffer = await downloadYoutube(link, 'video', { height: 720 });
      if (buffer && buffer.length > 5000) {
        return await sock.sendMessage(m.jid, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: '📸 *تم التحميل بنجاح من انستغرام* ✨\n⚡ بواسطة *استرو بـوت*',
        }, { quoted: m.msg });
      }
    } catch (err) {
      console.error('❌ فشل تحميل انستغرام:', err.message?.slice(0, 80));
    }

    return m.reply('❌ تعذّر تحميل هذا المقطع — تأكد أن الحساب عام وليس خاصاً أو محذوفاً.');
  },
};
