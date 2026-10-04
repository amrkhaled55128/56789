import { requireAdmin, listParticipants } from '../../core/groupadmin.js';
import { sendQuickReplies } from '../../core/send.js';

// 📢 .tagall — منشن للكل
export default {
  name: 'tagall',
  aliases: ['منشن_الكل', 'الكل'],
  description: 'منشن لكل أعضاء الجروب (للأدمن)',
  usage: '.tagall الرسالة',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'منشن الكل')) return;

    const text = args.join(' ').trim() || 'يا جماعة تعالوا نتجمع 😂';
    const parts = await listParticipants(sock, m.jid);
    if (!parts?.length) return m.reply('❌ مقدرتش أجيب الأعضاء — اتأكد إني أدمن');

    // واتساب بيقبل ~100 منشن في الرسالة
    const jids = parts.slice(0, 100).map((p) => p.jid);
    return sendQuickReplies(sock, m.jid, {
      title: '📢 منشن للكل',
      text: `${text}\n\n👥 ${jids.length} عضو`,
      mentions: jids,
    });
  },
};
