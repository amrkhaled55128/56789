import { sendQuickReplies } from '../../core/send.js';
import api from '../../core/api.js';

export default {
  name: 'simsimi',
  aliases: ['هزر', 'شات'],
  description: 'هزار شاذح مع سيم سيمي — البوت اللي مبيحترمش حد 😂',
  usage: '.simsimi كلامك',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();
    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '😂 سيم سيمي — أمير الهزار الشاذح',
        text: 'اكتب: `.simsimi ازيك` — وابعتله أي حاجة وهيستاهلك 😄',
        buttons: [
          { label: '😜 ازيك يا واد', id: '.simsimi ازيك يا واد' },
          { label: '🍕 عايز اكل', id: '.simsimi عايز اكل' },
        ],
      });
    }
    const reply = await api.simsimi(text);
    await m.reply(`😂 ${reply}`);
  },
};
