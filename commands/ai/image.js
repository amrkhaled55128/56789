import { sendQuickReplies, sendText, sendImage } from '../../core/send.js';
import api from '../../core/api.js';

export default {
  name: 'image',
  aliases: ['صورة', 'ارسم'],
  description: 'توليد صورة بالذكاء الاصطناعي — .image وصف الصورة',
  usage: '.image قطة فضائية',
  async execute(sock, m, args) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return sendQuickReplies(sock, m.jid, {
        title: '🎨 صانع الصور بالذكاء الاصطناعي',
        text: 'اكتب وصف الصورة بعد الأمر، مثال:\n`.image قطة بتشرب شاي على سطح بيت في القاهرة`',
        buttons: [
          { label: '🐱 قطة فضائية', id: '.image قطة فضائية ترتدي بدلة فضاء' },
          { label: '🏰 قلعة سحرية', id: '.image قلعة سحرية في الغابة وقت الغروب' },
        ],
      });
    }

    await sendText(sock, m.jid, '🎨 بجهز الصورة... استنى شوية');
    const url = await api.image(prompt);
    if (!url) throw new Error('فشل توليد الصورة');

    await sendImage(sock, m.jid, url, `🖼️ ${prompt}`);

    const btnPrompt = prompt.length > 80 ? prompt.slice(0, 80) : prompt;
    await sendQuickReplies(sock, m.jid, {
      title: '🎨 خيارات إضافية للصورة',
      text: 'تم توليد الصورة بنجاح! تقدر تحولها لفيديو أو ترسم نسخة ثانية:',
      buttons: [
        { label: '🎬 تحويل إلى فيديو', id: `.video ${btnPrompt}` },
        { label: '🎨 رسم نسخة ثانية', id: `.image ${btnPrompt}` },
      ],
    });
  },
};
