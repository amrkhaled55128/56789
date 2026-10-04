import { sendQuickReplies } from '../../core/send.js';
import { BADGES, getEco } from '../../core/economy.js';
import { db } from '../../core/db.js';

// 🏅 .badges — أوسمتك واللي لسه مقفول
export default {
  name: 'badges',
  aliases: ['وسام', 'الوسام', 'اوسمة', 'الأوسمة'],
  description: 'أوسمتك واللي لسه مقفول — .badges',
  usage: '.badges',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    const got = db.get('achievements', {})[key] ?? {};
    const eco = getEco(key);

    const unlocked = BADGES.filter((b) => got[b.id]);
    const locked = BADGES.filter((b) => !got[b.id]);

    const lines = [
      unlocked.length
        ? `✅ *فتحت ${unlocked.length} من ${BADGES.length}*\n\n${unlocked.map((b) => `${b.emoji} *${b.label}*`).join('\n')}`
        : '🤔 لسه مفيش أوسمة — العب كمان شوية!',
      locked.length ? `\n\n🔒 *لسه مقفولة:*\n${locked.map((b) => `${b.emoji} ${b.label}`).join('\n')}` : '\n\n🏆 فتحت الكل! وحش فعلاً',
      '',
      `📊 مستواك ${eco.level ?? 1} • ${eco.totalWins ?? 0} فوز • ${eco.coins ?? 0} عملة`,
    ];

    return sendQuickReplies(sock, m.jid, {
      title: `🏅 الأوسمة (${unlocked.length}/${BADGES.length})`,
      text: lines.join('\n'),
      buttons: [
        { label: '🪪 كارتي', id: '.mystats' },
        { label: '🎮 العب دلوقتي', id: '.menu games' },
      ],
    });
  },
};
