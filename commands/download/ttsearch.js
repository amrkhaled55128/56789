import { sendQuickReplies, sendText } from '../../core/send.js';
import { fetchMedia, toOggOpus } from '../../core/fetchmedia.js';
import api from '../../core/api.js';
import { db } from '../../core/db.js';

// 📱 .ttsearch — بحث في فيديوهات تيك توك وتنزيلها بدون علامة مائية
function cache() {
  return db.get('searchCache', {});
}

export default {
  name: 'ttsearch',
  aliases: ['بحث_تيك', 'تيك_سيرش', 'تيك_بحث', 'تيكتوك_بحث'],
  description: 'البحث عن مقاطع وفيديوهات تيك توك وتنزيلها فوراً — .ttsearch موضوع البحث',
  usage: '.ttsearch مقالب مصرية',
  async execute(sock, m, args, ctx) {
    const text = args.join(' ').trim();

    // اختيار وتنزيل فيديو: .ttsearch dl-<idx> أو dl-<idx>-audio
    const pick = /^dl-(\d+)(?:-(video|audio))?$/.exec(text);
    if (pick) {
      const c = cache()[m.jid];
      const r = c?.type === 'ttsearch' ? c.results?.[Number(pick[1])] : null;
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني: `.ttsearch كلمة البحث`');

      // لو لسه ما اختارش الصيغة
      if (!pick[2]) {
        return sendQuickReplies(sock, m.jid, {
          title: `📱 ${(r.desc || 'فيديو تيك توك').slice(0, 40)}`,
          text: `👤 الناشر: ${r.author?.name ?? 'مجهول'}\n👁️ المشاهدات: ${r.stats?.plays ?? ''}\n❤️ الإعجابات: ${r.stats?.likes ?? ''}\n\nاختار عايز تنزله فيديو ولا صوت 👇`,
          buttons: [
            { label: '🎬 فيديو بدون علامة', id: `.ttsearch dl-${pick[1]}-video` },
            { label: '🎧 صوت فقط MP3', id: `.ttsearch dl-${pick[1]}-audio` },
          ],
        });
      }

      const isAudio = pick[2] === 'audio';
      const targetUrl = isAudio
        ? (r.music?.download_url || r.video?.download_url)
        : (r.video?.download_url || r.video?.download_url_hd);

      if (!targetUrl) return m.reply('😵 تعذر استخراج رابط التحميل لهذا المقطع.');

      await sendText(sock, m.jid, `⏳ جاري جلب ${isAudio ? 'الصوت' : 'الفيديو'} من تيك توك...`);

      let buffer;
      try {
        buffer = await fetchMedia(targetUrl);
      } catch (err) {
        return m.reply('❌ فشل تنزيل المقطع، قد يكون محمي أو منتهي الصلاحية.');
      }

      const caption = `📱 *${(r.desc || 'TikTok Video').slice(0, 80)}*\n👤 ${r.author?.name ?? ''}`;

      if (isAudio) {
        const ogg = await toOggOpus(buffer).catch(() => null);
        return sock.sendMessage(m.jid, {
          audio: ogg ?? buffer,
          mimetype: ogg ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
          caption,
        });
      }

      return sock.sendMessage(m.jid, {
        video: buffer,
        mimetype: 'video/mp4',
        caption,
      });
    }

    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '📱 بحث تيك توك الرائج',
        text: 'اكتب كلمة أو موضوع للبحث في تيك توك، مثال:\n`.ttsearch غرائب وعجائب`\n\nوهعرضلك أهم الفيديوهات لتنزيلها بضغطة زر!',
        buttons: [
          { label: '🔥 مقالب', id: '.ttsearch مقالب مضحكة' },
          { label: '⚽ مهارات كورة', id: '.ttsearch مهارات كرة القدم' },
        ],
      });
    }

    await sendText(sock, m.jid, `🔍 بدور في تيك توك على: *${text}*...`);

    let results = [];
    try {
      results = await api.tiktokSearch(text);
    } catch (err) {
      return m.reply('😵 تعذر البحث في تيك توك حالياً، جرب تاني بعد شوية.');
    }

    if (!results.length) return m.reply('😕 ملقيتش أي فيديوهات مطابقة — جرب كلمات بحث تانية.');

    const all = cache();
    all[m.jid] = { type: 'ttsearch', results, at: Date.now() };
    db.set('searchCache', all);

    const summary = results
      .slice(0, 5)
      .map((r, i) => `${i + 1}. 🎬 *${(r.desc || 'فيديو').slice(0, 40)}* (👤 ${r.author?.name ?? ''})`)
      .join('\n');

    return sendQuickReplies(sock, m.jid, {
      title: '📱 نتائج تيك توك',
      text: `${summary}\n\nاختار المقطع اللي عايز تحمّله من القائمة 👇`,
      sections: [
        {
          title: 'فيديوهات تيك توك المتاحة',
          rows: results.slice(0, 8).map((r, i) => ({
            title: `🎬 فيديو ${i + 1}`,
            description: String(r.desc || r.author?.name || 'بدون وصف').slice(0, 40),
            id: `.ttsearch dl-${i}`,
          })),
        },
      ],
      selectTitle: '📥 اختر فيديو للتحميل',
    });
  },
};
