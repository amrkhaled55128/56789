import { requireAdmin, targetOf } from '../../core/groupadmin.js';
import { getSettings, updateSetting } from '../../core/protection.js';
import { resolveKey } from '../../core/identity.js';

// 🔊 .unmute — فك الكتم فورًا
export default {
  name: 'unmute',
  aliases: ['فك_الكتم', 'رجع_كلامه'],
  description: 'إلغاء الكتم فورًا (للأدمن)',
  usage: '.unmute @شخص',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'إلغاء الكتم')) return;

    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص: `.unmute @شخص`');

    const s = getSettings(m.jid);
    s.muted = s.muted ?? {};
    const key = resolveKey(target) ?? target;
    const digits = String(target).split('@')[0];
    const found =
      s.muted[key] !== undefined ? key : Object.keys(s.muted).find((k) => k.split('@')[0] === digits);

    if (found === undefined) return m.reply(`🤔 @${digits} مش مكتوم أصلاً`);

    delete s.muted[found];
    updateSetting(m.jid, 'muted', s.muted);
    return m.reply(`🔊 رجع الكلام لـ @${digits} 👌`);
  },
};
