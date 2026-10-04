import { sendQuickReplies, sendText } from '../../core/send.js';
import { db } from '../../core/db.js';
import { grantWin } from '../../core/economy.js';

// 🔤 كلمة مخفية — خمّن الحروف، 6 محاولات
const WORDS = [
  { w: 'مصر', h: 'بلد الأمسح' },
  { w: 'كورة', h: 'اللعبة الشعبية الأولى' },
  { w: 'شمس', h: 'بتطلع كل يوم' },
  { w: 'قهوة', h: 'مشروب الصباح المصري' },
  { w: 'نيل', h: 'أطول نهر في أفريقيا' },
  { w: 'كتاب', h: 'صديق العقل' },
  { w: 'جبل', h: 'عالي وثابت' },
  { w: 'بحر', h: 'مالوش آخر' },
  { w: 'قهقهه', h: 'ضحكة عالية' },
  { w: 'سفر', h: 'بتروح بعيد عن بلدك' },
];

const STAGES = ['🙂', '😕', '🙁', '😟', '😣', '💀'];

// ⚠️ التاء المربوطة كانت ناقصة — والكلمات "كورة" و"قهوة" و"قهقهه" فيها ة،
// فكان اللاعب مستحيل ي typed ة (الرد بيرفضها) والشرط `every()` مستحيل
// يتحقق = 20% من الكلمات مستحيل يكسبها. لازم كل حرف في الكلمات موجود هنا.
const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوىيءأإؤئ';

function games() {
  return db.get('hang', {});
}

function mask(word, guessed) {
  return word.split('').map((ch) => (guessed.includes(ch) ? ch : '_')).join(' ');
}

function render(game) {
  return [
    `🔤 \`${mask(game.word, game.guessed)}\``,
    `💡 التلميح: ${game.hint}`,
    `❌ غلط (${game.wrong.length}/${6}): ${game.wrong.join(' ') || '—'} ${STAGES[Math.min(game.wrong.length, 5)]}`,
    `✅ جربت: ${game.guessed.join(' ') || '—'}`,
  ].join('\n');
}

function buttons() {
  return [{ label: '🔄 كلمة جديدة', id: '.hang new' }, { label: '🛑 استسلم', id: '.hang giveup' }];
}

// 🛡️ ما نختارش كلمة فيها حرف مش مسموح — غير كده اللعبة مستحيل تتكسب
// وميصلهاش حتى الجواب. بنوحّد التاء المربوطة لو لزقت.
function pickWord() {
  for (let i = 0; i < 20; i++) {
    const entry = WORDS[Math.floor(Math.random() * WORDS.length)];
    const normalized = entry.w.replace(/ة/g, 'ه');
    if ([...normalized].every((ch) => LETTERS.includes(ch))) return { w: normalized, h: entry.h };
  }
  return { w: 'مصر', h: 'بلد الأمسح' }; // احتياط مضمون
}

export default {
  name: 'hang',
  aliases: ['كلمة', 'كلمةمخفية'],
  description: 'لعبة الكلمة المخفية — خمّن الحروف: .hang حرف',
  usage: '.hang  أو  .hang حرف',
  async execute(sock, m, args) {
    const all = games();
    const me = m.identityKey ?? m.sender;
    const arg = (args[0] ?? '').toLowerCase();

    // كلمة جديدة
    if (!all[m.jid] || arg === 'new') {
      const { w, h } = pickWord();
      all[m.jid] = { word: w, hint: h, guessed: [], wrong: [], by: me, at: Date.now() };
      db.set('hang', all);
      return sendQuickReplies(sock, m.jid, {
        title: '🔤 كلمة مخفية — بدأت!',
        text: render(all[m.jid]) + '\n\nاكتب حرف: `.hang ح` — أول حرف يترشح.',
        buttons: buttons(),
      });
    }

    const game = all[m.jid];

    // استسلام
    if (arg === 'giveup') {
      delete all[m.jid];
      db.set('hang', all);
      return sendQuickReplies(sock, m.jid, {
        title: `🏳️ استسلمت! الكلمة كانت: *${game.word}*`,
        text: 'المرة الجاية هتكسب بإذن الله 💪',
        buttons: [{ label: '🔄 العب تاني', id: '.hang' }],
      });
    }

    // تخمين حرف
    const letter = arg[0];
    if (!letter || !LETTERS.includes(letter)) {
      return m.reply('ابعت حرف عربي واحد: `.hang ح`');
    }
    if (game.guessed.includes(letter) || game.wrong.includes(letter)) {
      return m.reply(`الحرف "${letter}" جربته خلاص 😅`);
    }

    if (game.word.includes(letter)) {
      game.guessed.push(letter);
    } else {
      game.wrong.push(letter);
      game.guessed.push(letter);
    }
    game.at = Date.now();
    db.set('hang', all);

    const won = [...new Set(game.word.split(''))].every((ch) => game.guessed.includes(ch));
    if (won) {
      const stats = db.get('hangStats', {});
      const s = stats[me] ?? { win: 0 };
      s.win++;
      stats[me] = s;
      delete all[m.jid];
      db.set('hang', all);
      db.set('hangStats', stats);
      const coins = grantWin(me, 20);
      return sendQuickReplies(sock, m.jid, {
        title: `🎉 برافو! الكلمة كانت *${game.word}*`,
        text: `كسبت والغلطات ${game.wrong.length} بس!\n💰 +${coins} عملة\n📊 انتصاراتك: ${s.win}`,
        buttons: [{ label: '🔄 كلمة جديدة', id: '.hang' }],
      });
    }

    if (game.wrong.length >= 6) {
      delete all[m.jid];
      db.set('hang', all);
      return sendQuickReplies(sock, m.jid, {
        title: `💀 خلصت المحاولات! الكلمة كانت *${game.word}*`,
        text: 'قربت منها! جرب كلمة جديدة 💪',
        buttons: [{ label: '🔄 كلمة جديدة', id: '.hang' }],
      });
    }

    await sendText(sock, m.jid, render(game));
  },
};
