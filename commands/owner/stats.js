import { isOwner, runtime } from '../../lib/utils.js';
import { config } from '../../config.js';
import { db } from '../../core/db.js';

// 📊 .stats — إحصائيات البوت (للمالك)
const botStart = Date.now();

export default {
  name: 'stats',
  aliases: ['احصائيات', 'الحالة'],
  description: 'إحصائيات البوت — للمالك',
  usage: '.stats',
  async execute(sock, m) {
    if (!isOwner(m, config)) return m.reply('🔐 الأمر ده للمالك بس');
    const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
    return m.reply(
      [
        '📊 *إحصائيات NOVA BOT* ⚡',
        '',
        `⏱️ شغال من: ${runtime(botStart)}`,
        `👥 جروبات: ${Object.keys(groups).length}`,
        `🧠 ناس في الذاكرة: ${Object.keys(db.get('users', {})).length}`,
        `🎮 شاتات فيها ألعاب نشطة: ${Object.keys(db.get('xo', {})).length + Object.keys(db.get('hang', {})).length}`,
        `👑 المالكين: ${config.owners.length ? config.owners.join(', ') : 'مش متحددين — حط رقمك في config.js'}`,
      ].join('\n'),
    );
  },
};
