import { sendImage, sendText } from '../../core/send.js';
import { getMediaSource, uploadBuffer } from '../../core/media.js';
import api from '../../core/api.js';

// ✂️ .removebg — شيل خلفية أي صورة
// (api.removeBg كان مكتوب وشغال ومفيش ولا أمر بيستدعيه)
export default {
  name: 'removebg',
  aliases: ['احذف_الخلفية', 'شيل_الخلفية', 'خلفيه'],
  description: 'شيل خلفية الصورة — رد على صورة بـ .removebg',
  usage: '.removebg  (رد على صورة)',
  async execute(sock, m, args) {
    const src = await getMediaSource(m);
    if (!src) return m.reply('📷 رد على صورة: `.removebg`');
    if (src.error) return m.reply(`❌ ${src.error}`);
    if (src.kind === 'sticker') return m.reply('❌ ده ملصق — شيل الخلفية من صورة عادية');

    await sendText(sock, m.jid, '✂️ بشيل الخلفية... استنى ثانية');

    const url = await uploadBuffer(src.buffer, 'img.jpg', 'image/jpeg');
    if (!url) return m.reply('❌ مقدرتش أرفع الصورة — جرب تانية');

    const out = await api.removeBg(url);
    if (!out) return m.reply('🤔 مقدرش أشيل الخلفية من دي — جرب صورة أوضح ومن غير نص عليها');

    return sendImage(sock, m.jid, out, '✂️ اتشالت الخلفية');
  },
};
