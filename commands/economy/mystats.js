import { sendQuickReplies } from '../../core/send.js';
import { getEco, progressInfo, globalRank, levelFromXp, BADGES } from '../../core/economy.js';
import { getProfile } from '../../core/memory.js';
import { db } from '../../core/db.js';

// 🪪 .mystats — كارتك الشخصي عند استرو
export default {
  name: 'mystats',
  aliases: ['كارتي', 'رصيدي'],
  description: 'كارتك الشخصي: مستواك، عملاتك، انتصاراتك، أوسمتك، وذكرياتك',
  usage: '.mystats',
  async execute(sock, m, args, ctx) {
    const key = m.identityKey ?? m.sender;
    const eco = getEco(key);
    const prog = progressInfo(eco);
    const level = eco.level ?? levelFromXp(eco.xp ?? 0);
    const rank = globalRank(key);
    const profile = getProfile(key);
    // الذكريات قد تحتوي تفاصيل شخصية. لا نعرضها أمام أعضاء الجروب.
    const mems = m.isGroup ? [] : (profile.memories ?? []).slice(-2);

    // 🏅 الأوسمة اللي اتفتحت
    const got = db.get('achievements', {})[key] ?? {};
    const myBadges = BADGES.filter((b) => got[b.id]);

    const lines = [
      `🪪 *كارت ${profile.name ?? m.pushName}*${eco.golden ? ' 🏅' : ''}`,
      eco.title ? `🏷️ اللقب: *${eco.title}*` : '',
      ``,
      `⚡ المستوى: *${level}*`,
      `${prog.bar} *${prog.into ?? 0}*/*${prog.need}* XP للمستوى الجاي`,
      ``,
      `💰 العملات: *${eco.coins}*`,
      `📅 ستريك المكافأة: ${eco.dailyStreak ?? 0} يوم`,
      `🏆 انتصارات: ${eco.totalWins ?? 0} من ${eco.totalGames ?? 0} لعبة`,
      rank ? `🌍 رتبتك: #${rank.rank} من ${rank.total}` : '',
      ``,
      myBadges.length
        ? `🏅 أوسمتك: ${myBadges.map((b) => `${b.emoji}${b.label}`).join(' • ')}`
        : '🏅 لسه مفيش أوسمة — العب وجمّعها!',
      `🧠 استرو فاكر عنك: ${(profile.memories ?? []).length} ذكرى`,
    ];

    if (mems.length) lines.push(...mems.map((x) => `   💭 ${x.text}`));

    return sendQuickReplies(sock, m.jid, {
      text: lines.filter(Boolean).join('\n'),
      buttons: [
        { label: '📅 المكافأة اليومية', id: '.daily' },
        { label: '🏅 الأوسمة', id: '.badges' },
        { label: '🎰 آلة الحظ', id: '.slot' },
      ],
    });
  },
};
