import { requireAdmin, targetOf } from '../../core/groupadmin.js';

// 🫥 .hidetag — منشن لنص مخفي (الشخص المُنشَن بس هو اللي يشوف الرسالة)
export default {
  name: 'hidetag',
  aliases: ['تاج_مخفي', 'منشن_مخفي'],
  description: 'منشن لنص مخفي — الشخص التاني بس يشوفه (للأدمن)',
  usage: '.hidetag @شخص الرسالة',
  async execute(sock, m, args) {
    if (await requireAdmin(sock, m, 'التاج المخفي')) return;

    const target = targetOf(m);
    if (!target) return m.reply('منشن الشخص: `.hidetag @شخص الرسالة`');
    const text = args.slice(1).join(' ').trim();
    if (!text) return m.reply('اكتب الرسالة: `.hidetag @شخص الرسالة`');

    // 👻 المنشن بيوقّع الرسالة عند الشخص ده، والباقي ما يشوفش حاجة
    return sock.sendMessage(m.jid, { text, mentions: [target] });
  },
};
