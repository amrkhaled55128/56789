import { requireAdmin, targetOf, numbersFrom } from '../../core/groupadmin.js';
import { getSettings, updateSetting } from '../../core/protection.js';
import { resolveKey } from '../../core/identity.js';

// 🔇 .mute — كتم عضو لوقت معيّن (البوت يحذف رسايله بس)
export default {
  name: 'mute',
  aliases: ['كتم', 'اسكات'],
  description: 'كتم عضو لوقت — .mute @شخص 30 (بالدقائق)',
  usage: '.mute @شخص 30',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'الكتم')) return;

    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص والمدة: `.mute @شخص 30` (بالدقائق)');

    const [mins] = numbersFrom(args);
    if (!mins) return m.reply('اكتب المدة بالدقائق: `.mute @شخص 30`\n(30 دقيقة = نص ساعة)');
    if (mins > 60 * 24 * 7) return m.reply('📈 أقصى كتم أسبوع — مش أكتر');

    const s = getSettings(m.jid);
    s.muted = s.muted ?? {};
    const until = Date.now() + mins * 60000;
    s.muted[resolveKey(target) ?? target] = { until, by: m.identityKey ?? m.sender };
    updateSetting(m.jid, 'muted', s.muted);

    return m.reply(
      `🔇 اتكتم @${String(target).split('@')[0]} لمدة *${mins} دقيقة*\n` +
      `📅 هيفك الكتم الساعة ${new Date(until).toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo' })}`,
    );
  },
};
