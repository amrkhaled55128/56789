import { speakAs } from '../../core/tts.js';
import { sendQuickReplies } from '../../core/send.js';

// 🎭 .animevoice — كلام بصوت شخصيات مشهورة
export default {
  name: 'animevoice',
  aliases: ['صوتشخصية', 'صوت-انمي'],
  description: 'كلام بصوت شخصيات: غوكو، ميسي، ايمينيم... — .animevoice الشخصية النص',
  usage: '.animevoice غوكو أنا قادم',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();
    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '🎭 أصوات الشخصيات',
        text: 'اكتب: `.animevoice غوكو النص`\n\nالشخصيات المتاحة:\n🐉 غوكو • ⚽ ميسي • 🎤 ايمينيم • 🍜 ناروتو • 🏴‍☠️ لوفي',
        buttons: [
          { label: '🐉 غوكو', id: '.animevoice غوكو أنا سايان جاي من كوكب فيجيتا' },
          { label: '⚽ ميسي', id: '.animevoice ميسي الجول ده باين عليا' },
        ],
      });
    }
    const known = ['غوكو', 'ميسي', 'ايمينيم', 'ناروتو', 'لوفي', 'كرابس'];
    const first = text.split(/\s+/)[0];
    const character = known.find((c) => first.includes(c));
    const content = character ? text.slice(first.length).trim() : text;
    if (!content) return m.reply('اكتب النص بعد الشخصية: `.animevoice غوكو أنا قادم`');
    await speakAs(sock, m.jid, content.slice(0, 400), character ?? 'غوكو');
  },
};
