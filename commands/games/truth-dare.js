import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';

// 🔥 حقيقة وجرأة — بنك أسئلة مصري مرح
const TRUTHS = [
  'إيه أكبر كدبة قلتها في حياتك؟',
  'مين آخر حد طلعتله في الخاص من جوه الجروب؟',
  'إيه أسوأ حاجة عملتها في المدرسة؟',
  'لو تختبئت تسمع الناس بتتكلم عنك، تسمع عن مين الأول؟',
  'إيه الحاجة اللي بتعملها سراً ومحدش عارف عنها؟',
  'قول حاجة مش حلوة عن حد موجود في الشات ده 😅',
  'إيه أكتر حاجة اتبسطت فيها وقيلت إنها بسيطة؟',
  'لو معاك قدرة واحدة تخفيها عن ناس كتير، هي إيه؟',
  'مين الشخص اللي بتصورله كل حاجة حلوة تحصل ليك؟',
  'إيه أطرف موقف حصل معاك قدام ناس؟',
  'لو رجع الزمن ورا، هتعمل إيه في سنة معينة؟',
  'إيه الحاجة اللي نفسك تقولها لحد ومش بتقدر؟',
];

const DARES = [
  'ابعت رسالة صوتية وانت بتعوي انك بتغني 🎤',
  'اكتب إيموجي بس عن يومك وخلّي الناس تخمن',
  'قول جملة حب لأول حد يرد عليك في الشات 😂',
  'غير صورتك الشخصية لصورة كوميدية لمدة ساعة',
  'اكتب رسالة لأقرب صاحب ليك بتقول فيه "وحشتني" من غير سبب',
  'قلّد صوت شخصية كرتونية وابعتهالنا 🎭',
  'اكتب اسم كل اللي في الجروب بالترتيب اللي بتحبهم 😅',
  'ابعت آخر صورة في جالكسي من غير ما تشوفها',
  'قول نكتة... لو محدش ضحك لازم تقول واحدة تانية',
  'اكتب أغنية راب من 4 سطور عن المود بتاعك دلوقتي 🎧',
  'اعمل منشور (هنا) عن أغرب حاجة أكلتها في حياتك',
  'وصف نفسك في 3 كلمات بس... الشات هينطق على أحدهم 😂',
];

function pick(arr, except) {
  let item = arr[Math.floor(Math.random() * arr.length)];
  if (arr.length > 1 && item === except) item = arr[(arr.indexOf(item) + 1) % arr.length];
  return item;
}

export default {
  name: 'td',
  aliases: ['حقيقة', 'جرأة', 'حقيقةواجرأة'],
  description: 'لعبة حقيقة وجرأة — اختار بنفسك أو سيبها للحظ',
  usage: '.td  أو  .td truth  أو  .td dare',
  async execute(sock, m, args) {
    const sub = (args[0] ?? '').toLowerCase();
    const games = db.get('td', {});
    const last = games[m.jid];

    if (sub === 'truth' || sub === 'حقيقة') return send(sock, m, 'truth', pick(TRUTHS, last?.truth));
    if (sub === 'dare' || sub === 'جرأة') return send(sock, m, 'dare', pick(DARES, last?.dare));
    if (sub === 'random' || sub === 'عشوائي') {
      return Math.random() < 0.5
        ? send(sock, m, 'truth', pick(TRUTHS, last?.truth))
        : send(sock, m, 'dare', pick(DARES, last?.dare));
    }

    return sendQuickReplies(sock, m.jid, {
      title: '🔥 حقيقة وجرأة',
      text: 'اختار بنفسك... وابعت اللعبة للشات كلهم يلعبوا معاك 😈',
      buttons: [
        { label: '😳 حقيقة', id: '.td truth' },
        { label: '🔫 جرأة', id: '.td dare' },
        { label: '🎲 عشوائي', id: '.td random' },
      ],
    });
  },
};

function send(sock, m, kind, text) {
  const games = db.get('td', {});
  // ⚠️ كان بيكتب `{ [kind]: text }` فيستبدل الكائن كله — فتلعب `.td dare`
  // بتمسح آخر "حقيقة"، والمنع لازم يبقى على النوعين مع بعض
  games[m.jid] = { ...(games[m.jid] ?? {}), [kind]: text };
  db.set('td', games);
  const emoji = kind === 'truth' ? '😳' : '🔫';
  const label = kind === 'truth' ? 'حقيقة' : 'جرأة';
  return sendQuickReplies(sock, m.jid, {
    title: `${emoji} ${label}!`,
    text,
    buttons: [
      { label: '😳 حقيقة تانية', id: '.td truth' },
      { label: '🔫 جرأة تانية', id: '.td dare' },
      { label: '🎲 عشوائي', id: '.td random' },
    ],
  });
}
