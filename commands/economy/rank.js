import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { levelFromXp } from '../../core/economy.js';
import { targetOf } from '../../core/groupadmin.js';
import { getProfile } from '../../core/memory.js';

// 🏅 .rank — ترتيبك أو ترتيب حد تاني
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export default {
  name: 'rank',
  aliases: ['رتبتي', 'مركزي', 'مركزي_العالمي', 'فين_ترتيبي'],
  description: 'ترتيبك بين كل الناس — .rank أو .rank @شخص',
  usage: '.rank',
  async execute(sock, m, args) {
    const eco = db.get('economy', {});
    const users = db.get('users', {});
    const levelOf = (v) => v?.level ?? levelFromXp(v?.xp ?? 0);

    const board = Object.entries(eco).sort(
      (a, b) => levelOf(b[1]) - levelOf(a[1]) || (b[1]?.xp ?? 0) - (a[1]?.xp ?? 0),
    );

    if (!board.length) return m.reply('لسه مفيش حد كسب خبرة — كن أول واحد! 🏁');

    const target = targetOf(m);
    const meKey = m.identityKey ?? m.sender;

    // 👤 شخص محدد
    if (target) {
      const digits = String(target).split('@')[0];
      const entry = board.find(([k]) => k.split('@')[0] === digits);
      if (!entry) return m.reply(`@${digits} لسه مفيش له خبرة`);
      const [key, v] = entry;
      const idx = board.findIndex(([k]) => k === key);
      const name = users[key]?.name ?? digits;
      return m.reply(
        `🏅 *${name}*\n⚡ مستوى ${levelOf(v)}\n⚡ ${v.xp ?? 0} XP\n💰 ${v.coins ?? 0} عملة\n📍 ترتيبه: *#${idx + 1}* من ${board.length}`,
      );
    }

    // 📊 لوحة عامة
    const myIdx = board.findIndex(([k]) => k === meKey);
    const lines = board
      .slice(0, 10)
      .map(([k, v], i) => {
        const name = users[k]?.name ?? k.split('@')[0];
        return `${MEDALS[i]} ${name} — مستوى ${levelOf(v)} • ${v.xp ?? 0} XP`;
      })
      .join('\n');

    const myLine =
      myIdx === -1
        ? '\n\n📍 انت لسه مفيش خبرة — جرّب أي أمر عشان تبدأ'
        : myIdx < 10
          ? ''
          : `\n\n📍 ترتيبك: *#${myIdx + 1}* من ${board.length} • مستوى ${levelOf(board[myIdx][1])}`;

    return sendQuickReplies(sock, m.jid, {
      title: '🏆 أفضل 10 عند استرو',
      text: `${lines}${myLine}`,
      buttons: [
        { label: '🪪 كارتي', id: '.mystats' },
        { label: '💰 أعلى الأرصدة', id: '.top' },
      ],
    });
  },
};
