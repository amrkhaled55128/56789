import { sendImage, sendText, sendQuickReplies } from '../../core/send.js';
import { imageToUrl } from '../../core/protection.js';
import api from '../../core/api.js';

// 🎨 .editimage / .edit — تعديل الصور بالذكاء الاصطناعي
export default {
  name: 'editimage',
  aliases: ['تعديل_صورة', 'عدل_صورة', 'editimg', 'عدل', 'edit'],
  description: 'تعديل الصور بالذكاء الاصطناعي بواسطة برومبت — .edit [الوصف] (بالرد على صورة أو إرفاقها)',
  usage: '.edit [الوصف]  (رد على صورة أو مع صورة)',
  async execute(sock, m, args) {
    const quoted = m.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const hasImage = !!(m.message?.imageMessage || quoted?.imageMessage);

    if (!hasImage) {
      return m.reply(
        '📷 *تعديل الصور بالذكاء الاصطناعي*\n\n' +
        'قم بالرد على صورة أو إرفاق صورة مع كتابة الوصف:\n' +
        '`.edit [الوصف المطلوب]`\n\n' +
        '💡 *أمثلة:*\n' +
        '• `.edit خليه لابس بدلة فضاء فخمة`\n' +
        '• `.edit حول الصورة لكرتون أنمي نيون`\n' +
        '• `.edit ضيف خلفية شاطئ وغروب شمس`'
      );
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      return m.reply('✍️ اكتب الوصف أو التعديل المطلوب مع الصورة!\nمثال: `.edit حولها لكرتون 3D`');
    }

    await sendText(sock, m.jid, '🎨 جاري تعديل الصورة بالذكاء الاصطناعي... استنى شوية');

    const url = await imageToUrl(m);
    if (!url) {
      return m.reply('❌ تعذر استخراج أو رفع الصورة — حاول مرة تانية');
    }

    try {
      const editedUrl = await api.vexEditImage(url, prompt);
      if (!editedUrl) {
        return m.reply('⚠️ تعذر تعديل الصورة — جرب صورة أوضح أو برومبت مختلف');
      }

      await sendImage(
        sock,
        m.jid,
        editedUrl,
        `🎨 *تم تعديل الصورة بالذكاء الاصطناعي!*\n📝 *الوصف:* ${prompt}`,
      );

      await sendQuickReplies(sock, m.jid, {
        text: '✨ اختيارات سريعة:',
        buttons: [
          { label: '🎬 تحويل إلى فيديو', id: `.video ${prompt}` },
          { label: '🎨 تعديل آخر', id: `.edit ${prompt}` },
        ],
      }).catch(() => {});
    } catch (err) {
      console.error('❌ خطأ في تعديل الصورة:', err.message?.slice(0, 80));
      return m.reply('❌ حدث خطأ أثناء تعديل الصورة، يرجى المحاولة لاحقاً.');
    }
  },
};
