import { dailyReward } from '../../core/economy.js';

// 📅 .daily — مكافأة يومية بتزيد مع الاستمرار
export default {
  name: 'daily',
  aliases: ['مكافأة', 'مكافاة', 'يومي'],
  description: 'مكافأة يومية بالعملات — بتزيد كل يوم بتستمر',
  usage: '.daily',
  async execute(sock, m, args, ctx) {
    const key = m.identityKey ?? m.sender;
    const res = dailyReward(key);
    if (!res.ok) {
      return m.reply(`⏳ خدت مكافأتك النهاردة خلاص! 🪙\nارجع بعد *${res.hoursLeft} ساعة* — وكمّل الستريك عشان الجايزة تكبر 🔥`);
    }
    return m.reply(
      [
        `🎁 *مكافأة يومية!*`,
        ``,
        `🪙 +${res.reward} عملة`,
        `🔥 ستريك: *${res.streak} يوم* ${res.streak >= 3 ? '(بتزيد 25 عملة كل يوم إضافي!)' : ''}`,
        ``,
        `ارجع بكرة وكمّل — الجايزة بتكبر كل يوم!`,
      ].join('\n'),
    );
  },
};
