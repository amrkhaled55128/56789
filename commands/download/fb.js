import axios from 'axios';
import { sendText } from '../../core/send.js';
import { downloadYoutube } from '../../core/yt.js';

// 📘 .فيسبوك (.fb) — تنزيل فيديو أو ريلز من فيسبوك بأعلى جودة
export default {
  name: 'fb',
  aliases: ['فيسبوك', 'فيس', 'facebook', 'fbdl'],
  description: 'حمّل أي فيديو أو ريلز من فيسبوك — .فيسبوك <الرابط>',
  usage: '.فيسبوك https://www.facebook.com/...',
  async execute(sock, m, args) {
    const raw = (args.find((a) => /https?:\/\//i.test(a)) ?? m.message?.extendedTextMessage?.contextInfo?.text ?? '');
    const link = raw.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i)?.[0];

    if (!link) {
      return sendText(
        sock,
        m.jid,
        '📘 *تحميل فيديو أو ريلز من فيسبوك*\n\nاكتب الأمر مع رابط الفيديو:\n`.فيسبوك https://www.facebook.com/watch?v=...`\n\n💡 تأكد أن الفيديو عام (Public) وليس في مجموعة سرية أو حساب مغلق.',
      );
    }

    await sendText(sock, m.jid, '⏳ جاري تنزيل فيديو فيسبوك... لحظات');

    // 1) المحاولة الأولى: عبر واجهة API السريعة
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(link)}`, {
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });

      if (res.data?.status && res.data.data?.downloads?.length) {
        const dls = res.data.data.downloads;
        const target = dls.find((d) => d.quality?.includes('720') || d.quality?.includes('HD')) ?? dls[0];
        if (target?.url) {
          const videoRes = await axios.get(target.url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });

          const buffer = Buffer.from(videoRes.data);
          if (buffer && buffer.length > 5000) {
            return await sock.sendMessage(m.jid, {
              video: buffer,
              mimetype: 'video/mp4',
              caption: `📘 *تم التحميل بنجاح من فيسبوك* ✨\n\n📌 *الجودة:* ${target.quality ?? 'HD'}\n⚡ بواسطة *استرو بـوت*`,
            }, { quoted: m.msg });
          }
        }
      }
    } catch (apiErr) {
      console.warn('⚠️ واجهة فيسبوك السريعة فشلت، جاري التحويل للمحرك الاحتياطي:', apiErr.message?.slice(0, 60));
    }

    // 2) المحاولة الاحتياطية: عبر yt-dlp المباشر
    try {
      const buffer = await downloadYoutube(link, 'video', { height: 720 });
      if (buffer && buffer.length > 5000) {
        return await sock.sendMessage(m.jid, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: '📘 *تم التحميل بنجاح من فيسبوك* ✨\n⚡ بواسطة *استرو بـوت*',
        }, { quoted: m.msg });
      }
    } catch (err) {
      console.error('❌ كل محاولات تحميل فيسبوك فشلت:', err.message?.slice(0, 80));
    }

    return m.reply('❌ تعذّر تحميل هذا الفيديو — يرجى التأكد من أن الرابط سليم وأن الفيديو عام ومش مقيد أو محذوف.');
  },
};
