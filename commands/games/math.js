import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { addCoins } from '../../core/economy.js';

// 🧮 تحدي الرياضيات — أول صح يكسب نقطة (فردي أو في الجروب)

function makeQuestion() {
  const level = Math.random();
  let a, b, op, answer;
  if (level < 0.4) {
    a = 10 + Math.floor(Math.random() * 80);
    b = 10 + Math.floor(Math.random() * 80);
    op = Math.random() < 0.5 ? '+' : '-';
    answer = op === '+' ? a + b : a - b;
  } else if (level < 0.8) {
    a = 3 + Math.floor(Math.random() * 9);
    b = 3 + Math.floor(Math.random() * 9);
    op = '×';
    answer = a * b;
  } else {
    b = 2 + Math.floor(Math.random() * 9);
    answer = 2 + Math.floor(Math.random() * 12);
    a = b * answer;
    op = '÷';
  }
  return { q: `${a} ${op} ${b} = ؟`, answer };
}

function state() {
  return db.get('math', {});
}

export default {
  name: 'math',
  aliases: ['رياضيات', 'حسبة'],
  description: 'تحدي رياضيات سريع — أول إجابة صح تاخد نقطة',
  usage: '.math  أو  .math رقم',
  async execute(sock, m, args) {
    const all = state();
    const game = all[m.jid];
    const input = args[0];

    // استسلام
    if (input === 'giveup' && game) {
      delete all[m.jid];
      db.set('math', all);
      return sendQuickReplies(sock, m.jid, {
        title: `🏳️ استسلمت! الإجابة كانت *${game.answer}*`,
        text: 'المرة الجاية هتوصلها 💪',
        buttons: [{ label: '🧮 سؤال جديد', id: '.math' }],
      });
    }

    // إجابة
    if (input !== undefined && game) {
      const guess = Number(input);
      if (Number.isNaN(guess)) return m.reply('اكتب رقم: `.math 42`');

      if (Date.now() - game.at > 60000) {
        delete all[m.jid];
        db.set('math', all);
        return sendQuickReplies(sock, m.jid, {
          title: `⌛ الوقت خلص! الإجابة كانت *${game.answer}*`,
          text: 'عايز سؤال جديد؟ دوس الزر 👇',
          buttons: [{ label: '🧮 سؤال جديد', id: '.math' }],
        });
      }

      if (guess === game.answer) {
        const meKey = m.identityKey ?? m.sender;
        const stats = db.get('mathStats', {});
        const me = stats[meKey] ?? { points: 0 };
        me.points++;
        stats[meKey] = me;
        delete all[m.jid];
        db.set('math', all);
        db.set('mathStats', stats);
        const coins = addCoins(meKey, 15);
        return sendQuickReplies(sock, m.jid, {
          title: `🎉 إجابة صحيحة يا *${m.pushName}*!`,
          text: `${game.q} ✅\n\n💰 +15 عملة (رصيدك الحالي: ${coins})\n📊 نقاطك: *${me.points}*\n\nعايز سؤال جديد؟ 👇`,
          buttons: [{ label: '🧮 سؤال جديد', id: '.math' }],
        });
      }
      return m.reply(`❌ مش صح — جرب تاني (فاضل 60 ثانية من بداية السؤال)`);
    }

    // سؤال جديد — لو فيه سؤال شغال نعرضه
    if (game && Date.now() - game.at <= 60000) {
      return m.reply(`🧮 السؤال شغال لسه:\n*${game.q}*\n\nجاوب بـ: \`.math الرقم\``);
    }

    const { q, answer } = makeQuestion();
    all[m.jid] = { q, answer, at: Date.now() };
    db.set('math', all);
    return sendQuickReplies(sock, m.jid, {
      title: '🧮 تحدي الرياضيات!',
      text: `${q}\n\n⏱️ عندك دقيقة! أول إجابة صح تاخد نقطة.\nجاوب بـ: \`.math الرقم\``,
      buttons: [{ label: '🛑 استسلم', id: '.math giveup' }],
    });
  },
};
