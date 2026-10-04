import { sendQuickReplies, sendText, sendImage } from '../../core/send.js';
import api from '../../core/api.js';
import { db } from '../../core/db.js';

// 📚 .manga — بحث مانجا ومانهوا بالتفاصيل والغلاف
function cache() {
  return db.get('searchCache', {});
}

export default {
  name: 'manga',
  aliases: ['مانجا', 'مانهوا'],
  description: 'دور على مانجا أو مانهوا — .manga اسمها',
  usage: '.manga solo leveling',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();

    const pick = /^d-(\d)$/.exec(text);
    if (pick) {
      const c = cache()[m.jid];
      const r = c?.type === 'manga' ? c.results?.[Number(pick[1])] : null;
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني');
      await sendText(sock, m.jid, '📚 بجهز التفاصيل...');
      const info = await api.manhwaInfo(r.slug);
      if (!info) return m.reply('😕 معرفتش أجيب التفاصيل');
      const cover = info.cover ?? r.poster?.medium;
      const text2 = [
        `📚 *${info.title}*`,
        info.author ? `✍️ ${info.author}` : '',
        `${info.type ?? ''} • ${info.status ?? ''} • ⭐ ${info.rating ?? '—'}`,
        info.genres ? `🎭 ${info.genres}` : '',
        '',
        info.synopsis?.slice(0, 500) ?? '',
      ].filter(Boolean).join('\n');
      if (cover) return sendImage(sock, m.jid, cover, text2);
      return m.reply(text2);
    }

    if (!text) return m.reply('📚 اكتب اسم المانهوا، مثال:\n`.manga solo leveling`');

    await sendText(sock, m.jid, `🔍 بدور على: *${text}*...`);
    const results = await api.manhwaSearch(text);
    if (!results.length) return m.reply('😕 ملقيتش حاجة — جرب اسم تاني');

    const all = cache();
    all[m.jid] = { type: 'manga', results, at: Date.now() };
    db.set('searchCache', all);

    return sendQuickReplies(sock, m.jid, {
      title: '📚 نتايج المانهوا',
      text: 'اختار واحدة تشوف تفاصيلها 👇',
      sections: [
        {
          title: 'النتايج',
          rows: results.slice(0, 8).map((r, i) => ({
            title: String(r.title).slice(0, 24),
            description: `⭐ ${r.rating ?? '—'} • ${r.status ?? ''}`,
            id: `.manga d-${i}`,
          })),
        },
      ],
      selectTitle: '📚 اختار مانجا',
    });
  },
};
