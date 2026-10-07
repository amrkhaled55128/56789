import { sendText, sendQuickReplies } from '../../core/send.js';
import api from '../../core/api.js';

// 📱 .apk — البحث عن تطبيقات وألعاب أندرويد وتحميل APK مباشر
export default {
  name: 'apk',
  aliases: ['تطبيق', 'برنامج', 'تطبيقات', 'العاب'],
  description: 'البحث عن تطبيقات وألعاب أندرويد وتحميل ملف APK مباشرة — .apk <اسم التطبيق>',
  usage: '.apk <اسم التطبيق>',
  async execute(sock, m, args) {
    const query = args.join(' ').trim();
    if (!query) {
      return m.reply(
        '📱 *البحث عن تطبيقات أندرويد (APK)*\n\n' +
        'اكتب اسم التطبيق أو اللعبة للبحث وتحميل ملف الـ APK مباشرة:\n' +
        '`.apk <اسم التطبيق>`\n\n' +
        '💡 *أمثلة:*\n' +
        '• `.apk WhatsApp`\n' +
        '• `.apk Telegram`\n' +
        '• `.apk Subway Surfers`'
      );
    }

    await sendText(sock, m.jid, `🔍 جاري البحث عن تطبيق: *${query}*...`);

    try {
      const apps = await api.vexApk(query, 3);
      if (!apps || !apps.length) {
        return m.reply(`❌ لم يتم العثور على أي تطبيقات باسم: "${query}".`);
      }

      let text = `📱 *نتائج البحث عن تطبيقات أندرويد*\n🔎 البحث: *${query}*\n\n`;

      apps.forEach((app, idx) => {
        const stars = app.rating ? `⭐ ${app.rating}/5` : 'غير متوفر';
        const security =
          app.malware === 'TRUSTED' ? '✅ آمن وموثوق (TRUSTED)' : (app.malware || 'غير محدد');
        const downloads = app.downloads ? Number(app.downloads).toLocaleString() : 'غير معروف';

        text += `╭─「 *${idx + 1}. ${app.name}* 」\n`;
        if (app.package) text += `│ 📦 الحزمة: \`${app.package}\`\n`;
        if (app.version) text += `│ 🏷️ الإصدار: ${app.version}\n`;
        if (app.sizeHuman) text += `│ 💾 الحجم: ${app.sizeHuman}\n`;
        text += `│ ⭐ التقييم: ${stars}\n`;
        text += `│ 📥 التحميلات: ${downloads}\n`;
        text += `│ 🛡️ الأمان: ${security}\n`;
        if (app.apkUrl) text += `│ 🔗 الرابط المباشر:\n│ ${app.apkUrl}\n`;
        text += `╰────────────────\n\n`;
      });

      const buttons = apps
        .filter((app) => app.apkUrl)
        .slice(0, 3)
        .map((app) => ({
          label: `📥 نسخ رابط ${app.name}`.slice(0, 40),
          id: `copy:${app.apkUrl}`,
        }));

      if (buttons.length > 0) {
        return sendQuickReplies(sock, m.jid, {
          title: '📱 تحميل APK مباشر',
          text: text.trim(),
          buttons,
        });
      }

      return sendText(sock, m.jid, text.trim());
    } catch (err) {
      console.error('❌ خطأ في بحث APK:', err.message?.slice(0, 80));
      return m.reply('❌ حدث خطأ أثناء البحث عن التطبيقات، يرجى المحاولة لاحقاً.');
    }
  },
};
