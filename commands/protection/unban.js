import { requireAdmin, targetOf } from '../../core/groupadmin.js';
import { getSettings, updateSetting } from '../../core/protection.js';
import { resolveKey } from '../../core/identity.js';

// ✅ .unban — شيل الحظر وارجّعه للقائمة
export default {
  name: 'unban',
  aliases: ['رفع_الحظر', 'السماح'],
  description: 'إلغاء الحظر — يقدر يرجع تاني (للأدمن)',
  usage: '.unban @شخص',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'إلغاء الحظر')) return;

    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص: `.unban @شخص`');

    const s = getSettings(m.jid);
    s.banned = s.banned ?? {};
    const key = resolveKey(target) ?? target;
    const digits = String(target).split('@')[0];
    const found =
      s.banned[key] !== undefined
        ? key
        : Object.keys(s.banned).find((k) => k.split('@')[0] === digits);

    if (found === undefined) {
      return m.reply(`🤔 @${digits} مش متحظ أصلاً`);
    }
    delete s.banned[found];
    updateSetting(m.jid, 'banned', s.banned);
    return m.reply(`✅ اتشال الحظر عن @${digits}\nينفع يرجع ينضم تاني 👌`);
  },
};
