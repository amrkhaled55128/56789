import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { addCoins } from '../../core/economy.js';

// 🎭 .guesswho — حدس: وصّف شخص والكل يخمّن
const PEOPLE = [
  { who: 'محمد صلاح', hints: ['لاعب كورة مصري', 'أفضل لاعب في أفريقيا', 'لعب في ليفربول'] },
  { who: 'عمرو دياب', hints: ['مغني مصري', 'صاحب أغنية "حنا الدنيا"', 'صاحبه هنا'] },
  { who: 'أحمد شوقي', hints: ['شاعر مصري كبير', 'من عصر التجديد', 'مشهور في الشعر العربي'] },
  { who: 'ميمي', hints: ['ممثل مصري', 'صاحب مسلسل "الفيل"', 'مشهور بأدوار الكوميديا'] },
  { who: 'طه حسين', hints: ['أديب مصري', 'كاتب رواية "الأيام"', 'من أعظم كتّاب الأدب العربي'] },
  { who: 'يوسف زيدان', hints: ['كاتب مصري', 'حصد جائزة نوبل', 'كاتب "ثلاثية غرناطة"'] },
];

function state() {
  return db.get('guessWho', {});
}

// ⏰ لعبة من غير وقت بتموت جروب كله
const STALE_MS = 20 * 60 * 1000;

// ⚠️ المطابقة القديمة كانت `target.includes(answer)` فأي حرف واحد كان بيكسب
// ("ا" بتكسب "أحمد شوقي") = ثغرة بتدي +20 عملة بضغطة واحدة. دلوقتي لازم الكلمة
// تكون 3 حروف على الأقل ومطابقة لحدود الكلمة في الاسم.
function isCorrect(answer, target) {
  if (!answer || answer.length < 3) return false;
  if (answer === target) return true;
  return target.split(/\s+/).some((w) => w.length >= 3 && (w === answer || w.includes(answer)));
}

// التلميحات: بعض الأسماء ليها تلميحين بس — الفهرس لازم يتقيّد بالطول
// وإلا الرد بيطلع "تلميح: undefined"
function hintAt(game, i) {
  return game.hints[Math.min(i, game.hints.length - 1)];
}

export default {
  name: 'guesswho',
  aliases: ['حدس', 'مين'],
  description: 'لعبة حدس — وصّف الشخص والكل يخمّن مين',
  usage: '.guesswho  أو  .guesswho guess الإجابة',
  async execute(sock, m, args) {
    const all = state();
    const sub = (args[0] ?? '').toLowerCase();

    // 🧹 لعبة قديمة متسنية من زمان
    const cur = all[m.jid];
    if (cur?.at && Date.now() - cur.at > STALE_MS) {
      delete all[m.jid];
      db.set('guessWho', all);
    }

    const game = all[m.jid];

    // 🚪 إلغاء
    if (sub === 'cancel' || sub === 'stop') {
      if (!game) return m.reply('مفيش لعبة تلغيها 🤷');
      delete all[m.jid];
      db.set('guessWho', all);
      return m.reply('🛑 اللعبة اتلغت. ابدأ تاني: `.guesswho`');
    }

    if (sub === 'hint' && game) {
      return m.reply(`💡 تلميح: ${hintAt(game, game.tries)}`);
    }

    if (sub === 'guess' && game) {
      const answer = args.slice(1).join(' ').trim().toLowerCase();
      const target = game.who.toLowerCase();
      if (!answer) return m.reply('اكتب إجابتك: `.guesswho guess محمد صلاح`');
      if (answer.length < 3) return m.reply('اكتب الاسم كامل — 3 حروف على الأقل');

      if (isCorrect(answer, target)) {
        const coins = addCoins(m.identityKey ?? m.sender, 20);
        delete all[m.jid];
        db.set('guessWho', all);
        return m.reply(`🎉 صح! ده *${game.who}* 🎯\n💰 +${coins} عملة`);
      }

      game.tries++;
      game.at = Date.now();
      if (game.tries >= 3) {
        delete all[m.jid];
        db.set('guessWho', all);
        return m.reply(`❌ خلصت المحاولات! الإجابة كانت *${game.who}* 😅`);
      }
      all[m.jid] = game;
      db.set('guessWho', all);
      return m.reply(`❌ مش صح!\n💡 تلميح: ${hintAt(game, game.tries)}`);
    }

    if (game) {
      return m.reply('🎭 فيه لعبة شغالة! جاوب: `.guesswho guess الإجابة`\n(`.guesswho cancel` للإلغاء)');
    }

    const pick = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
    all[m.jid] = { who: pick.who, hints: pick.hints, tries: 0, by: m.identityKey ?? m.sender, at: Date.now() };
    db.set('guessWho', all);
    return sendQuickReplies(sock, m.jid, {
      title: '🎭 مين ده؟',
      text: `🔍 الوصف: *${pick.hints[0]}*\n\nخمّن مين وجاوب: \`.guesswho guess الإجابة\`\n\nمحتاج مساعدة؟ دوس الزر`,
      buttons: [
        { label: '💡 تلميح', id: '.guesswho hint' },
        { label: '🛑 إلغاء', id: '.guesswho cancel' },
      ],
    });
  },
};
