import { sendQuickReplies, sendText } from '../../core/send.js';
import { downloadYoutube } from '../../core/yt.js';
import { toOggOpus } from '../../core/fetchmedia.js';
import api from '../../core/api.js';
import { db } from '../../core/db.js';

// 🎵 .song — ابحث عن أغنية → اختار من الأزرار → تبعتلك الصوت

function cache() {
  return db.get('searchCache', {});
}

function saveCache(jid, results) {
  const all = cache();
  all[jid] = { type: 'song', results, at: Date.now() };
  db.set('searchCache', all);
}

function loadCache(jid, type) {
  const c = cache()[jid];
  if (!c || c.type !== type || Date.now() - c.at > 5 * 60 * 1000) return null;
  return c.results;
}

export default {
  name: 'song',
  aliases: ['اغنية', 'أغنية'],
  description: 'حمّل أي أغنية صوت — .song اسم الأغنية',
  usage: '.song عمرو دياب خليك معايا',
  async execute(sock, m, args) {
    const text = args.join(' ').trim();

    // اختيار من النتايج المحفوظة: .song dl-<رقم> → أزرار الجودة، وبعدين dl-<رقم>-<صيغة>
    const pick = /^dl-(\d)(?:-(audio|360|720))?$/.exec(text);
    if (pick) {
      const results = loadCache(m.jid, 'song');
      const idx = Number(pick[1]);
      const r = results?.[idx];
      if (!r) return m.reply('⌛ النتايج قديمة — ابحث تاني: `.song اسم الأغنية`');

      // أول ضغطة → أزرار الجودة
      if (!pick[2]) {
        return sendQuickReplies(sock, m.jid, {
          title: `🎵 ${r.title.slice(0, 40)}`,
          text: `${r.duration ? `🕒 ${r.duration} • ` : ''}${r.author ?? ''}\n\nاختار الصيغة اللي عايزها 👇`,
          buttons: [
            { label: '🎧 صوت (خفيف)', id: `.song dl-${idx}-audio` },
            { label: '🎬 فيديو 360', id: `.song dl-${idx}-360` },
            { label: '🎬 فيديو 720', id: `.song dl-${idx}-720` },
          ],
        });
      }

      const format = pick[2];
      const isAudio = format === 'audio';
      await sendText(sock, m.jid, `⏳ بجيب ${isAudio ? 'الصوت' : 'الفيديو'}… استنى شوية`);

      // ⚠️ كان بيرجّع لينك من API (savenow.to) اللي بقى صفحات إعلانات
      // فـ sendAudio كان بينزّل HTML وبيفشل. دلوقتي yt-dlp بينزّل الملف
      // مباشرة والـAPI بقي احتياط.
      let buffer;
      try {
        buffer = await downloadYoutube(r.url, isAudio ? 'audio' : 'video', {
          height: format === '720' ? 720 : 360,
        });
      } catch (err) {
        console.error('❌ التحميل فشل:', err.message?.slice(0, 80));
        return m.reply(
          '😵 مقدرش أجيب الملف ده.\n' +
            '💡 جرّب أغنية تانية، أو جرّب الصيغة الصوتية 🎧\n' +
            'أحياناً يوتيوب بيحجب تحميل فيديو معيّن',
        );
      }

      const caption = `${isAudio ? '🎵' : '🎬'} ${r.title ?? ''}`;
      if (isAudio) {
        const ogg = await toOggOpus(buffer).catch(() => null);
        return sock.sendMessage(m.jid, {
          audio: ogg ?? buffer,
          mimetype: ogg ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
          filename: `${(r.title ?? 'audio').slice(0, 40)}.mp3`,
          caption,
        });
      }
      return sock.sendMessage(m.jid, {
        video: buffer,
        mimetype: 'video/mp4',
        fileName: `${(r.title ?? 'video').slice(0, 40)}.mp4`,
        caption,
      });
    }

    if (!text) {
      return sendQuickReplies(sock, m.jid, {
        title: '🎵 محمّل الأغاني',
        text: 'اكتب اسم الأغنية، مثال:\n`.song عمرو دياب خليك معايا`\n\nولو عايز فيديو: `.video اسم الفيديو`',
        buttons: [
          { label: '🎤 عمرو دياب', id: '.song عمرو دياب خليك معايا' },
          { label: '🎸 انا بتبعني', id: '.song انا بتبعني احمد سعيد' },
        ],
      });
    }

    await sendText(sock, m.jid, `🔍 بدور على: *${text}*...`);
    const results = await api.ytSearch(text, 5);
    if (!results.length) return m.reply('😕 ملقيتش حاجة — جرب كلمات تانية');

    saveCache(m.jid, results);
    await sendQuickReplies(sock, m.jid, {
      title: '🎵 اختار الأغنية',
      text: 'دوس على اللي عايزها وهبعتلك الصوت 👇',
      sections: [
        {
          title: 'نتايج البحث',
          rows: results.map((r) => ({
            title: `🎵 ${String(r.title).slice(0, 22)}`,
            description: `${r.duration ?? ''} ${r.author ? '• ' + r.author : ''}`,
            id: `.song dl-${r.index}`,
          })),
        },
      ],
      selectTitle: '🎧 اختار الأغنية',
    });
  },
};
