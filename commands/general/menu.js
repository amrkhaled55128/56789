import { mainMenu, sectionMenu, usageScreen } from '../../core/menu.js';

// 🗂️ .menu — القائمة الرئيسية الفخمة للبوت
export default {
  name: 'menu',
  aliases: ['القائمه', 'الاوامر', 'الأوامر', 'الرئيسيه', 'الرئيسية', 'قائمه', 'اوامري', 'أوامري'],
  description: 'القائمة الرئيسية الفخمة — تصفح كل الأقسام والأوامر بالعربي',
  usage: '.الاوامر  أو  .الاوامر <اسم القسم>  أو  .الاوامر كلها',
  async execute(sock, m, args, ctx) {
    const rawTarget = args.join(' ').trim();
    if (rawTarget && rawTarget !== 'back' && rawTarget !== 'رجوع' && rawTarget !== 'رجوع_للرئيسيه') {
      return sectionMenu(sock, m.jid, rawTarget, ctx);
    }
    return mainMenu(sock, m.jid, '', ctx);
  },
};

// 📋 .usage — شرح أي أمر + نسخ الصيغة
export const usageCommand = {
  name: 'usage',
  aliases: ['الصيغه', 'الصيغة', 'صيغه', 'صيغة', 'الصيغ', 'استخدام_الامر', 'صيغة_الأمر'],
  description: 'شرح أي أمر وطريقة كتابته مع زر نسخ الصيغة',
  usage: '.صيغة <اسم الأمر>',
  async execute(sock, m, args, ctx) {
    const name = (args[0] ?? '').toLowerCase();
    const cmd = ctx.commands.get(name);
    if (!cmd) return m.reply(`😕 مفيش أمر اسمه "${name}" — اكتب \`.الاوامر\` عشان تشوف الأوامر المتاحة.`);
    return usageScreen(sock, m.jid, cmd, ctx);
  },
};
