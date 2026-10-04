import { sendQuickReplies } from '../../core/send.js';
import { nameOf } from '../../core/economy.js';
import { db } from '../../core/db.js';

// 🏆 .top — صدارة نوفا العامة
export default {
  name: 'top',
  aliases: ['صدارة', 'الترتيب'],
  description: 'أعلى اللاعبين مستوى وثروة',
  usage: '.top',
  async execute(sock, m, args, ctx) {
    const all = db.get('economy', {});
    const users = db.get('users', {});
    const entries = Object.entries(all);
    if (!entries.length) return m.reply('لسه مفيش لاعبين — إنت ممكن تكون الأول! 🚀');

    const byXp = [...entries].sort((a, b) => (b[1].level - a[1].level) || (b[1].xp - a[1].xp)).slice(0, 5);
    const byCoins = [...entries].sort((a, b) => b[1].coins - a[1].coins).slice(0, 5);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const lines = ['🏆 *صدارة نوفا*', '', '⚡ *الأعلى مستوى*'];
    byXp.forEach(([k, v], i) => lines.push(`${medals[i]} ${nameOf(k, users)} — مستوى ${v.level}`));
    lines.push('', '💰 *الأغنى*');
    byCoins.forEach(([k, v], i) => lines.push(`${medals[i]} ${nameOf(k, users)} — ${v.coins} عملة`));

    return sendQuickReplies(sock, m.jid, {
      text: lines.join('\n'),
      buttons: [{ label: '🪪 كارتي أنا', id: '.mystats' }],
    });
  },
};
