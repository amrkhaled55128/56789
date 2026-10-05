import { sendQuickReplies, sendText } from '../../core/send.js';
import { db } from '../../core/db.js';
import { grantWin } from '../../core/economy.js';

// 🔤 الكلمة المخفية — خمّن الحروف مع 6 محاولات
const WORDS = [
  { w: 'مصر', h: 'بلد الأهرامات وأم الدنيا 🇪🇬' },
  { w: 'كورة', h: 'اللعبة والرياضة الشعبية الأولى ⚽' },
  { w: 'شمس', h: 'نجم النهار ومصدر الدفء ☀️' },
  { w: 'قهوة', h: 'مشروب الصباح والمزاج المفضل ☕' },
  { w: 'نيل', h: 'شريان الحياة وأطول نهر في العالم 🌊' },
  { w: 'كتاب', h: 'صديق العقل وخزانة العلم 📖' },
  { w: 'جبل', h: 'تضاريس عالية وثابتة 🏔️' },
  { w: 'بحر', h: 'مياه مالحة وأمواج وشواطئ 🏖️' },
  { w: 'سفر', h: 'رحلة وتغيير مكان ✈️' },
  { w: 'كشري', h: 'الأكلة الشعبية المصرية التاريخية 🍲' },
  { w: 'طعمية', h: 'فلافل مصرية ساخنة بالسمسم 🧆' },
  { w: 'حواوشي', h: 'عيش بلدي ولحمة وتوابل في الفرن 🥩' },
  { w: 'شيشة', h: 'معسل وفحم في قعدة القهوة 💨' },
  { w: 'هرم', h: 'معجزة العمارة الفرعونية القديمة 🔺' },
  { w: 'قمر', h: 'ينير سماء الليل بأطواره 🌙' },
  { w: 'قطار', h: 'وسيلة مواصلات سريعة على القضبان 🚆' },
  { w: 'طيارة', h: 'تطير في السماء بين الدول 🛫' },
  { w: 'مدرسة', h: 'بيت العلم والمعلم والطلاب 🏫' },
  { w: 'مسجد', h: 'بيت الصلاة والمئذنة والمحراب 🕌' },
  { w: 'جامعة', h: 'مرحلة التعليم العالي والشهادات 🎓' },
  { w: 'شجرة', h: 'جذور وأغصان وظل وثمار 🌳' },
  { w: 'وردة', h: 'عطر وألوان زاهية وجمال 🌹' },
  { w: 'ساعة', h: 'عقارب تدور لحساب الوقت ⏰' },
  { w: 'مطبخ', h: 'مملكة الطبخ والأكلات اللذيذة 🍳' },
  { w: 'مستشفى', h: 'مكان العلاج والأطباء والتمريض 🏥' },
  { w: 'صيدلية', h: 'مكان بيع الدواء والعلاج 💊' },
  { w: 'فندق', h: 'مكان الإقامة السياحية والراحة 🏨' },
  { w: 'مطار', h: 'مهبط الطائرات وصالات السفر 🛬' },
  { w: 'تلفزيون', h: 'شاشة عرض الأخبار والمسلسلات 📺' },
  { w: 'موبايل', h: 'هاتف ذكي في يدك طول اليوم 📱' },
  { w: 'كمبيوتر', h: 'جهاز المعالجة والإنترنت والبرمجة 💻' },
  { w: 'سيارة', h: 'مركبة بأربع عجلات ومحرك 🚗' },
];

const STAGES = ['🙂', '😕', '🙁', '😟', '😣', '💀'];

// الحروف العربية المسموحة كاملة بما فيها التاء المربوطة والهمزات
const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوىيءأإؤئةى';

function games() {
  return db.get('hang', {});
}

function mask(word, guessed) {
  return word.split('').map((ch) => {
    // قبول ة و ه بالتبادل
    const alt = ch === 'ة' ? 'ه' : ch === 'ه' ? 'ة' : ch;
    return guessed.includes(ch) || guessed.includes(alt) ? ch : '_';
  }).join(' ');
}

function render(game) {
  return [
    `🔤 الكلمة: \`${mask(game.word, game.guessed)}\``,
    `💡 التلميح: ${game.hint}`,
    `❌ أخطاء (${game.wrong.length}/6): ${game.wrong.join(' ') || '—'} ${STAGES[Math.min(game.wrong.length, 5)]}`,
    `✅ أحرف مجربة: ${game.guessed.join(' ') || '—'}`,
  ].join('\n');
}

