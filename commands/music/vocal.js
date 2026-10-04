import { sendText, sendAudio } from '../../core/send.js';
import api from '../../core/api.js';
import { audioToUrl } from '../../core/media.js';
import { downloadYoutube } from '../../core/yt.js';
import { uploadBuffer } from '../../core/media.js';
import { bump } from '../../core/stats.js';

// 🎤 .vocal — فصل الغناء عن الموسيقى (رد على صوت، أو لينك يوتيوب)
export default {
  name: 'vocal',
  aliases: ['فصل', 'موسيقى-سادة'],
  description: 'فصل الغناء عن الموسيقى — رد على صوت أو .vocal لينك يوتيوب',
  usage: '.vocal',
  async execute(sock, m, args) {
    let audioUrl = await audioToUrl(m);

    // ⚠️ كان بيرجّع لينك الـ API مباشرة — ودي ميتة (صفحات إعلانات)
    // فالفصل كان بيفشل. دلوقتي yt-dlp بينزّل الملف، وبعدين نرفعه
    // عشان الـ API تقدر تاخده (هي محتاجة رابط مش ملف).
    if (!audioUrl) {
      const link = args.find((a) => /youtu/i.test(a));
      if (link) {
        try {
          await sendText(sock, m.jid, '⏳ بجيب الأغنية من يوتيوب...');
          const buffer = await downloadYoutube(link, 'audio');
          audioUrl = await uploadBuffer(buffer, 'audio.mp3', 'audio/mpeg');
          if (!audioUrl) throw new Error('مرفوعش');
        } catch (err) {
          console.error('❌ تحميل يوتيوب فشل:', err.message?.slice(0, 70));
          return m.reply('😵 مقدرتش أجيب الأغنية من اللينك ده — جرّب تاني');
        }
      }
    }
    if (!audioUrl) {
      return m.reply('اعمل *رد* على رسالة صوتية فيها الأغنية واكتب `.vocal`، أو ابعت: `.vocal لينك-يوتيوب`');
    }

    await sendText(sock, m.jid, '🎚️ بفصل الصوت... بياخد دقيقة تقريبًا');
    let res;
    try {
      res = await api.vocalRemover(audioUrl);
    } catch (err) {
      console.error('❌ فشل الفصل:', err.message?.slice(0, 70));
      return m.reply('😵 الفصل مانفعش — جرّب مقطع أقصر أو صوت أوضح');
    }
    if (!res.vocal && !res.music) return m.reply('😵 مقدرتش أفصل الصوت ده — جرّب تاني');

    bump('downloads');
    if (res.vocal) await sendAudio(sock, m.jid, res.vocal, { caption: '🎤 الغناء بس' });
    if (res.music) await sendAudio(sock, m.jid, res.music, { caption: '🎹 الموسيقى بس' });
  },
};
