import { sendText } from '../../core/send.js';
import { getMediaSource, toStickerWebp } from '../../core/media.js';
import { bump } from '../../core/stats.js';

// 🏷️ .sticker — حول أي صورة أو فيديو قصير لملصق
// اعمل رد على الصورة/الفيديو واكتب .sticker — أو ابعت صورة وكابشن .sticker
export default {
  name: 'sticker',
  aliases: ['ستيكر', 'ملصق', 's'],
  description: 'حوّل صورة أو فيديو قصير (8 ثواني) لملصق — اعمل رد على الوسائط واكتب .sticker',
  usage: '.sticker',
  async execute(sock, m) {
    await sendText(sock, m.jid, '🏷️ بجهز الملصق...');
    const media = await getMediaSource(m);
    if (!media) {
      return m.reply('ابعت صورة أو فيديو قصير الأول، وبعدها اعمل *رد* على الوسائط واكتب `.sticker`');
    }
    if (media.error) return m.reply(`⚠️ ${media.error}`);

    const webp = await toStickerWebp(media.buffer, media.kind);
    bump('stickers');
    if (media.kind === 'sticker') {
      // ملصق أصلاً — نبعته زي ما هو
      return sock.sendMessage(m.jid, { sticker: media.buffer });
    }
    return sock.sendMessage(m.jid, { sticker: webp });
  },
};
