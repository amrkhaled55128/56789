import { mainMenu, sectionMenu, usageScreen } from '../../core/menu.js';

// 🗂️ .menu — القائمة الرئيسية (3 مستويات: أقسام → أوامر → صيغ)
export default {
  name: 'menu',
  aliases: ['القائمه', 'الاوامر', 'الرئيسيه', 'قائمه', 'اوامري', 'الرئيسية'],
  description: 'القائمة الرئيسية — كل الأوامر مقسمة أقسام',
  usage: '.menu  أو  .menu <القسم>',
  async execute(sock, m, args, ctx) {
    const section = (args[0] ?? '').toLowerCase();
    if (section && section !== 'back' && section !== 'رجوع' && section !== 'رجوع_للرئيسيه') {
      return sectionMenu(sock, m.jid, section, ctx);
    }
    return mainMenu(sock, m.jid);
  },
};

// 📋 .usage — شرح أي أمر + زر نسخ الصيغة
export const usageCommand = {
  name: 'usage',
  aliases: ['الصيغه', 'صيفه', 'الصيغ', 'استخدام_الامر', 'صيغة_الأمر'],
  description: 'شرح أي أمر + نسخ صيغته',
  usage: '.usage <اسم الأمر>',
  async execute(sock, m, args, ctx) {
    const name = (args[0] ?? '').toLowerCase();
    const cmd = ctx.commands.get(name);
    if (!cmd) return m.reply(`😕 مفيش أمر اسمه "${name}" — شوف \`.menu\``);
    return usageScreen(sock, m.jid, cmd, ctx);
  },
};
