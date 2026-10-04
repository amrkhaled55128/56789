import { MB } from '@rexxhayanasi/elaina-baileys';
import { config } from '../config.js';
import { bump } from './stats.js';
import { fetchMedia, toOggOpus, toMp4, toJpeg } from './fetchmedia.js';

// ⚠️ قواعد الأزرار في واتساب (من كود واتساب ويب نفسه):
// - الأزرار السريعة (quick_reply) لحد 10 لكل رسالة
// - الأنواع التانية (روابط/نسخ/مكالمات) لحد 3 لكل رسالة
// - الأنواع ممنوع تختلط مع بعض في رسالة واحدة — العميل بيرفض الرسالة كلها
// - قوائم single_select بتظهر على أندرويد بس، وباقي الأجهزة بتحوّلها نص

function defaultFooter() {
  return `${config.botName} ${config.botEmoji}`;
}

// 🛡️ سقف حجم الوسائط — من غير حد، رابط وحش بيطلع OOM على Railway
const MAX_DOWNLOAD = 64 * 1024 * 1024; // 64MB

// إرسال نص عادي
export async function sendText(sock, jid, text, extra = {}) {
  return sock.sendMessage(jid, { text, ...extra });
}

// ─────────────────────────────────────────────────────────────
// 📥 إرسال الوسائط
//
// ⚠️ كان كله بيعمل `{ url }` وبيسلّم الرابط لواتساب يشيله بنفسه. ده بيفشل
// في حالات كتير: لينك بيتحوّل Redirect، سيرفر بيطلب.headers، أو نتيجة
// الـAPI بترجّع صفحة HTML مش ملف. وWhatsApp بيطلّع رسالة "media upload
// failed" من غير سبب مفهوم.
//
// دلوقتي: بننزّل إحنا (معUser-Agent + تحويلات + meta-refresh)، نتأكد إن
// اللي نزل media فعلاً، نحوّله للصيغة اللي واتساب عايزها، وبعدين نبعت
// Buffer — فمفيش اعتماد على إن واتساب يقدر يوصل.
// ─────────────────────────────────────────────────────────────

// 🎙️ رسالة صوتية (voice note) — لازم OGG/Opus وإلا مش بيشتغل
export async function sendVoice(sock, jid, audioUrl, extra = {}) {
  bump('voices');
  try {
    const { buffer } = await fetchMedia(audioUrl, { expect: 'audio' });
    const ogg = await toOggOpus(buffer);
    return await sock.sendMessage(jid, {
      audio: ogg,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
      ...extra,
    });
  } catch (err) {
    console.error('⚠️ فشل الإرسال الصوتي:', err.message?.slice(0, 70));
    // احتياطي: ابعت الملف زي ما هو كـ audio عادي (مش voice note)
    try {
      const { buffer, type } = await fetchMedia(audioUrl, {});
      return await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: type,
        ...extra,
      });
    } catch {
      return m_reply(sock, jid, '🎙️ مقدرتش أبعت الصوت ده — اللينك مش صالح');
    }
  }
}

// 🎵 صوت/أغنية (مش voice note) — MP3 هو المقبول
export async function sendAudio(sock, jid, audioUrl, extra = {}) {
  try {
    const { buffer, type } = await fetchMedia(audioUrl, { expect: 'audio' });
    return await sock.sendMessage(jid, {
      audio: buffer,
      mimetype: /mp3|mpeg/i.test(type) ? 'audio/mpeg' : type,
      ...extra,
    });
  } catch (err) {
    console.error('⚠️ فشل الإرسال الصوتي:', err.message?.slice(0, 70));
    return m_reply(sock, jid, '🎵 مقدرتش أحمّل الصوت ده — جرّب تاني');
  }
}

// 🖼️ صورة
export async function sendImage(sock, jid, imageUrl, caption, extra = {}) {
  try {
    const { buffer, type } = await fetchMedia(imageUrl, { expect: 'image' });
    return await sock.sendMessage(jid, {
      image: buffer,
      mimetype: /jpe?g/i.test(type) ? 'image/jpeg' : type,
      caption,
      ...extra,
    });
  } catch (err) {
    console.error('⚠️ فشل الإرسال:', err.message?.slice(0, 70));
    // لو الصورة WebP واتساب مش بيقبلها — حوّلها JPEG
    try {
      const { buffer } = await fetchMedia(imageUrl, {});
      const jpg = await toJpeg(buffer);
      return await sock.sendMessage(jid, { image: jpg, mimetype: 'image/jpeg', caption, ...extra });
    } catch {
      return m_reply(sock, jid, '🖼️ مقدرتش أبعت الصورة دي');
    }
  }
}

// 🎬 فيديو — WhatsApp بيقبل MP4 بس عمليًا
export async function sendVideo(sock, jid, videoUrl, caption, extra = {}) {
  try {
    const { buffer, type } = await fetchMedia(videoUrl, { expect: 'video' });
    if (/mp4/i.test(type)) {
      return await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption, ...extra });
    }
    // webm/mkv — حوّله
    const mp4 = await toMp4(buffer, { height: 720 });
    return await sock.sendMessage(jid, { video: mp4, mimetype: 'video/mp4', caption, ...extra });
  } catch (err) {
    console.error('⚠️ فشل الفيديو:', err.message?.slice(0, 70));
    return m_reply(sock, jid, '🎬 مقدرتش أبعت الفيديو — جرّب تاني');
  }
}

