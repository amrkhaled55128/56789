import { sendQuickReplies, sendText, sendImage } from '../../core/send.js';
import axios from 'axios';
import { db } from '../../core/db.js';

// 📌 .pin — صور بينترست بالبحث + أزرار اختيار
const BASE = 'https://engez.a7a.online';

function cache() {
  return db.get('searchCache', {});
}

export default {
  name: 'pin',
  aliases: ['بينترست', 'صور'],
  description: 'دور على صور في بينترست — .pin الكلمة',
  usage: '.pin ديكور مطبخ',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();

    const pick = /^img-(\d)$/.exec(text);
    if (pick) {
      const c = cache()[m.jid];
      const r = c?.type === 'pin' ? c.results?.[Number(pick[1])] : null;
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني: `.pin كلمة`');
      return sendImage(sock, m.jid, r.image, `📌 ${r.title ?? ''}`);
    }

    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '📌 صور بينترست',
        text: 'اكتب: `.pin ديكور مطبخ` — وهجيبلك صور تختار منها',
        buttons: [
          { label: '🏠 ديكور', id: '.pin ديكور مطبخ' },
          { label: '⚽ كورة', id: '.pin كورة القدم' },
        ],
      });
    }

    await sendText(sock, m.jid, `📌 بدور على: *${text}*...`);
    const { data } = await axios.get(`${BASE}/api/v1/search/pinimg`, { params: { q: text, limit: 6 }, timeout: 30000 });
    const results = (data?.results ?? []).filter((r) => r.image);
    if (!results.length) return m.reply('😕 ملقيتش صور — جرب كلمات تانية');

    const all = cache();
    all[m.jid] = { type: 'pin', results, at: Date.now() };
    db.set('searchCache', all);

    await sendQuickReplies(sock, m.jid, {
      title: '📌 اختار صورة',
      text: results.slice(0, 3).map((r, i) => `${i + 1}. ${r.title ?? r.description ?? 'صورة'}`).join('\n') + '\n\nاختار من القائمة 👇',
      sections: [
        {
          title: 'نتايج البحث',
          rows: results.slice(0, 8).map((r, i) => ({
            title: `📌 صورة ${i + 1}`,
            description: String(r.title ?? r.description ?? 'بدون عنوان').slice(0, 40),
            id: `.pin img-${i}`,
          })),
        },
      ],
      selectTitle: '🖼️ اختار صورة',
    });
  },
};
