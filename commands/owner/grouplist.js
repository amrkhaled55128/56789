import { sendQuickReplies } from '../../core/send.js';
import { isOwner } from '../../lib/utils.js';
import { config } from '../../config.js';

// 👥 .grouplist — كل الجروبات اللي فيها البوت (للمالك)
export default {
  name: 'grouplist',
  aliases: ['الجروبات', 'جروباتي'],
  description: 'قائمة الجروبات — للمالك',
  usage: '.grouplist',
  async execute(sock, m) {
    if (!isOwner(m, config)) return m.reply('🔐 الأمر ده للمالك بس');
    const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
    const list = Object.values(groups ?? {});
    if (!list.length) return m.reply('البوت مش في جروبات');

    // ⚠️ حد واتساب لنص الكارت ~1024 حرف — 30 جروب كانوا بيخليوا الإرسال يفشل كله
    const MAX = 900;
    const shown = list.slice(0, 25);
    let body = shown
      .map((g, i) => `${i + 1}. ${String(g.subject).slice(0, 45)} — ${g.participants?.length ?? '?'} عضو`)
      .join('\n');
    if (list.length > shown.length) body += `\n\n… و${list.length - shown.length} جروب تاني`;

    return sendQuickReplies(sock, m.jid, {
      title: `👥 جروبات البوت (${list.length})`,
      text: body.slice(0, MAX),
      buttons: [{ label: '📊 إحصائيات', id: '.stats' }],
    });
  },
};
