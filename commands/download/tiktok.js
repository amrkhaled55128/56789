import { sendText, sendVideo } from '../../core/send.js';
import api from '../../core/api.js';
import { downloadYoutube } from '../../core/yt.js';

// 📱 .tiktok — حمّل تيك توك من غير علامة مائية
export default {
  name: 'tiktok',
  aliases: ['تيك', 'تيكتوك', 'تيك_توك', 'tt'],
  description: 'حمّل فيديو تيك توك بدون علامة مائية — .tiktok الرابط',
  usage: '.tiktok https://www.tiktok.com/@user/video/123',
  async execute(sock, m, args) {
    const url = (args.find((a) => a.includes('tiktok.com') || a.includes('vt.')) ??
      m.message?.extendedTextMessage?.contextInfo?.text ?? '')
      .match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i)?.[0];

    if (!url) {
      return m.reply('📱 ابعت رابط تيك توك صالح، مثال:\n`.tiktok https://vm.tiktok.com/ZM.../`');
    }

    await sendText(sock, m.jid, '⏳ جاري تنزيل فيديو تيك توك...');

    // 1) المحاولة الأولى: عبر API تيك توك السريع
    try {
      const videoUrl = await api.tiktokDownload(url);
      if (videoUrl) {
        return await sendVideo(sock, m.jid, videoUrl, '📱 تيك توك — بدون علامة مائية ✨');
      }
    } catch (err) {
      console.warn('⚠️ API تيك توك فشل، جاري المحاولة بـ yt-dlp الاحتياطي:', err.message?.slice(0, 60));
    }

    // 2) المحاولة الاحتياطية القوية: عبر yt-dlp المحلي
    try {
      const buffer = await downloadYoutube(url, 'video', { height: 720 });
      if (buffer && buffer.length > 1000) {
        return await sock.sendMessage(m.jid, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: '📱 تيك توك — تم التحميل بنجاح ✨',
        }, { quoted: m.msg });
      }
    } catch (err) {
      console.error('❌ كل مصادر تحميل تيك توك فشلت:', err.message?.slice(0, 80));
    }

    return m.reply('❌ تعذّر تحميل هذا الفيديو — تأكد أن الحساب والرابط عام وغير مقيد جغرافياً.');
  },
};
