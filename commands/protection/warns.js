import { requireAdmin, targetOf } from '../../core/groupadmin.js';
import { getSettings } from '../../core/protection.js';
import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { resolveKey } from '../../core/identity.js';

// 📋 .warns — مين عنده إنذارات في الجروب ده
export default {
  name: 'warns',
  aliases: ['انذارات', 'الانذارات'],
  description: 'مين عنده إنذارات في الجروب (للأدمن)',
  usage: '.warns  أو  .warns @شخص',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'عرض الإنذارات')) return;

    const s = getSettings(m.jid);
    const warnings = s.warnings ?? {};
    const target = targetOf(m);

    // 👤 شخص محدد
    if (target) {
      const digits = String(target).split('@')[0];
      const key = resolveKey(target) ?? target;
      const count = warnings[key] ?? Object.entries(warnings).find(([k]) => k.split('@')[0] === digits)?.[1] ?? 0;
      if (!count) return m.reply(`✨ @${digits} نضيف — مفيش إنذارات`);
      return m.reply(
        `⚠️ @${digits} عنده *${count}* من 3 إنذارات\n` +
        `${count >= 2 ? '🚨 الإنذار الجاي هيطلعه' : 'لسه عنده فرصة'}`,
      );
    }

    // 📊 كل الجروب
    const names = db.get('users', {});
    const rows = Object.entries(warnings)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    if (!rows.length) {
      return sendQuickReplies(sock, m.jid, {
        title: '📋 سجل الإنذارات',
        text: '✨ الجروب نضيف — مفيش أي إنذارات.\nخلّي الجروب نضيف كده 💪',
        buttons: [{ label: '🛡️ إعدادات الحماية', id: '.gsettings' }],
      });
    }

    const lines = rows
      .slice(0, 20)
      .map(([k, v]) => {
        const who = names[k]?.name ?? k.split('@')[0];
        return `${v >= 3 ? '🔴' : '🟡'} @${who} — ${v}`;
      })
      .join('\n');

    return sendQuickReplies(sock, m.jid, {
      title: `📋 سجل الإنذارات (${rows.length})`,
      text: `${lines}\n\n🔴 = عنده 3 (هيتطرد)\n🟡 = لسه عنده فرصة`,
      buttons: [{ label: '🛡️ إعدادات الحماية', id: '.gsettings' }],
    });
  },
};
