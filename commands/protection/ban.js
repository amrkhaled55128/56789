import { requireAdmin, targetOf, mentionOf } from '../../core/groupadmin.js';
import { getSettings, updateSetting } from '../../core/protection.js';
import { db } from '../../core/db.js';
import { resolveKey } from '../../core/identity.js';

// 🚫 .ban — طرد عضو وتoquيفه من رجوع الجروب
// (بيستخدم إمّا الحظر الحقيقي في واتساب أو القائمة السوداء بتاعتنا)
export default {
  name: 'ban',
  aliases: ['حظر', 'ممنوع'],
  description: 'حظر عضو من الجروب — مايرجعش (للأدمن)',
  usage: '.ban @شخص  أو  .ban @شخص السبب',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'الحظر')) return;

    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص: `.ban @شخص` — أو اعمل رد على رسالته');
    const reason = args.slice(1).join(' ').trim() || 'مفيش سبب مذكور';

    // 📋 قائمة سودا بتاعتنا (تتحفظ بمفتاح الهوية عشان ما تتفرقش)
    const s = getSettings(m.jid);
    s.banned = s.banned ?? {};
    s.banned[resolveKey(target) ?? target] = { at: Date.now(), by: m.identityKey ?? m.sender, reason };
    updateSetting(m.jid, 'banned', s.banned);

    try {
      await sock.groupParticipantsUpdate(m.jid, [target], 'remove');
    } catch {
      return m.reply('⚠️ مش قادر أطرده — بس اتسجل في القائمة السوداء');
    }
    return m.reply(
      `🚫 اتحظر @${String(target).split('@')[0]}\n📝 السبب: ${reason}\n\nمش هيقدر يرجع تاني 🚪`,
    );
  },
};
