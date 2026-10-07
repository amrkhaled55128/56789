import axios from 'axios';
import { config } from '../config.js';

// عميل موحد لـ API البوت — كل الأشكال هنا موثقة من التقرير الفعلي للـ API
const http = axios.create({
  baseURL: config.apiBaseUrl ?? 'https://engez.a7a.online',
  headers: { Accept: '*/*' },
  timeout: 30000,
});

// كشف "الفشل الصامت": HTTP 200 + success:false أو فشل داخلي
function unwrap(data, path) {
  if (!data || typeof data !== 'object') throw new Error(`رد غير متوقع من ${path}`);
  if (data.success === false) throw new Error(data.message ?? `فشل ${path}`);
  return data;
}

// 🔴 دائرة أمان — لكل endpoint لوحده.
//
// ⚠️ كانت العدّاد عام على الـ 22 endpoint كلهم: 5 إخفاقات من أي مصدر (حتى
// endpoint واحد ميت أو خطأ في بارامتر) كانت بتقفل الشات والصور والتحميل
// لكل الناس 3 دقايق كاملة. دلوقتي كل endpoint ليه عدّاده، فميت endpoint
// ميأثرش على الباقي. والـ endpoint لوحده بيختبر نفسه لما الوقت يخلص.
const FAIL_LIMIT = 4;
const OPEN_MS = 180000; // 3 دقايق

const breakers = new Map(); // path → { fails, openUntil, notified, state }
let ownerNotifier = null;
let statusListeners = new Set();

export function setOwnerNotifier(fn) {
  ownerNotifier = fn;
}

// الداشبورد كان بيقول "شغال" دايمًا (setApiStatus معرّفة ومش متنادى)
export function onApiStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function publishStatus() {
  const now = Date.now();
  const open = [...breakers.values()].filter((b) => b.openUntil > now).length;
  const status = open ? 'degraded' : 'ok';
  for (const fn of statusListeners) {
    try {
      fn(status, open);
    } catch {}
  }
  return status;
}

function notifyOwner(text) {
  try {
    ownerNotifier?.(text);
  } catch {}
}

function breakerOf(path) {
  let b = breakers.get(path);
  if (!b) {
    b = { fails: 0, openUntil: 0, notified: false, state: 'unknown' };
    breakers.set(path, b);
  }
  return b;
}

async function get(path, params = {}, timeout = 30000) {
  const b = breakerOf(path);

  if (Date.now() < b.openUntil) {
    throw new Error('الـ API في وضع آمن مؤقت — استنى شوية');
  }

  try {
    const { data } = await http.get(path, { params, timeout });
    const result = unwrap(data, path); // success:false يعتبر فشلًا، لا تعافياً
    // ✅ لم نعلن التعافي إلا بعد رد سليم فعلاً
    if (b.notified) notifyOwner(`🟢 الـ API رجع يشتغل: ${path}`);
    b.notified = false;
    b.state = 'ok';
    b.fails = 0;
    publishStatus();
    return result;
  } catch (err) {
    b.state = 'degraded';
    b.fails++;
    if (b.fails >= FAIL_LIMIT && Date.now() >= b.openUntil) {
      b.openUntil = Date.now() + OPEN_MS;
      b.state = 'open';
      b.fails = 0;
      b.notified = true;
      console.error(`🔴 ${path} دخل وضع آمن ${OPEN_MS / 1000} ثانية (فشل متكرر)`);
      notifyOwner(`🔴 تنبيه: ${path} فشل ${FAIL_LIMIT} مرات — وضع آمن ${OPEN_MS / 1000} ثانية`);
    }
    publishStatus();
    throw err;
  }
}

