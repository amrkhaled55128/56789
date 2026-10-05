import { config } from '../config.js';

// ⚡ عميل Groq — qwen/qwen3.8-27b (عقل استرو السريع والدقيق)
// نستخدم fetch مباشرة بدل axios — axios كان بيعمل تحويل غلط للمفتاح

const BASE = 'https://api.groq.com/openai/v1';

// ⏰ مهل متدرّجة — من غيرها، Groq لو علِق (TLS معلّق، شبكة تعبانة) بيسيب الـ
// message handler مفتوح للأبد — ومنه handleUpsert بيقف ورسايل بتتكدّس.
// التدرّج مقصود: التحليل جواب JSON قصير (ثواني)، والشات سطرين — فمفيش
// مبرر نسيب رسالة مستخدم مستني 45 ثانية على تحليل ما هياخدش 3 ثواني.
const CHAT_TIMEOUT_MS = 30000; // الرد الكامل — الطرف الأعلى للسقوط البطيء
const ANALYZE_TIMEOUT_MS = 12000; // mood/intent JSON — لو عدّى 12 ثانية بقى خسارة
const QUICK_TIMEOUT_MS = 20000; // groqQuick — مهمة صغيرة متوسطة

// يكفي وجود المفتاح — الصحة بتتأكد من النداء نفسه
export function isGroqReady() {
  return !!config.groqApiKey;
}

export function groqStatus() {
  return config.groqApiKey ? 'ok' : 'missing';
}

// 🔁 retry موحّد: الـ429 (rate limit) والانقطاع الزمني بيتعادوا مرة واحدة
// بbackoff قصير من هنا — مكان الretry اليدوي اللي كان في ai.js (اتشال)
// عشان ميبقاش retry مزدوج: داخلي + خارجي = رسالة معلقة 3 نداءات ورا بعض.
const RETRY_DELAYS_MS = [700];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (err) =>
  /rate\s*limit|429|timeout|timed\s*out|aborted/i.test(err?.message ?? '');

async function callGroq({ system, messages, maxTokens = 220, temperature = 0.7, topP = 0.8, timeout = CHAT_TIMEOUT_MS }) {
  if (!config.groqApiKey) throw new Error('مفيش مفتاح Groq');

  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    try {
      return await request({ system, messages, maxTokens, temperature, topP, timeout });
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err; // خطأ غير مؤقت — مفيش لزم إعادة
    }
  }
  throw lastErr;
}

async function request({ system, messages, maxTokens, temperature, topP, timeout }) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${err.slice(0, 120)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

export const chatGroq = callGroq;

// 🧠 تحليل سريع للمشاعر والنيّة — JSON بس ومهلة قصيرة عشان ميعطّلش الرد
// ⚠️ المزاج مفرداته مقيّدة بنفس المفاتيح اللي بتتخزّن (detectMood في memory.js)
// وبتتقرا منها (OFFLINE_BY_MOOD في ai.js) — قبل كده النموذج كان بيفضّع
// إحساسات برّه القايمة ("محبط" مثلاً) فالماب الاحتياطي ما كانش يلاقيها.
const ANALYZE_SYSTEM =
  'حلّل النص ده وأجيب بـ JSON بس مفيش كلام: ' +
  '{"mood":"زعلان|مبسوط|تعبان|قلقان|حبيت|عادي","intent":"فضفضة|سؤال|مزح|دعم|غزل|نصيحة|أمر","needs":"help|comfort|fun|info|none"}';

export async function groqAnalyze(text) {
  try {
    const out = await callGroq({
      system: ANALYZE_SYSTEM,
      messages: [{ role: 'user', content: String(text).slice(0, 300) }],
      maxTokens: 60, // سطر JSON صغير — 80 كان برضه كتير
      temperature: 0.2, // تصنيف مش إبداع — أقل عشوائية = أثبت
      timeout: ANALYZE_TIMEOUT_MS,
    });
    const json = out.match(/\{[\s\S]*?\}/)?.[0];
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function groqQuick(system, text, maxTokens = 120) {
  return callGroq({
    system,
    messages: [{ role: 'user', content: String(text).slice(0, 250) }],
    maxTokens,
    temperature: 0.8,
    timeout: QUICK_TIMEOUT_MS,
  });
}
