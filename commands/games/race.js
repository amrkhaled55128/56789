import { sendQuickReplies, sendText } from '../../core/send.js';
import { db } from '../../core/db.js';
import { addCoins } from '../../core/economy.js';

// 🏎️ .race — سباق سرعة: 3 أسئلة سريعة، أول واحد يجاوب الكل ياخد 60 عملة
const QUESTIONS = [
  { q: '2 + 3 × 4 = ؟', a: 14 },
  { q: '100 ÷ 4 = ؟', a: 25 },
  { q: '7 × 8 - 6 = ؟', a: 50 },
  { q: '15 × 4 = ؟', a: 60 },
  { q: '144 ÷ 12 = ؟', a: 12 },
  { q: '9 × 9 - 31 = ؟', a: 50 },
  { q: 'كم عدد أضلاع المربع؟', a: 4 },
  { q: 'لو معاك 25 جنيه واشتريت بـ 15، فاضل كام؟', a: 10 },
];

function makeQueue() {
  return [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
}

function state() {
  return db.get('race', {});
}

export default {
  name: 'race',
  aliases: ['سباق', 'سباق_سرعة'],
  description: 'سباق سرعة — 3 أسئلة، أول واحد يصحّ الكل ياخد 60 عملة',
  usage: '.race  أو  .race رقم',
  async execute(sock, m, args) {
    const all = state();
    const me = m.identityKey ?? m.sender;
    const num = args[0];

    // 🚪 إيقاف السباق — من غيره لو حد بدأ سباق ومشى، الجروب يفضل "سباق شغال" للأبد
    if (num === 'stop' || num === 'cancel') {
      if (!all[m.jid]) return m.reply('مفيش سباق شغال أصلاً 🤷');
      delete all[m.jid];
      db.set('race', all);
      return m.reply('🛑 السباق اتلغى. ابدأ تاني: `.race`');
    }

    const stale = all[m.jid] && Date.now() - all[m.jid].at > 60000;
    // ⏰ فحص انتهاء الوقت — كان بيحصل على مسار الإجابة بس. أي `.race` فاضي
    // (أو حد تاني في الجروب) كان بيرد "سباق شغال" إلى ما لا نهاية.
    if (stale) {
      delete all[m.jid];
      db.set('race', all);
      m.reply('⌛ وقت السباق القديم خلص! بنبدأ واحد جديد ⏱️');
    }

    const game = all[m.jid];

    if (num !== undefined && game) {
      if (Number(num) !== game.current.a) {
        return m.reply(`❌ غلط! لسه في وقت (${Math.ceil((game.at + 60000 - Date.now()) / 1000)} ثانية)`);
      }
      game.score++;
      if (game.score >= 3) {
        const coins = addCoins(me, 60);
        delete all[m.jid];
        db.set('race', all);
        return sendQuickReplies(sock, m.jid, {
          title: `🏁 خلصت السباق يا ${m.pushName}!`,
          text: `🧠 3/3 إجابات صح!\n💰 +${coins} عملة\n\nتاني؟`,
          buttons: [
            { label: '🏎️ سباق تاني', id: '.race' },
            { label: '🛑 وقّف', id: '.race stop' },
          ],
        });
      }
      game.current = game.queue.shift();
      game.at = Date.now();
      all[m.jid] = game;
      db.set('race', all);
      return sendText(sock, m.jid, `✅ صح!\n\n❓ السؤال ${game.score + 1}: ${game.current.q}`);
    }

    if (game) {
      return m.reply(
        `🏎️ سباق شغال! السؤال: *${game.current.q}*\nجاوب بـ: \`.race الإجابة\`\n(` +
        `${Math.ceil((game.at + 60000 - Date.now()) / 1000)} ثانية — \`.race stop\` للإلغاء)`,
      );
    }

    const queue = makeQueue();
    all[m.jid] = {
      score: 0,
      queue: queue.slice(1),
      current: queue[0],
      at: Date.now(),
      by: me,
    };
    db.set('race', all);
    return m.reply(
      `🏎️ *سباق السرعة!*\n⏱️ دقيقة لكل سؤال\n\n❓ السؤال 1: ${queue[0].q}\n\n` +
      `جاوب: \`.race الإجابة\` — والإلغاء: \`.race stop\``,
    );
  },
};
