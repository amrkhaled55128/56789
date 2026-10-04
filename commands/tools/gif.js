import { sendQuickReplies, sendGif } from '../../core/send.js';
import api from '../../core/api.js';

// 🌀 .gif — ابحث عن GIF وابعتها متحركة
export default {
  name: 'gif',
  aliases: ['جيف', 'متحركة'],
  description: 'ابحث عن GIF متحركة — .gif الكلمة',
  usage: '.gif ضحك',
  async execute(sock, m, args) {
    const q = args.join(' ').trim() || 'funny';
    if (args.length === 0) {
      return sendQuickReplies(sock, m.jid, {
        title: '🌀 بحث GIF',
        text: 'اكتب: `.gif ضحك` — وهبعتلك متحركة عشوائية 😄',
        buttons: [
          { label: '😂 ضحك', id: '.gif laughing' },
          { label: '👏 تصفيق', id: '.gif applause' },
        ],
      });
    }
    // api.gifSearch بيرجّع الروابط زي ما هي — ممكن يكون فيها عنصر من غير url
    const urls = (await api.gifSearch(q, 5).catch(() => [])).filter(Boolean);
    if (!urls.length) return m.reply('😕 ملقيتش GIF — جرب كلمة تانية');
    const pick = urls[Math.floor(Math.random() * urls.length)];
    try {
      return await sendGif(sock, m.jid, pick, `🌀 ${q}`);
    } catch (err) {
      console.error('⚠️ فشل إرسال GIF:', err.message?.slice(0, 60));
      return m.reply('😕 واتساب رفض الـ GIF — جرب تاني');
    }
  },
};
