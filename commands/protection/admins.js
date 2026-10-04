import { requireAdmin, listParticipants } from '../../core/groupadmin.js';
import { sendQuickReplies } from '../../core/send.js';

// 👑 .admins — مين الأدمن في الجروب
export default {
  name: 'admins',
  aliases: ['الادمن', 'ادمن_الجروب'],
  description: 'قائمة أدمن الجروب (للأدمن)',
  usage: '.admins',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'عرض الأدمن')) return;

    const parts = await listParticipants(sock, m.jid);
    if (!parts?.length) return m.reply('❌ مقدرتش أجيب الأعضاء — اتأكد إني أدمن');

    const admins = parts.filter((p) => p.admin);
    if (!admins.length) return m.reply('🤔 مفيش أدمن مسجّل في الجروب ده');

    const lines = admins
      .slice(0, 20)
      .map((p) => `${p.admin === 'superadmin' ? '👑' : '⭐'} @${p.name}`)
      .join('\n');

    return sendQuickReplies(sock, m.jid, {
      title: `👑 أدمن الجروب (${admins.length})`,
      text: `${lines}\n\n👑 = صاحب الجروب\n⭐ = أدمن`,
    });
  },
};