// 🌀 GIF — لازم MP4 مع gifPlayback (مش رابط .gif خام)
export async function sendGif(sock, jid, gifUrl, caption, extra = {}) {
  try {
    const { buffer, type } = await fetchMedia(gifUrl, { expect: 'video' });
    const mp4 = /mp4/i.test(type) ? buffer : await toMp4(buffer, { height: 480 });
    return await sock.sendMessage(jid, {
      video: mp4,
      mimetype: 'video/mp4',
      gifPlayback: true,
      caption,
      ...extra,
    });
  } catch (err) {
    console.error('⚠️ فشل الـGIF:', err.message?.slice(0, 70));
    return m_reply(sock, jid, '🌀 مقدرتش أبعت الـGIF');
  }
}

// 🧹 رسالة خطأ قصيرة من غير ما نكسر المسار
function m_reply(sock, jid, text) {
  return sock.sendMessage(jid, { text }).catch(() => {});
}

// ═════════════════════════════════════════════════════════════
// 📩 كارت تفاعلي: أزرار سريعة + (اختياري) قائمة منسدلة + (اختياري) منشن
//
// ⚠️ لازم نمرّ على MB.Button مش sock.sendMessage مباشرة:
// sendMessage مش بيسلّم (serialize) الـ interactiveMessage صح، وبيضيّع عقدة
// biz/native_flow اللي بتقول لواتساب إن الأزرار تفاعلية → الرسالة بتوصل والأزرار ميتة.
//
// buttons  → [{ label, id }]           أزرار سريعة (لحد 10)
// sections → [{ title, rows: [...] }]  قائمة منسدلة (single_select)
// mentions → ['jid@s.whatsapp.net']    عشان يوصّل الإشعارات للمنشن
export async function sendQuickReplies(sock, jid, {
  text,
  title,
  footer,
  buttons = [],
  sections = null,
  selectTitle = 'اختر من القائمة',
  mentions = null,
}) {
  const list = [...buttons];
  if (list.length > 10) list.length = 10; // حد واتساب 10 أزرار
  const extra = mentions?.length ? { mentions } : {};

  // مفيش أزرار ولا قوائم → نص عادي (أرخص وأضمن من كارت فاضي)
  if (!list.length && !sections?.length) {
    return sock.sendMessage(jid, { text: String(text ?? ''), ...extra });
  }

  try {
    const b = new MB.Button(sock);
    if (title) b.setTitle(title);
    b.setBody(String(text ?? '')).setFooter(footer ?? defaultFooter());

    // لازم تتبني الأول عشان تيجي في البايان
    if (sections?.length) {
      b.addSelection(selectTitle);
      for (const s of sections) {
        b.makeSection(s.title ?? '');
        for (const r of s.rows) b.makeRow(r.header ?? '', r.title, r.description ?? '', r.id);
      }
    }

    for (const btn of list) {
      const label = String(btn.label).slice(0, 40);
      // 📋 زر نسخ حقيقي في واتساب — بينسخ الصيغة لما تدوس عليه
      if (typeof btn.id === 'string' && btn.id.startsWith('copy:')) {
        b.addCopy(label, btn.id.slice(5));
      } else {
        b.addReply(label, btn.id);
      }
    }

    return await b.send(jid);
  } catch (err) {
    console.error('⚠️ الأزرار فشلت، هرجّع نص:', err.message?.slice(0, 80));
    let fallback = title ? `╭─「 ${title} 」\n\n` : '';
    fallback += String(text ?? '');
    for (const btn of list) fallback += `\n▸ ${btn.id.replace('copy:', '')}`;
    for (const s of sections ?? []) {
      fallback += `\n\n◆ ${s.title ?? ''}`;
      for (const r of s.rows) fallback += `\n  • ${r.id}`;
    }
    fallback += '\n╰───────────';
    return sock.sendMessage(jid, { text: fallback, ...extra });
  }
}

// رسالة تفاعلية (نفس sendQuickReplies —kept للتوافق مع الأوامر القديمة)
export async function sendInteractive(sock, jid, opts) {
  return sendQuickReplies(sock, jid, opts);
}

// 🎠 كاروسيل: كروت بتتقلب — كل كارو لازم يكون فيه صورة أو فيديو
export async function sendCarousel(sock, jid, { body, footer, cards = [] }) {
  const built = [];
  for (const c of cards) {
    const b = new MB.Button(sock)
      .setImage(c.image)
      .setBody(c.body ?? '')
      .setFooter(footer ?? defaultFooter());
    for (const btn of (c.buttons ?? []).slice(0, 3)) {
      if (btn.url) b.addUrl(btn.label, btn.url);
      else b.addReply(btn.label, btn.id);
    }
    built.push(await b.toCard());
  }
  const carousel = new MB.Carousel(sock)
    .setBody(body)
    .setFooter(footer ?? defaultFooter())
    .addCard(built);
  await carousel.send(jid);
}

// 📊 استطلاع رأي (Poll)
export async function sendPoll(sock, jid, { name, values, selectableCount = 1 }) {
  return sock.sendMessage(jid, { poll: { name, values, selectableCount } });
}

// 🤖 كارت غني بشكل Meta AI — نص + كود + جدول + اقتراحات
export async function sendRich(sock, jid, { title, footer, text, code, table, suggestions }) {
  const rich = new MB.AIRich(sock);
  if (title) rich.setTitle(title);
  if (footer) rich.setFooter(footer);
  if (text) rich.addText(text);
  if (code) rich.addCode(code.language ?? 'javascript', code.value ?? code);
  if (table) rich.addTable(table);
  if (suggestions) rich.addSuggest(suggestions);
  await rich.send(jid);
}
