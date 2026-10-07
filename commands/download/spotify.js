import { sendQuickReplies, sendText, sendImage } from '../../core/send.js';
import api from '../../core/api.js';
import { db } from '../../core/db.js';

// 🎵 .spotify — بحث وعرض تراكات سبوتيفاي مع أزرار التحميل المباشر
function cache() {
  return db.get('searchCache', {});
}

export default {
  name: 'spotify',
  aliases: ['سبوتيفاي', 'سبوتفاي'],
  description: 'ابحث عن أي تراك في سبوتيفاي مع صورة الغلاف وتنزيل الصوت — .spotify اسم الأغنية',
  usage: '.spotify عمرو دياب مكانك',
  async execute(sock, m, args, ctx) {
    const text = args.join(' ').trim();

    // اختيار تراك من النتايج المحفوظة: .spotify pick-<رقم>
    const pick = /^pick-(\d+)$/.exec(text);
    if (pick) {
      const c = cache()[m.jid];
      const r = c?.type === 'spotify' ? c.results?.[Number(pick[1])] : null;
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني: `.spotify اسم الأغنية`');

      const caption =
        `🎵 *${r.name ?? 'تراك سبوتيفاي'}*\n` +
        `👤 الفنان: *${r.artist ?? 'غير معروف'}*\n` +
        `💿 الألبوم: ${r.album ?? 'ألبوم منفرد'}\n` +
        `🕒 المدة: ${r.duration ?? ''}\n` +
        `🔗 الرابط: ${r.url ?? ''}`;

      return sendQuickReplies(sock, m.jid, {
        title: `🎵 ${String(r.name).slice(0, 40)}`,
        text: caption,
        buttons: [
          { label: '🎧 تنزيل الأغنية صوت', id: `.song ${r.name} ${r.artist}` },
          { label: '📋 بحث آخر', id: '.spotify' },
        ],
      });
    }

    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '🎵 بحث سبوتيفاي الرسمي',
        text: 'اكتب اسم الأغنية أو التراك، مثال:\n`.spotify عمرو دياب انت الحظ`\n\nوهجيبلك التراك الرسمي ببياناته وزر لتحميله فوراً!',
        buttons: [
          { label: '🎤 عمرو دياب', id: '.spotify عمرو دياب مكانك' },
          { label: '🎧 ويجز', id: '.spotify ويجز البخت' },
        ],
      });
    }

    await sendText(sock, m.jid, `🔍 بدور في سبوتيفاي على: *${text}*...`);

    let results = [];
    try {
      results = await api.spotifySearch(text, 8);
    } catch (err) {
      return m.reply('😵 تعذر البحث في سبوتيفاي حالياً، حاول مجدداً لاحقاً.');
    }

    if (!results.length) return m.reply('😕 ملقيتش أي تراكات مطابقة في سبوتيفاي — جرب اسم مختلف');

    const all = cache();
    all[m.jid] = { type: 'spotify', results, at: Date.now() };
    db.set('searchCache', all);

    const first = results[0];
    const previewText = results
      .slice(0, 5)
      .map((r, i) => `${i + 1}. 🎵 *${r.name}* — ${r.artist} (${r.duration || ''})`)
      .join('\n');

    return sendQuickReplies(sock, m.jid, {
      title: '🎵 نتائج سبوتيفاي',
      text: `${previewText}\n\nاختار التراك اللي عايزه من القائمة تحت 👇`,
      sections: [
        {
          title: 'تراكات سبوتيفاي المتاحة',
          rows: results.slice(0, 8).map((r, i) => ({
            title: `🎵 ${String(r.name).slice(0, 30)}`,
            description: `${r.artist} • ${r.duration || ''}`,
            id: `.spotify pick-${i}`,
          })),
        },
      ],
      selectTitle: '🎧 اختر تراك للاستماع والتحميل',
    });
  },
};
