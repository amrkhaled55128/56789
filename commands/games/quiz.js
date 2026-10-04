import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { addCoins } from '../../core/economy.js';

// بنك أسئلة — الإجابة الصحيحة هي index 0 دايمًا، والترتيب بيتشفل للاعب
const QUESTIONS = [
  { q: '🪐 أكبر كوكب في المجموعة الشمسية؟', a: 'المشتري', wrong: ['زحل', 'الأرض', 'نبتون'] },
  { q: '🌍 كم عدد قارات العالم؟', a: '7 قارات', wrong: ['5 قارات', '6 قارات', '8 قارات'] },
  { q: '🇯🇵 عاصمة اليابان؟', a: 'طوكيو', wrong: ['أوساكا', 'كيوتو', 'سيول'] },
  { q: '🐆 أسرع حيوان بري في العالم؟', a: 'الفهد', wrong: ['الأسد', 'الحصان', 'الغزال'] },
  { q: '🌈 كم عدد ألوان قوس قزح؟', a: '7 ألوان', wrong: ['5 ألوان', '6 ألوان', '9 ألوان'] },
  { q: '📖 من مؤلف كتاب "الأيام"؟', a: 'طه حسين', wrong: ['نجيب محفوظ', 'توفيق الحكيم', 'يحيى حقي'] },
  { q: '🌊 أكبر محيط في العالم؟', a: 'المحيط الهادي', wrong: ['الأطلسي', 'الهندي', 'المتجمد الشمالي'] },
  { q: '🥇 ما رمز العنصر الذهب في الكيمياء؟', a: 'Au', wrong: ['Ag', 'Fe', 'Go'] },
  { q: '⚽ كم عدد لاعبي فريق كرة القدم داخل الملعب؟', a: '11 لاعب', wrong: ['10 لاعبين', '12 لاعب', '9 لاعبين'] },
  { q: '🇹🇷 عاصمة تركيا؟', a: 'أنكرة', wrong: ['إستانبول', 'ازمير', 'بورصة'] },
  { q: '🎈 أخف عنصر في الكون؟', a: 'الهيدروجين', wrong: ['الهيليوم', 'النيون', 'الأكسجين'] },
  { q: '🧠 المسؤول عن التوازن في جسم الإنسان؟', a: 'الأذن الداخلية', wrong: ['العين', 'الأنف', 'اللسان'] },
  { q: '🏜️ أكبر صحراء حارة في العالم؟', a: 'الصحراء الكبرى', wrong: ['صحراء الربع الخالي', 'صحراء غوبي', 'صحراء كالاهاري'] },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function state() {
  return db.get('quiz', {});
}

function nextQuestion() {
  const idx = Math.floor(Math.random() * QUESTIONS.length);
  // ترتيب معروض مشفوش: العنصر = index الاختيار الأصلي
  const order = shuffle([0, 1, 2, 3]);
  return { q: idx, order };
}

function askButtons(st) {
  const question = QUESTIONS[st.q];
  const options = [question.a, ...question.wrong];
  return st.order.map((origIdx, shownPos) => ({
    label: options[origIdx],
    id: `.quiz ans-${st.q}-${shownPos}`,
  }));
}

export default {
  name: 'quiz',
  aliases: ['اسئلة', 'سؤال', 'كويز'],
  description: 'تحدي معلومات عربي — اختار الإجابة الصح من الأزرار واجمع نقاط',
  usage: '.quiz',
  async execute(sock, m, args) {
    const all = state();

    // رد على اختيار: .quiz ans-<رقم السؤال>-<مكان الاختيار المعروض>
    const ansMatch = /^(?:ans-)?(\d+)-([0-3])$/.exec(args[0] ?? '');
    if (ansMatch) {
      const qIdx = Number(ansMatch[1]);
      const shownPos = Number(ansMatch[2]);
      const current = all[m.jid];

      if (!current || current.q !== qIdx) {
        return m.reply('⏳ السؤال اتغير خلاص — دوس زر *السؤال الجاي*');
      }

      const question = QUESTIONS[qIdx];
      const options = [question.a, ...question.wrong];
      const chosen = options[current.order[shownPos]];
      const correct = chosen === question.a;

      const stats = db.get('quizStats', {});
      const me = stats[m.sender] ?? { score: 0, played: 0 };
      me.played++;

      let text;
      if (correct) {
        me.score++;
        const coins = addCoins(m.identityKey ?? m.sender, 10);
        text = `✅ *إجابة صحيحة!* "${question.a}"\n💰 +10 عملة (رصيدك ${coins})\n📊 نقاطك: *${me.score}* من ${me.played} سؤال`;
      } else {
        text = `❌ *للأسف غلط* — اخترت "${chosen}"\n✔️ الصح: *${question.a}*\n📊 نقاطك: ${me.score} من ${me.played} سؤال`;
      }
      stats[m.sender] = me;

      all[m.jid] = nextQuestion();
      db.set('quiz', all);
      db.set('quizStats', stats);

      await m.reply(text);
      return sendQuickReplies(sock, m.jid, {
        title: '🧠 السؤال الجاي',
        text: `${QUESTIONS[all[m.jid].q].q}\n\nاختر الإجابة 👇`,
        buttons: askButtons(all[m.jid]),
      });
    }

    // بدء / متابعة
    if (!all[m.jid]) {
      all[m.jid] = nextQuestion();
      db.set('quiz', all);
    }
    const st = all[m.jid];
    const stats = db.get('quizStats', {});
    const me = stats[m.sender] ?? { score: 0, played: 0 };
    return sendQuickReplies(sock, m.jid, {
      title: `🧠 تحدي المعلومات — نقاطك: ${me.score}`,
      text: `${QUESTIONS[st.q].q}\n\nاختر الإجابة الصحيحة 👇`,
      buttons: askButtons(st),
    });
  },
};