function buttons() {
  return [
    { label: '🔄 كلمة جديدة', id: '.hang new' },
    { label: '🛑 استسلام', id: '.hang giveup' },
  ];
}

function pickWord() {
  const entry = WORDS[Math.floor(Math.random() * WORDS.length)];
  return { w: entry.w.replace(/ة/g, 'ه'), h: entry.h };
}

export default {
  name: 'hang',
  aliases: ['كلمة', 'كلمة_مخفية', 'شنقة', 'المشنقة'],
  description: 'لعبة الكلمة المخفية — خمّن الحروف: .hang حرف',
  usage: '.hang  أو  .hang حرف',
  async execute(sock, m, args) {
    const all = games();
    const me = m.identityKey ?? m.sender;
    const arg = (args[0] ?? '').toLowerCase();

    // بدء كلمة جديدة
    if (!all[m.jid] || arg === 'new' || arg === 'جديد' || arg === 'ابدأ') {
      const { w, h } = pickWord();
      all[m.jid] = { word: w, hint: h, guessed: [], wrong: [], by: me, at: Date.now() };
      db.set('hang', all);
      return sendQuickReplies(sock, m.jid, {
        title: '🔤 لعبة الكلمة المخفية — بدأت!',
        text: render(all[m.jid]) + '\n\nاكتب حرفك كده: `.hang ح`\nأو اطلب كلمة جديدة بالأزرار 👇',
        buttons: buttons(),
      });
    }

    const game = all[m.jid];

    // استسلام
    if (arg === 'giveup' || arg === 'استسلم' || arg === 'استسلام') {
      delete all[m.jid];
      db.set('hang', all);
      return sendQuickReplies(sock, m.jid, {
        title: `🏳️ استسلمت! الكلمة كانت: *${game.word}*`,
        text: 'المرة الجاية هتكسبها بإذن الله 💪',
        buttons: [{ label: '🔄 كلمة جديدة', id: '.hang new' }],
      });
    }

    // تخمين حرف
    const letter = arg[0];
    if (!letter || !LETTERS.includes(letter)) {
      return m.reply('ابعت حرف عربي واحد، مثال: `.hang م` أو `.hang ك`');
    }

    const altLetter = letter === 'ة' ? 'ه' : letter === 'ه' ? 'ة' : letter;
    if (game.guessed.includes(letter) || game.guessed.includes(altLetter) || game.wrong.includes(letter)) {
      return m.reply(`الحرف "${letter}" جربته قبل كده خلاص 😅`);
    }

    const isMatch = game.word.includes(letter) || game.word.includes(altLetter);
    if (isMatch) {
      game.guessed.push(letter);
      if (altLetter !== letter) game.guessed.push(altLetter);
    } else {
      game.wrong.push(letter);
    }
    game.at = Date.now();
    db.set('hang', all);

    // التحقق من الفوز
    const won = [...new Set(game.word.split(''))].every((ch) => {
      const alt = ch === 'ة' ? 'ه' : ch === 'ه' ? 'ة' : ch;
      return game.guessed.includes(ch) || game.guessed.includes(alt);
    });

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
        title: `🎉 عاش يا بطل! الكلمة هي *${game.word}*`,
        text: `كسبت وعدد أخطائك ${game.wrong.length} بس! 🔥\n💰 مكافأتك: *+${coins} عملة*\n📊 إجمالي فوزك: ${s.win}`,
        buttons: [{ label: '🔄 كلمة جديدة', id: '.hang new' }],
      });
    }

    // التحقق من الخسارة (6 أخطاء)
    if (game.wrong.length >= 6) {
      delete all[m.jid];
      db.set('hang', all);
      return sendQuickReplies(sock, m.jid, {
        title: `💀 للأسف خلصت المحاولات الستة!`,
        text: `الكلمة كانت: *${game.word}*\n${game.hint}\n\nجرّب تاني وهتكسبها! 💪`,
        buttons: [{ label: '🔄 كلمة جديدة', id: '.hang new' }],
      });
    }

    await sendText(sock, m.jid, render(game));
  },
};
