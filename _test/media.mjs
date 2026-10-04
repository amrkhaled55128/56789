/**
 * 🎬 اختبار الوسائط — الطبقة اللي كانت بتكسر الفيديو والصوت.
 *
 * التشغيل: node _test/media.mjs
 * (بيحتاج شبكة — بيفحص الـAPI الحقيقي)
 */
import { kindOf } from '../core/fetchmedia.js';

let pass = 0;
let fail = 0;
const check = (label, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};

console.log('\n🎯 تصنيف الملفات (اللي كان بيغلط)');
// ⭐ elevenlabs بيرجّع .mpeg صوتي بس content-type = video/mpeg
check('`.mpeg` الصوتي اتصنّف صوت (كان بيتصنّف فيديو)',
  kindOf('video/mpeg', 'https://x.io/a.mpeg') === 'audio');
check('mp3 عادي', kindOf('audio/mpeg', 'https://x.io/a.mp3') === 'audio');
check('mp4 فيديو', kindOf('video/mp4', 'https://x.io/a.mp4') === 'video');
check('webm فيديو', kindOf('video/webm', 'https://x.io/a.webm') === 'video');
check('opus صوت', kindOf('audio/ogg', 'https://x.io/a.opus') === 'audio');
check('صورة jpg', kindOf('image/jpeg', 'https://x.io/a.jpg') === 'image');
check('بلا امتداد + video/mpeg', kindOf('video/mpeg', 'https://x.io/abc') === 'video');
check('URL فيه query', kindOf('video/mpeg', 'https://x.io/a.mpeg?token=1') === 'audio');

// اختبارات التكامل تتطلب شبكة وتستهلك وقت/موارد؛ ما تشتغلش ضمن الفحوص المحلية العادية.
// تشغيل اختياري: MEDIA_INTEGRATION=1 node _test/media.mjs
if (process.env.MEDIA_INTEGRATION === '1') {
  const { fetchMedia, toOggOpus } = await import('../core/fetchmedia.js');
  const api = (await import('../core/api.js')).default;

  console.log('\n🎙️ TTS (الصوت)');
  for (const [label, fn] of [
    ['غوكو (أنمي)', () => api.animeTts('أهلاً بيك يا صاحبي', 'غوكو')],
    ['فارس (ElevenLabs)', () => api.tts('أهلاً بيك', { voice: '12' })],
  ]) {
    try {
      const url = await fn();
      if (!url) { check(label, false, '→ مفيش URL'); continue; }
      const { buffer } = await fetchMedia(url, { expect: 'audio' });
      const ogg = await toOggOpus(buffer);
      check(`${label} → نزل ${(buffer.length / 1024).toFixed(0)}KB وحوّل لـ Opus`, ogg.length > 1000);
    } catch (err) {
      check(label, false, `→ ${err.message.slice(0, 70)}`);
    }
  }

  console.log('\n🎬 تحميل يوتيوب (كان ميت بسبب SaveNow)');
  const { downloadYoutube, ytdlAvailable } = await import('../core/yt.js');
  check('yt-dlp متاح', await ytdlAvailable());
  for (const kind of ['audio', 'video']) {
    try {
      const buf = await downloadYoutube('https://www.youtube.com/watch?v=fGFB29lQ-Vs', kind);
      check(`${kind} نزل ${(buf.length / 1024 / 1024).toFixed(2)}MB`, buf.length > 100000);
    } catch (err) {
      check(kind, false, `→ ${err.message.slice(0, 70)}`);
    }
  }

  console.log('\n🖼️ توليد الصور/الفيديو');
  try {
    const img = await api.image('قطة لطيفة');
    check(`صورة: ${String(img).slice(0, 40)}`, !!img);
  } catch (err) { check('صورة', false, `→ ${err.message.slice(0, 60)}`); }

  try {
    const { buffer } = await fetchMedia(await api.removeBg('https://picsum.photos/300'), { expect: 'image' });
    check(`خلفية اتشالت: ${(buffer.length / 1024).toFixed(0)}KB`, buffer.length > 1000);
  } catch (err) { check('removebg', false, `→ ${err.message.slice(0, 60)}`); }
}

console.log(`\n${'─'.repeat(46)}`);
console.log(`✅ نجح: ${pass}   ❌ فشل: ${fail}`);
process.exit(fail ? 1 : 0);
