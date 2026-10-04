import { sendQuickReplies, sendImage } from '../../core/send.js';
import api from '../../core/api.js';
import { db } from '../../core/db.js';

// 📖 .novel — بحث روايات وات باد
function cache() {
  return db.get('searchCache', {});
}

export default {
  name: 'novel',
  aliases: ['رواية', 'روايات', 'واتباد'],
  description: 'دور على روايات — .novel كلمة البحث',
  usage: '.novel romance',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();

    const pick = /^d-(\d)$/.exec(text);
    if (pick) {
      const c = cache()[m.jid];
      const r = c?.type === 'novel' ? c.results?.[Number(pick[1])] : null;
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني');
      const text2 = [
        `📖 *${r.title}*`,
        `✍️ ${r.author ?? '—'}`,
        `📄 ${r.parts ?? '?'} جزء • ${r.completed ? 'مكتملة ✅' : 'مستمرة ⏳'}`,
        `👁️ ${(r.readCount ?? 0).toLocaleString()} قراءة`,
        '',
        r.description?.slice(0, 400) ?? '',
        '',
        r.url,
      ].join('\n');
      if (r.cover) return sendImage(sock, m.jid, r.cover, text2);
      return m.reply(text2);
    }

    if (!text) return m.reply('📖 اكتب كلمة البحث، مثال:\n`.novel romance`');

    const results = await api.wattpadSearch(text, 6);
    if (!results.length) return m.reply('😕 ملقيتش روايات — جرب كلمة تانية');

    const all = cache();
    all[m.jid] = { type: 'novel', results, at: Date.now() };
    db.set('searchCache', all);

    return sendQuickReplies(sock, m.jid, {
      title: '📖 روايات لقيتها',
      text: 'اختار واحدة تشوف تفاصيلها 👇',
      sections: [
        {
          title: 'النتايج',
          rows: results.map((r, i) => ({
            title: String(r.title).slice(0, 24),
            description: `${r.author ?? ''} • ${r.parts ?? '?'} جزء`,
            id: `.novel d-${i}`,
          })),
        },
      ],
      selectTitle: '📖 اختار رواية',
    });
  },
};
