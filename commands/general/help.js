import { sendQuickReplies } from '../../core/send.js';
import { config } from '../../config.js';

// 📖 .help — شرح أي أمر بالتفصيل + جرد تلقائي من الأوامر نفسها
export default {
  name: 'help',
  aliases: ['شرح', 'مساعدة'],
  description: 'شرح الأوامر — .help  للقائمة أو  .help اسم الأمر',
  usage: '.help song',
  async execute(sock, m, args, ctx) {
    const name = (args[0] ?? '').toLowerCase().replace(config.prefix, '');

    if (name) {
      const cmd = ctx.commands.get(name);
      if (!cmd) return m.reply(`😕 مفيش أمر اسمه \`${name}\` — جرّب \`.help\` وشوف كل حاجة`);
      return m.reply(
        [
          `📖 *${config.prefix}${cmd.name}*`,
          `${cmd.description ?? 'بدون وصف'}`,
          '',
          `📂 القسم: ${cmd.category}`,
          `🎯 الاستخدام: ${cmd.usage ?? config.prefix + cmd.name}`,
          cmd.aliases?.length ? `🔁 بدائل: ${cmd.aliases.map((a) => config.prefix + a).join(' • ')}` : '',
        ].filter(Boolean).join('\n'),
      );
    }

    const sections = [...ctx.categories.entries()]
      .filter(([, cmds]) => cmds.length)
      .map(([cat, cmds]) => ({
        title: cat,
        rows: cmds.map((c) => ({
          title: `${config.prefix}${c.name}`.slice(0, 24),
          description: c.description ?? 'بدون وصف',
          id: `.help ${c.name}`,
        })),
      }));

    return sendQuickReplies(sock, m.jid, {
      title: '📖 شرح الأوامر',
      text: 'اكتب `.help اسم الأمر` عشان تفاصيله، أو اختار من القائمة 👇',
      sections,
      selectTitle: '📚 اختار أمر تشوف شرحه',
    });
  },
};
