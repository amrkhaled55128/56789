import { speak, CHARACTERS } from '../../core/tts.js';
import { sendQuickReplies } from '../../core/send.js';

// 🎙️ .say — حوّل أي كلام لرسالة صوتية بصوت نوفا
export default {
  name: 'say',
  aliases: ['قول', 'اتكلم'],
  description: 'حوّل كلامك لرسالة صوتية — .say النص',
  usage: '.say أهلا يا معلم',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();
    if (!text) {
      const buttons = CHARACTERS.slice(0, 3).map((c) => ({ label: `🎙️ ${c}`, id: `.animevoice ${c} أهلا أنا ${c}` }));
      return sendQuickReplies(sock, m.jid, {
        title: '🎙️ مولد الصوت',
        text: 'اكتب: `.say النص اللي عايزه` — وهبعتلك إياه رسالة صوتية\nولو عايز صوت شخصية: `.animevoice غوكو النص`',
        buttons,
      });
    }
    if (text.length > 500) return m.reply('🤐 الكلام طويل أوي — خليه أقصر من 500 حرف');
    await speak(sock, m.jid, text);
  },
};
