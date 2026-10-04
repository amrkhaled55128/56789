import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { addCoins } from '../../core/economy.js';

// 📅 .dailyquest — تحدي يومي واحد لكل يوم (نفس التحدي لكل الناس)
const QUESTS = [  { q: 'اصنع أكل مصري واسمه', coins: 30 },
  { q: 'اكتب بيت شعر على صاحبك', coins: 25 },
  { q: 'قول نكتة مضحكة (مش معروفة)', coins: 20 },
  { q: 'اعمل تحدي لحد في الجروب وقول إيه التحدي', coins: 35 },
  { q: 'اكتب وصف لمكان مصري بتحبه', coins: 25 },
  { q: 'اتعلم كلمة جديدة في إنجليزي واستخدمها في جملة', coins: 20 },
  { q: 'قول إيه أحسن أكلة في مصر في رأيك وليه', coins: 15 },
  { q: 'اكتب قصة قصيرة من 3 سطور', coins: 30 },
  { q: 'خمّن إيه أحسن أغنية مصرية دلوقتي', coins: 10 },
  { q: 'صوّت على أحسن أغنية مصرية دلوقتي', coins: 15 },
  { q: 'اكتب رسالة حلوة لحد تحبه', coins: 25 },
  { q: 'اقترح مكان حلو للطلعة في مصر', coins: 20 },
];

// ⚠️ كان في تاريخين مختلفين: العرض بالقاهرة (en-CA) والتسجيل بـ UTC
// (toISOString) — بين 22:00 و24:00 القاهرة (= 20:00–22:00 UTC) بيكون
// التاريخ المعروض مختلف عن مفتاح التسجيل، فالمستخدم يخلّص تحدي ويعرضله
// تحدي تاني فورًا. دلوقتي الاتنين من نفس المصدر.
export function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

export function todayQuest() {
  return QUESTS[Math.abs(hashCode(todayKey())) % QUESTS.length];
}

function startOfCairoDay(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return NaN;
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const cairoHourAtNoon = Number(noonUtc.toLocaleString('en-US', {
    timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false,
  }));
  const offsetHours = (cairoHourAtNoon - 12 + 24) % 24;
  return Date.UTC(year, month - 1, day) - offsetHours * 3600000;
}

export function pruneQuestHistory(history, today = todayKey()) {
  const result = { ...(history ?? {}) };
  const todayMs = startOfCairoDay(today);
  for (const dateKey of Object.keys(result)) {
    const ageDays = Math.floor((todayMs - startOfCairoDay(dateKey)) / 86400000);
    if (!Number.isFinite(ageDays) || ageDays > 14 || ageDays < 0) delete result[dateKey];
  }
  return result;
}

export default {
  name: 'dailyquest',
  aliases: ['تحدي_اليوم', 'تحدي-النهارده', 'مهمة', 'مهمة_اليوم'],
  description: 'تحدي اليوم — كل يوم تحدي جديد، أول ما تخلّص تاخد عملات',
  usage: '.dailyquest  أو  .dailyquest done ردك',
  async execute(sock, m, args) {
    const done = db.get('quests', {});
    const today = todayKey();
    const me = m.identityKey ?? m.sender;
    const quest = todayQuest();

    // 🧹 تشذيب محفوظ: نحتفظ بآخر 14 يوم بس عشان السجل مايكبرش للأبد.
    const mine = pruneQuestHistory(done[me], today);
    done[me] = mine;
    db.set('quests', done);

    if (args[0] === 'done') {
      if (mine[today]) {
        return m.reply('✅ خلّصت تحدي النهاردة خلاص! جرب تاني بكرة 🔥');
      }
      const answer = args.slice(1).join(' ').trim();
      if (answer.length < 5) return m.reply('اكتب ردك الأول: `.dailyquest done الإجابة`');

      const coins = addCoins(me, quest.coins);
      mine[today] = true;
      done[me] = mine;
      db.set('quests', done);
      return m.reply(`✅ تم التسجيل!\n💰 +${coins} عملة\n\n🔄 تحدي جديد بكرة — تفاوتلاش!`);
    }

    const finished = mine[today];
    return sendQuickReplies(sock, m.jid, {
      title: `📅 تحدي النهاردة (${today})`,
      text: `🎯 *${quest.q}*\n\n🏆 المكافأة: ${quest.coins} عملة\n${finished ? '✅ خلّصته النهاردة — بكرة تحدي جديد!' : 'لما تخلّصه اكتب: `.dailyquest done ردك`\nأو دوس الزر وابعت الرد كده'}`,
      buttons: finished
        ? [{ label: '🪪 كارتي', id: '.mystats' }]
        : [{ label: '📝 خلّصت التحدي', id: '.dailyquest done تمام خلصته' }],
    });
  },
};

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}
