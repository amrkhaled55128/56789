import { isOwner } from '../../lib/utils.js';
import { config } from '../../config.js';
import { snapshot } from '../../core/stats.js';
import { apiHealth } from '../../core/api.js';

// ♻️ .reload — حالة البوت وأوامره + إعادة تحميل الأوامر
// (كان مفيش أي طريقة للمالك يعرف حالة البوت غير الداشبورد)
export default {
  name: 'reload',
  aliases: ['ريلود', 'تحديث', 'حاله'],
  description: 'حالة البوت + إعادة تحميل الأوامر (للمالك)',
  usage: '.reload',
  async execute(sock, m) {
    if (!isOwner(m, config)) return m.reply('🔐 الأمر ده للمالك بس');

    const s = snapshot();
    const health = apiHealth();
    const up = Math.floor((s.uptime ?? 0) / 1000);

    const lines = [
      `♻️ *حالة استرو*`,
      `🕐 شغال من: ${Math.floor(up / 3600)} ساعة و${Math.floor((up % 3600) / 60)} دقيقة`,
      `💬 رسايل: ${s.messages ?? 0}`,
      `⚡ أوامر نُفّذت: ${s.commands ?? 0}`,
      `🧠 ردود ذكية: ${s.aiReplies ?? 0} • 🎙️ أصوات: ${s.voices ?? 0}`,
      `🟢 API: ${health.status === 'ok' ? 'كله شغال' : `⚠️ ${health.openCount} endpoint في وضع آمن`}`,
      health.down.length ? `   ❌ ${health.down.join(', ')}` : '',
      ``,
    ].filter(Boolean);

    const errs = Object.entries(s.commandErrors ?? {});
    if (errs.length) {
      lines.push(`⚠️ *أوامر بتعمل أخطاء:*\n${errs.slice(0, 5).map(([k, v]) => `• ${k}: ${v}`).join('\n')}`);
    } else {
      lines.push('✅ مفيش أي أمر بيعمل أخطاء');
    }

    lines.push(
      ``,
      `📋 آخر أوامر:\n${(s.lastCommands ?? []).slice(0, 5).map((c) => `• ${c}`).join('\n') || '—'}`,
    );

    return m.reply(lines.join('\n'));
  },
};
