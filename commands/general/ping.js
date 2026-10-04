import { snapshot } from '../../core/stats.js';

// 📶 .ping — البوت شغال؟ وقد إيه ردّه؟
export default {
  name: 'ping',
  aliases: ['بينج', 'سرعه', 'سريع', 'ping'],
  description: 'سرعة رد البوت ومدة تشغيله',
  usage: '.ping',
  async execute(sock, m) {
    const t0 = Date.now();
    const s = snapshot();
    const up = Math.floor((s.uptime ?? 0) / 1000);
    const upText =
      up < 60
        ? `${up} ثانية`
        : up < 3600
          ? `${Math.floor(up / 60)} دقيقة`
          : up < 86400
            ? `${Math.floor(up / 3600)} ساعة`
            : `${Math.floor(up / 86400)} يوم`;
    const roundtrip = Date.now() - t0;
    return m.reply(
      `📶 *استرو شغال*\n` +
        `⏱️ رد في: *${roundtrip}ms*\n` +
        `🕐 شغال من: *${upText}*\n` +
        `💬 رسايل: ${s.messages ?? 0} • أوامر: ${s.commands ?? 0}\n` +
        `🟢 API: ${s.apiStatus === 'ok' ? 'شغال' : `محدود (${s.apiDown ?? 0})`}`,
    );
  },
};