async function post(path, body = {}, timeout = 30000) {
  const b = breakerOf(path);

  if (Date.now() < b.openUntil) {
    throw new Error('الـ API في وضع آمن مؤقت — استنى شوية');
  }

  try {
    const { data } = await http.post(path, body, { timeout });
    const result = unwrap(data, path);
    if (b.notified) notifyOwner(`🟢 الـ API رجع يشتغل: ${path}`);
    b.notified = false;
    b.state = 'ok';
    b.fails = 0;
    publishStatus();
    return result;
  } catch (err) {
    b.state = 'degraded';
    b.fails++;
    if (b.fails >= FAIL_LIMIT && Date.now() >= b.openUntil) {
      b.openUntil = Date.now() + OPEN_MS;
      b.state = 'open';
      b.fails = 0;
      b.notified = true;
      console.error(`🔴 ${path} دخل وضع آمن ${OPEN_MS / 1000} ثانية (فشل متكرر)`);
      notifyOwner(`🔴 تنبيه: ${path} فشل ${FAIL_LIMIT} مرات — وضع آمن ${OPEN_MS / 1000} ثانية`);
    }
    publishStatus();
    throw err;
  }
}

// حالة الـ API كلها (للسجل والداشبورد)
export function apiHealth() {
  const now = Date.now();
  const down = [...breakers.entries()]
    .filter(([, b]) => b.openUntil > now)
    .map(([p]) => p);
  return { status: down.length ? 'degraded' : 'ok', down, openCount: down.length };
}

// 🛑 هل الـ endpoint ده في وضع آمن دلوقتي؟
// ai.js بيسأل ده قبل ما يحاول: مزوّد ميت (GPT 500 كل مرة) كان بيكلّف
// 2-3 ثواني في كل رسالة قبل ما يوصل لـ Groq.
export function isOpen(path) {
  const b = breakers.get(path);
  return !!b && b.openUntil > Date.now();
}

// 🕳️ مزوّد رجّع success بمحتوى فاضي = فشل، مش نجاح.
// ما نعدّش الرد الفاضي كأنه رجع سليم؛ وإلا الخدمة المعطلة تعيد نفسها كل طلب.
export function noteEmpty(path) {
  const b = breakerOf(path);
  if (b.openUntil > Date.now()) return;

  b.fails++;
  b.state = 'degraded';
  if (b.fails >= FAIL_LIMIT) {
    b.openUntil = Date.now() + OPEN_MS;
    b.state = 'open';
    b.fails = 0;
    b.notified = true;
    console.log(`🟡 ${path} بيرجّع رد فاضي — نقفله ${OPEN_MS / 1000} ثانية`);
    notifyOwner(`🟡 ${path} بيرجّع رد فاضي — وضع آمن ${OPEN_MS / 1000} ثانية`);
  }
  publishStatus();
}

// أي مزوّد ذكاء اصطناعي شغال فعلاً دلوقتي
export function aiProviderStatus() {
  const status = (path) => {
    const b = breakerOf(path);
    if (b.openUntil > Date.now()) return 'open';
    return b.state;
  };
  return {
    gpt: status('/api/v1/ai/gpt'),
    gemini: status('/api/v1/ai/gemini'),
  };
}

const s = (v) => (v == null ? 'null' : String(v));

