import { requireAdmin } from '../../core/groupadmin.js';
import { getSettings, updateSetting } from '../../core/protection.js';
import { sendQuickReplies } from '../../core/send.js';

// 🔗 .antilink — التحكم في اللينكات: تشغيل/إيقاف + دومينات مسموحة
// قبل كده كان on/off بس — يعني الجروب يا يمنع كل لينك يا يسمح للجميع
export default {
  name: 'antilink',
  aliases: ['اللينكات', 'منع_اللينكات'],
  description: 'التحكم في اللينكات — تشغيل/إيقاف + سماح لدومين معيّن',
  usage: '.antilink on|off  |  .antilink allow youtube.com',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'ضبط اللينكات')) return;

    const s = getSettings(m.jid);
    const sub = (args[0] ?? '').toLowerCase();
    const allowed = s.allowLinks ?? [];

    if (sub === 'on' || sub === 'تشغيل') {
      updateSetting(m.jid, 'antilink', true);
      return m.reply('🔗 منع اللينكات شغال');
    }
    if (sub === 'off' || sub === 'ايقاف') {
      updateSetting(m.jid, 'antilink', false);
      return m.reply('✅ أي لينك هيعدّي دلوقتي');
    }

    if (sub === 'allow' || sub === 'سماح') {
      const domain = (args[1] ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return m.reply('اكتب الدومين: `.antilink allow youtube.com`');
      if (allowed.includes(domain)) return m.reply(`${domain} مسموح خلاص 🤷`);
      allowed.push(domain);
      updateSetting(m.jid, 'allowLinks', allowed);
      if (!s.antilink) updateSetting(m.jid, 'antilink', true);
      return m.reply(`✅ ${domain} بقى مسموح\n🔗 اللينكات التانية لسه ممنوعة`);
    }

    if (sub === 'deny' || sub === 'منع' || sub === 'remove') {
      const domain = (args[1] ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      const i = allowed.indexOf(domain);
      if (i === -1) return m.reply(`${domain} مش في المسموح 🤷`);
      allowed.splice(i, 1);
      updateSetting(m.jid, 'allowLinks', allowed);
      return m.reply(`🔒 ${domain} رجع ممنوع`);
    }

    // 📋 الحالة
    return sendQuickReplies(sock, m.jid, {
      title: `🔗 اللينكات: ${s.antilink ? 'ممنوعة' : 'مسموحة'}`,
      text: allowed.length
        ? `✅ الدومينات المسموحة:\n${allowed.map((d) => `• ${d}`).join('\n')}\n\nغيرها بتتمسح`
        : 'مفيش دومينات مسموحة — أي لينك بيتمسح',
      buttons: [
        { label: '✅ اتسمح بيوتيوب', id: '.antilink allow youtube.com' },
        { label: '✅ اتسمح بفيسبوك', id: '.antilink allow facebook.com' },
        { label: s.antilink ? '🔓 اسمح للكل' : '🔒 امنع الكل', id: s.antilink ? '.antilink off' : '.antilink on' },
      ],
    });
  },
};
