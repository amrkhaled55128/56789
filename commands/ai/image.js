import { sendText, sendImage } from '../../core/send.js';
import api from '../../core/api.js';

export default {
  name: 'image',
  aliases: ['صورة', 'ارسم'],
  description: 'توليد صورة بالذكاء الاصطناعي — .image وصف الصورة',
  usage: '.image قطة فضائية',
  async execute(sock, m, args) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return m.reply('🎨 اكتب وصف الصورة، مثال:\n`.image قطة بتشرب شاي على سطح بيت في القاهرة`');
    }
    await sendText(sock, m.jid, '🎨 بجهز الصورة... استنى شوية');
    const url = await api.image(prompt, { pretty: false });
    if (!url) throw new Error('فشل التوليد');
    await sendImage(sock, m.jid, url, `🖼️ ${prompt}`);
  },
};
