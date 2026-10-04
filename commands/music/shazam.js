import { sendText, sendImage } from '../../core/send.js';
import api from '../../core/api.js';
import { audioToUrl } from '../../core/media.js';
import { bump } from '../../core/stats.js';

// 🎵 .shazam — اعمل رد على أي رسالة صوتية → يقولك الأغنية إيه
export default {
  name: 'shazam',
  aliases: ['شازام', 'الاغنية دي'],
  description: 'اعرف اسم الأغنية — اعمل رد على رسالة صوتية فيها الأغنية واكتب .shazam',
  usage: '.shazam',
  async execute(sock, m) {
    await sendText(sock, m.jid, '🎧 بسمع الأغنية وأن identifyها...');
    const audioUrl = await audioToUrl(m);
    if (!audioUrl) {
      return m.reply('اعمل *رد* على رسالة صوتية فيها المقطع، واكتب `.shazam`');
    }
    const song = await api.shazem(audioUrl);
    if (!song?.title) return m.reply('😕 معرفتش أتعرف الأغنية — جرب مقطع أوضح وأطول شوية');

    bump('downloads');
    if (song.coverArt) {
      return sendImage(sock, m.jid, song.coverArt,
        `🎵 *${song.title}*\n🎤 ${song.artist ?? '—'}\n💿 ${song.album ?? ''}${song.releaseDate ? `\n📅 ${song.releaseDate}` : ''}`);
    }
    return m.reply(`🎵 *${song.title}*\n🎤 ${song.artist ?? '—'}`);
  },
};
