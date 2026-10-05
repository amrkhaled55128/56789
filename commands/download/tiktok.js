import axios from 'axios';
import { sendText, sendVideo } from '../../core/send.js';
import { downloadYoutube } from '../../core/yt.js';

// 📱 .تيكتوك (.tiktok) — تنزيل فيديو تيك توك بدون علامة مائية
export default {
  name: 'tiktok',
  aliases: ['تيكتوك', 'تيك', 'تيك_توك', 'tt'],
  description: 'حمّل فيديو تيك توك بدون علامة مائية — .تيكتوك <الرابط>',
  usage: '.تيكتوك https://www.tiktok.com/@user/video/123',
  async execute(sock, m, args) {
    const raw = (args.find((a) => a.includes('tiktok.com') || a.includes('vt.') || a.includes('vm.')) ??
      m.message?.extendedTextMessage?.contextInfo?.text ?? '');
    let url = raw.match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i)?.[0];

    if (!url) {
      return m.reply('📱 ابعت رابط تيك توك صالح، مثال:\n`.تيكتوك https://vm.tiktok.com/.../`');
    }

    await sendText(sock, m.jid, '⏳ جاري تنزيل فيديو تيك توك بدون علامة مائية...');

    // فك اختصار الرابط إذا كان vm.tiktok أو vt.tiktok
    try {
      if (url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com')) {
        const head = await axios.get(url, {
          maxRedirects: 5,
          timeout: 10000,
          validateStatus: () => true,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        const finalUrl = head.request?.res?.responseUrl || head.config?.url;
        if (finalUrl && finalUrl.includes('/video/')) {
          url = finalUrl;
        }
      }
    } catch {}

    // 1) المحاولة الأولى: عبر واجهة TikWM السريعة بدون علامة مائية
    try {
      const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (res.data?.code === 0 && res.data.data) {
        const d = res.data.data;
        const playUrl = d.play || d.hdplay || d.wmplay;
        if (playUrl) {
          const videoRes = await axios.get(playUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          const buffer = Buffer.from(videoRes.data);
          if (buffer && buffer.length > 5000) {
            return await sock.sendMessage(m.jid, {
              video: buffer,
              mimetype: 'video/mp4',
              caption: `📱 *تيك توك — بدون علامة مائية* ✨\n\n👤 *الناشر:* ${d.author?.nickname ?? d.author?.unique_id ?? 'مجهول'}\n💬 *الوصف:* ${(d.title ?? '').slice(0, 80)}\n⚡ بواسطة *استرو بـوت*`,
            }, { quoted: m.msg });
          }
        }
      }
    } catch (tikErr) {
      console.warn('⚠️ TikWM فشل، جاري المحاولة بالمصادر الاحتياطية:', tikErr.message?.slice(0, 60));
    }

    // 2) المحاولة الثانية: عبر Siputzx TikTok
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, {
        timeout: 15000,
      });
      const videoUrl = res.data?.data?.urls?.[0] || res.data?.data?.nowatermark || res.data?.data?.video;
      if (videoUrl) {
        return await sendVideo(sock, m.jid, videoUrl, '📱 تيك توك — بدون علامة مائية ✨');
      }
    } catch {}

    // 3) المحاولة الثالثة: عبر yt-dlp المحلي
    try {
      const buffer = await downloadYoutube(url, 'video', { height: 720 });
      if (buffer && buffer.length > 5000) {
        return await sock.sendMessage(m.jid, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: '📱 *تيك توك — تم التحميل بنجاح* ✨\n⚡ بواسطة *استرو بـوت*',
        }, { quoted: m.msg });
      }
    } catch (err) {
      console.error('❌ كل مصادر تحميل تيك توك فشلت:', err.message?.slice(0, 80));
    }

    return m.reply('❌ تعذّر تحميل هذا الفيديو — يرجى التأكد من أن الرابط سليم والحساب عام وغير مقيّد.');
  },
};
