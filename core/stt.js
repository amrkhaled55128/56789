import { config } from '../config.js';

// 🎙️ STT — تحويل الرسائل الصوتية لنص عبر Groq Whisper
// whisper-large-v3-turbo: سريع ودقيق بالعربي (متأكد منه بالاختبار الفعلي)

const WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// ⏰ whisper-large-v3 على رسالة صوتية طويلة ممكن ياخد 30+ ثانية.
// من غير مهلة، لو الوصل علق البوت يفضل مستني الصوت للأبد والشات
// يقفل (الرسايل بعده بتتكدّس في الذاكرة).
const TIMEOUT_MS = 90000;

export async function transcribeAudio(buffer, { language = 'ar', model = null, fileName = 'voice.ogg', mimeType = 'audio/ogg; codecs=opus', timeout = TIMEOUT_MS } = {}) {
  if (!config.groqApiKey) throw new Error('مفيش مفتاح Groq للـ STT');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);
  form.append('model', model ?? config.sttModel ?? 'whisper-large-v3');
  if (language) form.append('language', language);

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqApiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Whisper ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  return (data?.text ?? '').trim();
}
