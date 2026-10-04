import { config } from '../config.js';

// ⚡ عميل Groq — qwen/qwen3.8-27b (عقل نوفا السريع والدقيق)
// نستخدم fetch مباشرة بدل axios — axios كان بيعمل تحويل غلط للمفتاح

const BASE = 'https://api.groq.com/openai/v1';

// ⏰ مهلة قصوى. من غيرها، Groq لو علِق (TLS معلّق، شبكة تعبانة) بيسيب الـ
// message handler مفتوح للأبد — ومنه handleUpsert بيقف ورسايل بتتكدّس
// في الذاكرة. axios كان عنده timeout، لكن fetch لا.
const TIMEOUT_MS = 45000;

// يكفي وجود المفتاح — الصحة بتتأكد من النداء نفسه
export function isGroqReady() {
  return !!config.groqApiKey;
}

export function groqStatus() {
  return config.groqApiKey ? 'ok' : 'missing';
}

async function callGroq({ system, messages, maxTokens = 220, temperature = 0.7, topP = 0.8, timeout = TIMEOUT_MS }) {
  if (!config.groqApiKey) throw new Error('مفيش مفتاح Groq');

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

// 🧠 تحليل سريع للمشاعر والنيّة
export async function groqAnalyze(text) {
  try {
    const out = await callGroq({
      system: `حلّل النص ده وأجيب بـ JSON بس مفيش كلام: {"mood":"حالة واحدة","intent":"فضفضة|سؤال|مزح|دعم|غزل|نصيحة|أمر","needs":"help|comfort|fun|info|none"}`,
      messages: [{ role: 'user', content: String(text).slice(0, 300) }],
      maxTokens: 80,
      temperature: 0.3,
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
  });
}
