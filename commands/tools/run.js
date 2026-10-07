import { sendQuickReplies, sendText } from '../../core/send.js';
import api from '../../core/api.js';

// 💻 .run — تشغيل أكواد برمجية وحسابية عبر Remote Code Runner
export default {
  name: 'run',
  aliases: ['كود', 'احسب', 'شغل_كود', 'code'],
  description: 'تنفيذ كود أو حسابات رياضية متقدمة — .run كود جافاسكربت',
  usage: '.run 5 * 100 + Math.sqrt(144)',
  async execute(sock, m, args, ctx) {
    const code = args.join(' ').trim();

    if (!code) {
      return sendQuickReplies(sock, m.jid, {
        title: '💻 مشغّل الأكواد والحسابات',
        text: 'اكتب كود جافاسكربت أو عملية حسابية لتنفيذها فوراً!\n\n💡 *أمثلة:*\n• `.run 1500 * 1.14`\n• `.run "استرو".repeat(3)`\n• `.run new Date().toLocaleDateString("ar-EG")`',
        buttons: [
          { label: '🧮 حساب سريع', id: '.run 25 * 40 - 150' },
          { label: '📅 تاريخ اليوم', id: '.run new Date().toLocaleString()' },
        ],
      });
    }

    await sendText(sock, m.jid, '⚡ جاري تنفيذ الكود...');

    let res;
    const startTime = Date.now();
    try {
      res = await api.executeCode(code);
    } catch (err) {
      return m.reply(`❌ خطأ في الاتصال بمشغّل الأكواد: ${err.message?.slice(0, 80)}`);
    }

    const elapsed = Date.now() - startTime;
    const output = res?.output !== undefined ? res.output : res;
    const isSuccess = res?.status !== false;

    const formattedOutput =
      typeof output === 'object'
        ? JSON.stringify(output, null, 2)
        : String(output ?? 'بدون مخرجات');

    const resultMessage = isSuccess
      ? `✅ *تم التنفيذ بنجاح* (${elapsed}ms)\n\n\`\`\`javascript\n${formattedOutput.slice(0, 1500)}\n\`\`\``
      : `❌ *خطأ في الكود* (${elapsed}ms)\n\n\`\`\`\n${formattedOutput.slice(0, 1000)}\n\`\`\``;

    return sendQuickReplies(sock, m.jid, {
      title: '💻 نتيجة الكود',
      text: resultMessage,
      buttons: [
        { label: '📋 نسخ النتيجة', id: `copy:${formattedOutput.slice(0, 500)}` },
        { label: '🛠️ أدوات البوت', id: '.menu tools' },
      ],
    });
  },
};
