import { sendText, sendVideo } from '../../core/send.js';
import api from '../../core/api.js';

export default {
  name: 'video',
  aliases: ['فيديو'],
  description: 'توليد فيديو قصير بالذكاء الاصطناعي — .video وصف المشهد',
  usage: '.video قطة بتجري في الحديقة',
  async execute(sock, m, args) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return m.reply('🎬 اكتب وصف المشهد، مثال:\n`.video قطة بتلعب كورة في الشارع`');
    }
    await sendText(sock, m.jid, '🎬 بجهز الفيديو (5 ثواني)... استنى شوية');
    const url = await api.video(prompt);
    if (!url) throw new Error('فشل التوليد');
    await sendVideo(sock, m.jid, url, `🎬 ${prompt}`);
  },
};
