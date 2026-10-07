import { sendQuickReplies, sendText } from '../../core/send.js';
import { fetchMedia } from '../../core/fetchmedia.js';
import api from '../../core/api.js';

// 📦 .mediafire — فك وتحميل روابط ميديافاير مباشرة
export default {
  name: 'mediafire',
  aliases: ['ميديافاير', 'ميديا_فاير', 'mf'],
  description: 'تحميل الملفات والتطبيقات من ميديافاير مباشرة — .mediafire رابط',
  usage: '.mediafire https://www.mediafire.com/file/...',
  async execute(sock, m, args, ctx) {
    const url = args[0]?.trim();

    if (!url || !/mediafire\.com/i.test(url)) {
      return sendQuickReplies(sock, m.jid, {
        title: '📦 محمل ميديافاير (MediaFire)',
        text: 'ابعت رابط ملف ميديافاير عشان استرو ينزلهولك مباشرة!\n\n💡 *مثال:*\n`.mediafire https://www.mediafire.com/file/...`',
        buttons: [
          { label: '📥 أوامر التحميل', id: '.menu download' },
          { label: '🔙 القائمة الرئيسية', id: '.menu' },
        ],
      });
    }

    await sendText(sock, m.jid, '⏳ جاري فك وتجهيز رابط ميديافاير...');

    let info;
    try {
      info = await api.mediafire(url);
    } catch (err) {
      // إذا فشل الـ API
    }

    const downloadUrl = info?.url || info?.download_url || info?.link;
    const filename = info?.filename || info?.name || 'file';
    const filesize = info?.filesize || info?.size || '';

    if (!downloadUrl) {
      return m.reply('❌ تعذر استخراج رابط التحميل من هذا الملف، قد يكون محذوفاً أو محمياً بكلمة سر.');
    }

    await sendText(sock, m.jid, `📦 *الملف:* ${filename}\n📊 *الحجم:* ${filesize}\n\n⏳ جاري السحب والإرسال...`);

    try {
      const buffer = await fetchMedia(downloadUrl, { maxBytes: 95 * 1024 * 1024 }); // سقف واتساب للملفات
      return sock.sendMessage(m.jid, {
        document: buffer,
        fileName: filename,
        mimetype: 'application/octet-stream',
        caption: `📦 *${filename}*\n${filesize ? `📊 الحجم: ${filesize}\n` : ''}⚡ تم التحميل عبر ${ctx.config.botName}`,
      });
    } catch (err) {
      // لو الملف أكبر من 95 ميجا أو حصل خطأ في سحب البايتات
      return sendQuickReplies(sock, m.jid, {
        title: '📦 رابط التحميل المباشر',
        text: `الملف كبير جداً على واتساب أو مساحته تتخطى 95MB.\n\n📄 *الملف:* ${filename}\n📊 *الحجم:* ${filesize}\n\n🔗 تقدر تحمله مباشرة بالرابط السريع ده:\n${downloadUrl}`,
        buttons: [
          { label: '📋 نسخ الرابط', id: `copy:${downloadUrl}` },
          { label: '📥 قسم التحميل', id: '.menu download' },
        ],
      });
    }
  },
};
