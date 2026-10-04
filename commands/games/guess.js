import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { grantWin, getEco, saveEco } from '../../core/economy.js';

const MAX = 50;   // الرقم من 1 لـ 50
const TRIES = 6;  // عدد المحاولات

function state() {
  return db.get('guess', {});
}

// ⚠️ اللعبة كانت متخزّنة بالشات (m.jid) — في جروب لو أحد بدأ وحد تاني خمّن،
// اللي بيخسر هو صاحب اللعبة الأصلي (لأن المحاولات والرصيد بتاعته)، ولما
// تنتهي اللعبة بتتمسح من تحت رجله. المفروض كل واحد ولديه لعبة.
function gameKey(m) {
  return `${m.jid}::${m.identityKey ?? m.sender}`;
}

function statKey(m) {
  return m.identityKey ?? m.sender;
}

function showGame(sock, m, game, hint) {
  const lines = [
    '🔢 *لعبة التخمين*',
    `أنا مخبي رقم من *1* لـ *${MAX}* — عنك *${game.left}* محاولة.`,
  ];
  if (hint) lines.push('', hint);
  lines.push('', 'اكتب رقمك: `.guess 25` أو دوس زر وسط 👇');

  // أزرار وسطية تساعد البداية
  const mid = Math.floor((game.low + game.high) / 2);
  return sendQuickReplies(sock, m.jid, {
    title: `🔢 تخمين — فاضل ${game.left} محاولة`,
    text: lines.join('\n'),
    buttons: [
      { label: `🎲 جرب ${mid}`, id: `.guess ${mid}` },
      { label: '🛑 استسلم', id: '.guess surrender' },
    ],
  });
}

export default {
  name: 'guess',
  aliases: ['خمن', 'تخمين'],
  description: 'خمن الرقم المخبي من 1 لـ 50 في 6 محاولات',
  usage: '.guess  أو  .guess 25',
  async execute(sock, m, args) {
    const all = state();
    const gk = gameKey(m);
    const sk = statKey(m);
    let game = all[gk];
    const num = Number(args[0]);

    // 💡 hint من المتجر: يكشف اتجاه الرقم مرة واحدة
    if (args[0] === 'hint') {
      if (!game) return m.reply('ابدأ لعبة الأول بـ `.guess`');
      const eco = getEco(sk);
      if ((eco.hints ?? 0) < 1) return m.reply('مفيش تلميحات عندك — اشتري من `.shop`');
      eco.hints--;
      saveEco(sk, eco);
      return m.reply(`💡 الرقم المخفي ${game.number > Math.floor((game.low + game.high) / 2) ? 'أكبر' : 'أصغر'} من ${Math.floor((game.low + game.high) / 2)} (باقي ليك ${eco.hints} تلميح)`);
    }

    // استسلام
    if (args[0] === 'surrender') {
      if (!game) return m.reply('مفيش لعبة مستنياك — اكتب `.guess` وابدأ 🔢');
      delete all[gk];
      db.set('guess', all);
      return sendQuickReplies(sock, m.jid, {
        title: '🏳️ سلّمت!',
        text: `الرقم كان *${game.number}* 😄\nعايز ثأر؟ اكتب \`.guess\``,
        buttons: [{ label: '🔄 العب تاني', id: '.guess' }],
      });
    }

    // مفيش لعبة → ابدأ واحدة (ولو بعت رقم مع البداية نحسبه محاولة)
    if (!game) {
      game = { number: 1 + Math.floor(Math.random() * MAX), left: TRIES, low: 1, high: MAX, by: sk, at: Date.now() };
      all[gk] = game;
      db.set('guess', all);
      if (!num) {
        return showGame(sock, m, game, 'لعبة جديدة بدأت — يلا خمّن! 🎯');
      }
    }

    // الرقم المطلوب مش رقم صالح
    if (!num || Number.isNaN(num) || num < 1 || num > MAX) {
      return m.reply(`اكتب رقم من *1* لـ *${MAX}* — مثال: \`.guess 25\``);
    }

    game.left--;
    let hint;

    if (num === game.number) {
      // كسب!
      const stats = db.get('guessStats', {});
      const me = stats[sk] ?? { win: 0, lose: 0 };
      me.win++;
      stats[sk] = me;
      delete all[gk];
      db.set('guess', all);
      db.set('guessStats', stats);
      const coins = grantWin(sk, 15);
      return sendQuickReplies(sock, m.jid, {
        title: `🎉 برافو! الرقم هو *${game.number}*`,
        text: `خمنته و*fاضل ${game.left} محاولة* بس! 🔥\n💰 +${coins} عملة\n📊 انتصاراتك: ${me.win} • خساراتك: ${me.lose}`,
        buttons: [{ label: '🔄 العب تاني', id: '.guess' }],
      });
    }

    if (num < game.number) {
      game.low = Math.max(game.low, num + 1);
      hint = `⬆️ *أكبر* من ${num}!`;
    } else {
      game.high = Math.min(game.high, num - 1);
      hint = `⬇️ *أصغر* من ${num}!`;
    }

    if (game.left <= 0) {
      const stats = db.get('guessStats', {});
      const me = stats[sk] ?? { win: 0, lose: 0 };
      me.lose++;
      stats[sk] = me;
      delete all[gk];
      db.set('guess', all);
      db.set('guessStats', stats);
      return sendQuickReplies(sock, m.jid, {
        title: `💀 خلصت المحاولات! الرقم كان *${game.number}*`,
        text: `📊 انتصاراتك: ${me.win} • خساراتك: ${me.lose}\nماتقلقش — تاني هتوصلها!`,
        buttons: [{ label: '🔄 العب تاني', id: '.guess' }],
      });
    }

    game.at = Date.now();
    all[gk] = game;
    db.set('guess', all);
    return showGame(sock, m, game, hint);
  },
};
