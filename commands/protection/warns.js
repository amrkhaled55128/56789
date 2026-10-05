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
      if (!count) return m.reply(`✨ @${digits} سجله نظيف — مفيش أي إنذارات 🌟`, { mentions: [target] });
      return m.reply(
        `⚠️ @${digits} عنده *${count}* من 3 إنذارات\n` +
        `${count >= 2 ? '🚨 الإنذار القادم سيتسبب في طرده تلقائياً!' : 'لسه عنده فرصة، خلي بالك'}`,
        { mentions: [target] }
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
        text: '✨ الجروب نظيف تماماً — لا توجد أي إنذارات مسجلة.\nاستمروا كده دايماً 💪',
        buttons: [{ label: '🛡️ إعدادات الحماية', id: '.gsettings' }],
      });
    }

    const mentions = [];
    const lines = rows
      .slice(0, 20)
      .map(([k, v]) => {
        const jid = k.includes('@') ? k : `${k}@s.whatsapp.net`;
        mentions.push(jid);
        const digits = k.split('@')[0];
        const pushName = names[k]?.name ? ` (${names[k].name})` : '';
        return `${v >= 3 ? '🔴' : '🟡'} @${digits}${pushName} — *${v}* إنذار`;
      })
      .join('\n');

    return sendQuickReplies(sock, m.jid, {
      title: `📋 سجل الإنذارات في الجروب (${rows.length})`,
      text: `${lines}\n\n🔴 = 3 إنذارات (معرض للطرد)\n🟡 = إنذارات نشطة`,
      mentions,
      buttons: [{ label: '🛡️ إعدادات الحماية', id: '.gsettings' }],
    });
  },
};
