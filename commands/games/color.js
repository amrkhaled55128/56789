import { sendQuickReplies } from '../../core/send.js';
import { addCoins } from '../../core/economy.js';
import { db } from '../../core/db.js';

// 🎨 .color — لعبة الألوان: حد يختار لون والبوت يخفي واحد
// جاوب صح = تكسب، غلط = تخسر
const COLORS = [
  { name: 'أحمر', emoji: '🔴' },
  { name: 'أزرق', emoji: '🔵' },
  { name: 'أخضر', emoji: '🟢' },
  { name: 'أصفر', emoji: '🟡' },
  { name: 'برتقالي', emoji: '🟠' },
  { name: 'بنفسجي', emoji: '🟣' },
  { name: 'بني', emoji: '🟤' },
  { name: 'أسود', emoji: '⚫' },
];

export default {
  name: 'color',
  aliases: ['الوان', 'لون', 'الالوان', 'لعبه_الالوان'],
  description: 'لعبة الألوان — اختار اللون المخفي: .color اسم اللون',
  usage: '.color  أو  .color أحمر',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    // لعبة مستقلة لكل لاعب حتى في الجروبات؛ ما تخليش إجابة حد تمسح لعبتهم.
    const state = `${m.jid}::${key}`;
    const games = db.get('colorGames', {});
    // تنظيف الألعاب المنتهية عشان DB ما تكبرش مع الجولات المهجورة.
    const now = Date.now();
    for (const [gameKey, saved] of Object.entries(games)) {
      if (!saved?.at || now - saved.at > 120000) delete games[gameKey];
    }
    const answer = args.join(' ').trim().toLowerCase();
    const game = games[state];

    // إجابة
    if (answer) {
      if (!game || Date.now() - game.at > 120000) {
        delete games[state];
        db.set('colorGames', games);
        return m.reply('🎨 مفيش لعبة شغالة — ابدأ واحدة بـ `.color`');
      }
      const norm = (s) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
      const correct = norm(COLORS[game.correct].name) === norm(answer);
      delete games[state];
      db.set('colorGames', games);

      if (correct) {
        const won = addCoins(key, 30);
        return m.reply(`🎉 صح! اللون المخفي كان *${COLORS[game.correct].emoji} ${COLORS[game.correct].name}*\n💰 +${won} عملة`);
      }
      return m.reply(
        `❌ غلط! كان *${COLORS[game.correct].emoji} ${COLORS[game.correct].name}*\n` +
          `استنى الجاي بقى 💪`,
      );
    }

    // لعبة جديدة. نعرض كل الاختيارات حتى اللون الصحيح؛ استبعاده كان بيخلي الفوز مستحيلاً.
    const correct = Math.floor(Math.random() * COLORS.length);
    games[state] = { correct, at: Date.now() };
    db.set('colorGames', games);

    return sendQuickReplies(sock, m.jid, {
      title: '🎨 اختار اللون المخفي!',
      text: 'في لون واحد صح من دول — خمنه 🎯\n⏱️ عندك دقيقتين',
      buttons: COLORS.map((c) => ({ label: `${c.emoji} ${c.name}`, id: `.color ${c.name}` })),
    });
  },
};