export const api = {
  // ━━━━━━━━━ 🤖 الذكاء ━━━━━━━━━
  async gpt(q) {
    const d = await get('/api/v1/ai/gpt', { q }, 60000);
    return d.response?.result?.message ?? d.response?.raw ?? '';
  },

  async gemini(q, { instruction, sessionId } = {}) {
    const d = await get(
      '/api/v1/ai/gemini',
      { action: 'تحدث', q, instruction: s(instruction), sessionId: s(sessionId) },
      90000,
    );
    return { reply: d.response?.reply ?? '', sessionId: d.response?.sessionId ?? null };
  },

  async simsimi(message) {
    const d = await get('/api/v1/ai/ai/simsimi', { action: 'تكلم', message }, 30000);
    return d.response?.reply ?? '';
  },

  // صورة بالذكاء الاصطناعي — imageai أسرع (6s)، gpt-image احتياط أجمل (32s)
  async image(prompt, { pretty = false } = {}) {
    const attempts = pretty
      ? ['/api/v1/ai/gpt-image', '/api/v1/ai/imageai']
      : ['/api/v1/ai/imageai', '/api/v1/ai/gpt-image'];
    let lastErr;
    for (const path of attempts) {
      try {
        const params = path.includes('gpt-image')
          ? { action: 'generate', prompt, model: 'flux-1.1', width: 512, height: 512 }
          : { action: 'توليد', prompt, model: '1' };
        const d = await get(path, params, 120000);
        return d.response?.url ?? null;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('فشل توليد الصورة');
  },

  async video(prompt) {
    const d = await get(
      '/api/v1/ai/video-gen',
      { action: 'txt2video', prompt, duration: 5, fps: 8, motion: 50, ratio: '16:9', aiSound: false },
      120000,
    );
    return d.response?.url ?? null;
  },

  // ━━━━━━━━━ 🎙️ الصوت ━━━━━━━━━
  // 🎙️ TTS بصوت طبيعي — بارامترات محسّنة: stability أقل = حي أكتر + سرعة أقل = دافي
  async tts(text, { voice = '12', dialect = 'fusha', stability = 0.35, speed = 0.92 } = {}) {
    const d = await get(
      '/api/v1/tools/elevenlab',
      {
        action: 'توليد',
        text,
        voice,
        dialect,
        model: 'faseeh-v1-preview',
        stability,
        speed,
        sampleRate: 48000,
      },
      60000,
    );
    return d.response?.url ?? null;
  },

  async animeTts(text, voice = 'غوكو') {
    const d = await get('/api/v1/tools/anime-tts', { action: 'تكلم', text, voice }, 60000);
    return d.response?.url ?? null;
  },

  // ━━━━━━━━━ 📥 التحميل والبحث ━━━━━━━━━
  async ytSearch(q, limit = 5) {
    const d = await get('/api/v1/search/youtube', { q, limit }, 30000);
    // ⚠️ نظّف الشكل هنا مش عند كل مستهلك: النتيجة الناقصة كانت بتعمل
    // `r.title.slice()` = TypeError في song.js و video.js وبتمسح الرسالة كلها
    return (d.results ?? [])
      .filter((r) => r?.url) // من غير رابط مش بنفع يتحمّل
      .map((r) => ({
        index: r.index,
        id: r.id,
        title: String(r.title ?? 'بدون عنوان'),
        url: r.url,
        thumbnail: r.thumbnail,
        duration: r.duration,
        author: r.author,
      }));
  },

  // type: 'audio' | 'video' — الجودة: 128 للصوت، 360/720 للفيديو
  async ytDownload(url, { type = 'audio', quality = '128' } = {}) {
    const d = await get('/api/v1/download/youtube', { url, type, quality }, 120000);
    const out = d.data ?? {};
    return { title: out.title, url: out.download_url ?? null, source: out.source_used };
  },

  async tiktokDownload(url) {
    const d = await get('/api/v1/download/tiktok', { url, quality: 'hd', source: 'musicaldown' }, 60000);
    return d.response?.video ?? d.response?.wm ?? null;
  },

  // ━━━━━━━━━ 🛠️ أدوات ━━━━━━━━━
  async translate(text, to = 'ar', from = 'auto') {
    const d = await get('/api/v1/tools/translate', { action: 'translate', text, to, from, engine: 'google' });
    return { translated: d.response?.translated ?? '', from: d.response?.fromName ?? from };
  },

  async lyrics(query, artist, title) {
    const d = await get('/api/v1/tools/lyrics', { action: 'search', query, artist, title });
    return { title: d.response?.title, artist: d.response?.artist, lyrics: d.response?.lyrics };
  },

  async gifSearch(q, limit = 5) {
    const d = await get('/api/v1/tools/gif-search', { action: 'بحث', q, limit });
    return (d.results ?? []).map((r) => r.url);
  },

  async nsfwCheck(imageUrl) {
    const d = await get('/api/v1/tools/nsfw-checker', { action: 'تحقق', imageUrl }, 15000);
    return { isNSFW: !!d.response?.isNSFW, label: d.response?.label, confidence: d.response?.confidence };
  },

  async checkNum(num) {
    const d = await get('/api/v1/tools/checknum', { num });
    return d.response ?? {};
  },

  // 👁️ وصف صورة بالذكاء الاصطناعي (لرؤية الصور)
  async img2prompt(imageUrl, { language = 'ar' } = {}) {
    const d = await get(
      '/api/v1/tools/img2prompt',
      { action: 'توليد', imageUrl, language, translate: true, instruction: 'detail' },
      60000,
    );
    return { arabic: d.response?.arabic ?? '', english: d.response?.english ?? '' };
  },

  // 🎵 التعرف على الأغنية من صوت
  async shazem(audioUrl) {
    const d = await get(
      '/api/v1/tools/shazem',
      { action: 'تعرف', audioUrl, startTime: 0, clipSeconds: 30 },
      90000,
    );
    return d.response ?? null;
  },

  // 🎤 فصل الغناء عن الموسيقى
  async vocalRemover(url) {
    const d = await get('/api/v1/tools/vocal-remover', { action: 'فصل', url }, 120000);
    return { vocal: d.response?.vocal ?? null, music: d.response?.music ?? null };
  },

  // 📚 مانجا ومانهوا
  async manhwaSearch(q) {
    const d = await get('/api/v1/anime/manhwa', { action: 'بحث', q });
    return d.response?.results ?? [];
  },

  async manhwaInfo(slug) {
    const d = await get('/api/v1/anime/manga-1', { action: 'معلومات', slug, type: 'manhwa' });
    // ⚠️ كان بيرجّع الـ envelope كله (success + response) — وكل الـ methods
    // التانية بترجّع d.response، فـ manga.js كان بيقرا info.cover و
    // info.title من على الغلاف فكانوا undefined وبيطلع كارت فاضي.
    return d.success ? (d.response ?? d) : null;
  },

  // 📖 روايات وات باد
  async wattpadSearch(q, limit = 5) {
    const d = await get('/api/v1/reading/wattpad', { action: 'بحث', q, limit });
    return d.results ?? [];
  },

  async removeBg(imageUrl) {
    const d = await get('/api/v1/tools/removebg', { action: 'ازالة', imageUrl }, 120000);
    return d.response?.url ?? null;
  },

  // 🎵 سبوتيفاي — بحث رسمي بالأغاني والتراكات
  async spotifySearch(q, limit = 10) {
    const d = await get('/api/v1/search/spotify', { q, limit });
    return d.response?.results ?? [];
  },

  // 📱 تيك توك — بحث بالمحتوى والفيديوهات
  async tiktokSearch(query) {
    const d = await get('/api/v1/search/tiktok', { query });
    return d.response?.results ?? d.results ?? [];
  },

  // 📌 بينترست — بحث صور
  async pinimg(q, limit = 6) {
    const d = await get('/api/v1/search/pinimg', { q, limit });
    return (d.results ?? []).filter((r) => r?.image || r?.url);
  },

  // 📦 ميديا فاير — فك وتحميل الروابط
  async mediafire(url) {
    const d = await get('/api/v1/download/mediafire', { url }, 60000);
    return d.response ?? d.data ?? null;
  },

  // 👥 فيسبوك — تحميل احتياطي
  async fbDownload(url) {
    const d = await get('/api/v1/download/facebook', { url }, 60000);
    return d.response ?? d.data ?? null;
  },

  // 💻 تشغيل كود — Remote Code Runner
  async executeCode(code) {
    const d = await post('/api/__v0/_execute', { code }, 30000);
    return d.result ?? d;
  },
};

export default api;
