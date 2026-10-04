import { sendText, sendQuickReplies } from '../../core/send.js';
import { downloadYoutube } from '../../core/yt.js';
import { toOggOpus } from '../../core/fetchmedia.js';
import { db } from '../../core/db.js';

// 🔗 .getlink — أمر داخلي لأزرار التحميل التلقائي من لينكات يوتيوب
export default {
  name: 'getlink',
  aliases: ['get'],
  description: 'تحميل من آخر لينك يوتيوب اتبعت في الشات (بيشتغل من الأزرار)',
  usage: '.getlink audio|360|720',
  async execute(sock, m, args) {
    const format = (args[0] ?? '').toLowerCase();
    const cached = db.get('linkCache', {})[m.jid];
    if (!cached?.link) return m.reply('مفيش لينك محفوظ — ابعت لينك يوتيوب الأول');

    if (!['audio', '360', '720'].includes(format)) {
      return sendQuickReplies(sock, m.jid, {
        title: '🎬 لينك يوتيوب',
        text: 'اختار الصيغة اللي عايزها 👇',
        buttons: [
          { label: '🎧 صوت', id: '.getlink audio' },
          { label: '🎬 360', id: '.getlink 360' },
          { label: '🎬 720', id: '.getlink 720' },
        ],
      });
    }

    const isAudio = format === 'audio';
    await sendText(sock, m.jid, `⏳ بجيب ${isAudio ? 'الصوت' : 'الفيديو'}… استنى`);

    let buffer;
    try {
      buffer = await downloadYoutube(cached.link, isAudio ? 'audio' : 'video', {
        height: format === '720' ? 720 : 360,
      });
    } catch (err) {
      console.error('❌ التحميل فشل:', err.message?.slice(0, 80));
      return m.reply(
        '😵 التحميل مانفعش.\n' +
          '💡 يوتيوب أحياناً بيحجب تحميل فيديو معيّن — جرّب تاني أو جرّب الصوت 🎧',
      );
    }

    try {
      if (isAudio) {
        const ogg = await toOggOpus(buffer).catch(() => null);
        return await sock.sendMessage(m.jid, {
          audio: ogg ?? buffer,
          mimetype: ogg ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
          filename: 'audio.mp3',
        });
      }
      return await sock.sendMessage(m.jid, { video: buffer, mimetype: 'video/mp4' });
    } catch {
      return m.reply('😵 الملف كبير أوي على واتساب — جرّب 360 أو الصوت 🎧');
    }
  },
};
