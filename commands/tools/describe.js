import { sendImage, sendText } from '../../core/send.js';
import { getMediaSource, uploadBuffer } from '../../core/media.js';
import api from '../../core/api.js';

// 👁️ .describe — اقرأ الصورة/السكرين شوت بالذكاء الاصطناعي
// (api.img2prompt كان مكتوب وشغال من زمان ومفيش ولا أمر بيستدعيه)
export default {
  name: 'describe',
  aliases: ['وصف', 'اقرا', 'شوف_الصوره', 'ايه_دي'],
  description: 'اقرأ أي صورة أو سكرين شوت — رد على الصورة بـ .describe',
  usage: '.describe  (رد على صورة)',
  async execute(sock, m, args) {
    const src = await getMediaSource(m);
    if (!src) return m.reply('📷 رد على صورة أو سكرين شوت: `.describe`');
    if (src.error) return m.reply(`❌ ${src.error}`);

    await sendText(sock, m.jid, '👁️ بصّيت على الصورة... استنى ثانية');

    const url = await uploadBuffer(src.buffer, 'shot.jpg', 'image/jpeg');
    if (!url) return m.reply('❌ مقدرتش أرفع الصورة — جرب تانية');

    const res = await api.img2prompt(url);
    if (!res.arabic && !res.english) {
      return m.reply('🤔 مش فاهم الصورة — جرب صورة أوضح');
    }

    return sendText(
      sock,
      m.jid,
      `👁️ *وصف الصورة:*\n\n${res.arabic || res.english}\n\n_(وصف بالذكاء الاصطناعي — ممكن يكون مش دقيق)_`,
    );
  },
};
