import { sendQuickReplies, sendText } from '../../core/send.js';
import api from '../../core/api.js';
import { db } from '../../core/db.js';
import { downloadYoutube } from '../../core/yt.js';
import { toOggOpus } from '../../core/fetchmedia.js';

// 🎬 .video — بحث يوتيوب → أزرار → تحميل فيديو وإرساله

function cache() {
  return db.get('searchCache', {});
}

function saveCache(jid, results) {
  const all = cache();
  all[jid] = { type: 'video', results, at: Date.now() };
  db.set('searchCache', all);
}

function loadCache(jid, type) {
  const c = cache()[jid];
  if (!c || c.type !== type || Date.now() - c.at > 5 * 60 * 1000) return null;
  return c.results;
}

export default {
  name: 'yt',
  aliases: ['يوتيوب', 'فيديو_يوتيوب', 'ytvideo', 'نزل_فيديو', 'dlvideo'],
  description: 'حمّل فيديو من يوتيوب بجودة عالية أو صوت — .يوتيوب <اسم الفيديو>',
  usage: '.يوتيوب توم وجيري حلقة كاملة',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();

    const pick = /^dl-(\d)(?:-(audio|360|720))?$/.exec(text);
    if (pick) {
      const results = loadCache(m.jid, 'video');
      const idx = Number(pick[1]);
      const r = results?.[idx];
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني: `.yt اسم الفيديو`');

      // أول ضغطة → أزرار الجودة
      if (!pick[2]) {
        return sendQuickReplies(sock, m.jid, {
          title: `🎬 ${r.title.slice(0, 40)}`,
          text: `${r.duration ? `🕒 ${r.duration} • ` : ''}${r.author ?? ''}\n\nاختار الجودة 👇`,
          buttons: [
            { label: '🎬 360 (خفيف)', id: `.yt dl-${idx}-360` },
            { label: '🎬 720 (واضح)', id: `.yt dl-${idx}-720` },
            { label: '🎧 صوت بس', id: `.yt dl-${idx}-audio` },
          ],
        });
      }

      const format = pick[2];
      const isAudio = format === 'audio';
      await sendText(sock, m.jid, `⏳ بجيب ${isAudio ? 'الصوت' : 'الفيديو'}… استنى`);

      let buffer;
      try {
        buffer = await downloadYoutube(r.url, isAudio ? 'audio' : 'video', {
          height: format === '720' ? 720 : 360,
        });
      } catch (err) {
        console.error('❌ التحميل فشل:', err.message?.slice(0, 80));
        return m.reply('😵 التحميل مانفعش — جرّب تاني أو جرّب 360');
      }

      try {
        if (isAudio) {
          const ogg = await toOggOpus(buffer).catch(() => null);
          return await sock.sendMessage(m.jid, {
            audio: ogg ?? buffer,
            mimetype: ogg ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
            filename: 'audio.mp3',
            caption: `🎵 ${r.title ?? ''}`,
          });
        }
        return await sock.sendMessage(m.jid, {
          video: buffer,
          mimetype: 'video/mp4',
          fileName: `${(r.title ?? 'video').slice(0, 40)}.mp4`,
          caption: `🎬 ${r.title ?? ''}`,
        });
      } catch {
        return m.reply('😵 الملف كبير أوي على واتساب — جرّب 360 أو الصوت 🎧');
      }
    }

    if (!text) return m.reply('🎬 اكتب اسم الفيديو، مثال:\n`.yt توم وجيري حلقة كاملة`');

    await sendText(sock, m.jid, `🔍 بدور على: *${text}*...`);
    const results = await api.ytSearch(text, 5);
    if (!results.length) return m.reply('😕 ملقيتش حاجة — جرب كلمات تانية');

    saveCache(m.jid, results);
    await sendQuickReplies(sock, m.jid, {
      title: '🎬 اختار الفيديو',
      text: 'دوس على اللي عايزه وهبعتلك الفيديو 👇',
      sections: [
        {
          title: 'نتايج البحث',
          rows: results.map((r) => ({
            title: `🎬 ${String(r.title).slice(0, 22)}`,
            description: `${r.duration ?? ''} ${r.author ? '• ' + r.author : ''}`,
            id: `.yt dl-${r.index}`,
          })),
        },
      ],
      selectTitle: '📺 اختار الفيديو',
    });
  },
};
