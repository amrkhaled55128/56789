import { requireAdmin, numbersFrom } from '../../core/groupadmin.js';
import { updateSetting } from '../../core/protection.js';

// 🌊 .antiflood — اضبط منع التكرار: .antiflood 5 10 (5 رسايل في 10 ثواني)
export default {
  name: 'antiflood',
  aliases: ['منع_التكرار', 'الفلود'],
  description: 'ضبط منع التكرار — .antiflood 5 10 (5 رسايل / 10 ثواني)',
  usage: '.antiflood 5 10',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'ضبط الفلود')) return;

    const sub = (args[0] ?? '').toLowerCase();

    if (sub === 'off' || sub === 'ايقاف') {
      updateSetting(m.jid, 'antiflood', false);
      return m.reply('🌊 منع التكرار مطفي — مفيش حد أقصى للرسايل');
    }
    if (sub === 'on' || sub === 'تشغيل' || !args.length) {
      updateSetting(m.jid, 'antiflood', true);
      return m.reply('🌊 منع التكرار شغال بالوضع الافتراضي (3 رسايل / 8 ثواني)');
    }

    const [max, secs] = numbersFrom(args);
    if (!max || !secs) {
      return m.reply(
        '📖 اكتب رقمين: `.antiflood 5 10`\n' +
          'يعني: لو حد بعت 5 رسايل في 10 ثواني → تتحذف وتلمس إنذار\n' +
          'للإيقاف: `.antiflood off`',
      );
    }
    if (max < 2) return m.reply('📉 الحد الأدنى رسالتين');
    if (secs > 120) return m.reply('📈 أقصى مدة دقيقتين');
    if (max > 30) return m.reply('📈 الحد الأقصى 30 رسالة');

    updateSetting(m.jid, 'antiflood', true);
    updateSetting(m.jid, 'floodMax', max);
    updateSetting(m.jid, 'floodSecs', secs);
    return m.reply(`🌊 اتظبط: *${max}* رسالة في *${secs}* ثانية\n📈 أي زيادة = تحذيف + إنذار`);
  },
};
