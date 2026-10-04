import { requireAdmin, targetOf } from '../../core/groupadmin.js';
import { warnUser, getSettings } from '../../core/protection.js';
import { sendQuickReplies } from '../../core/send.js';

// ⚠️ .warn — إنذار يدوي (بعد 3 إنذارات: طرد تلقائي)
export default {
  name: 'warn',
  aliases: ['انذار', 'تحذير'],
  description: 'إنذار عضو — بعد 3 إنذارات ياتطرد (للأدمن)',
  usage: '.warn @شخص السبب',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'الإنذار')) return;

    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص: `.warn @شخص السبب`');
    const reason = args.slice(1).join(' ').trim() || 'مخالفة للقوانين';

    const s = getSettings(m.jid);
    const before = Object.values(s.warnings ?? {}).find((v) => typeof v === 'number' && v > 0) ?? 0;
    await warnUser(sock, m.jid, target, reason);
    const after = getSettings(m.jid);
    const digits = String(target).split('@')[0];
    const count =
      Object.entries(after.warnings ?? {}).find(([k]) => k.split('@')[0] === digits)?.[1] ??
      after.warnings?.[target] ??
      0;

    return sendQuickReplies(sock, m.jid, {
      title: `⚠️ إنذار لـ @${digits}`,
      text: `📝 السبب: ${reason}\n🔢 عنده دلوقتي: *${count}* من 3\n${count >= 2 ? '🚨 الإنذار الجاي هيطلعه من الجروب!' : ''}`,
      mentions: [target],
      buttons: [
        { label: '🚫 حظر', id: '.ban' },
        { label: '🔇 كتم ساعة', id: '.mute' },
      ],
    });
  },
};
