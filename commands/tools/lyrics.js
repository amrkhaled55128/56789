import { sendQuickReplies } from '../../core/send.js';
import api from '../../core/api.js';

// 📝 .lyrics — كلمات الأغاني
export default {
  name: 'lyrics',
  aliases: ['كلمات'],
  description: 'كلمات أي أغنية — .lyrics اسم الأغنية',
  usage: '.lyrics Faded Alan Walker',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();
    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '📝 كلمات الأغاني',
        text: 'اكتب اسم الأغنية (والمغني أفضل)، مثال:\n`.lyrics Faded Alan Walker`',
        buttons: [{ label: '🎧 Faded', id: '.lyrics Faded Alan Walker' }],
      });
    }
    const parts = text.split(/\s+/);
    // لو آخر كلمتين شكلهم مغني وأغنية، نجرب كده — الـ API بيلاقي بنفسه
    const res = await api.lyrics(text);
    if (!res.lyrics) return m.reply('😕 ملقيتش كلمات للأغنية دي — اكتب الاسم بالإنجليزي لو تقدر');
    const header = `📝 *${res.title ?? text}*\n${res.artist && res.artist !== res.title ? `🎤 ${res.artist}\n` : ''}\n`;
    const body = res.lyrics.length > 3500 ? res.lyrics.slice(0, 3500) + '\n\n... (الباقي كتير)' : res.lyrics;
    void parts;
    return m.reply(header + body);
  },
};
