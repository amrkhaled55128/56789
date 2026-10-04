import { sendText, sendVideo } from '../../core/send.js';
import api from '../../core/api.js';

// 📱 .tiktok — حمّل تيك توك من غير علامة مائية
export default {
  name: 'tiktok',
  aliases: ['تيك', 'تيك توك'],
  description: 'حمّل فيديو تيك توك من غير علامة مائية — .tiktok الرابط',
  usage: '.tiktok https://www.tiktok.com/@user/video/123',
  async execute(sock, m, args) {
    const url = args.find((a) => a.includes('tiktok.com') || a.includes('vt.'));
    if (!url) {
      return m.reply('📱 ابعت رابط التيك توك، مثال:\n`.tiktok https://www.tiktok.com/@user/video/123`');
    }
    await sendText(sock, m.jid, '⏳ بجهز التيك توك...');
    const videoUrl = await api.tiktokDownload(url);
    if (!videoUrl) throw new Error('مفيش رابط فيديو');
    return sendVideo(sock, m.jid, videoUrl, '📱 تيك توك — من غير علامة مائية ✨');
  },
};
