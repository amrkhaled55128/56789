import api from './api.js';
import { isOpen, noteEmpty } from './api.js';
import { chatGroq, groqAnalyze, isGroqReady } from './groq.js';
import { PERSONA_FULL, FEW_SHOTS_FULL, PERSONA_COMPACT, LAYERS, MODES, RELATIONSHIPS, INSULT_DEFENSE } from './persona.js';
import { findContact } from './identity.js';
import {
  getProfile,
  contextBlock,
  detectMood,
  rememberMood,
  learnFromText,
  currentTone,
} from './memory.js';

// Groq مفيهوش حد طول للتعليمات — الشخصية الكاملة معاه
const FULL_BUDGET = 6000;
// engez API بيرفض الروابط فوق 1200 حرف
const COMPACT_BUDGET = 1100;
const MAX_CHARS = 280; // سقف الرد في الشات — قصير واحترافي

// 🛡️ كشف الإهانة — عشان استرو يدافع عن كرامته
const INSULT_RE = /(?:قذر|وسخ|اهبل|أهبل|غبي|جدعان ب[^ا-ي]|بتاع|خنزير|حمار|زفت|تفو|اهبل|مكواه|عبيط|تبا|تبًا|لعنة|خراب|مناويج|عير|كس ام|زبال|وسخة|حقير|تافه|بضان|اعرف نفسك|انحبس|انحبس)/i;

const MOOD_HINTS = {
  زعلان: 'هو زعلان دلوقتي — افتح معاه دفا واطمن عليه قبل أي كلام تاني.',
  مبسوط: 'هو فرحان — شاركه الفرحة.',
  تعبان: 'هو تعبان — روّقه وكلامك قصير.',
  قلقان: 'هو قلقان — هدّيه وطمنه.',
  حبيت: 'بيتكلم عن مشاعر — خده بجدية وجمال.',
};

// 🎭 اختيار الطبقات حسب الموقف
function pickLayers({ text, profile, analysis, mode }) {
  const layers = [];
  const lower = text.toLowerCase();

  if (mode === 'funny' || /(?:نكت|اضحكني|هزر|ضحك)/.test(lower)) {
    layers.push(LAYERS.funny);
  } else if (mode === 'serious' || analysis?.intent === 'سؤال' || /[؟?]|ازاي|ايه|ليه/.test(lower)) {
    layers.push(LAYERS.pro);
  } else {
    layers.push(LAYERS.mood);
  }

  if (profile.facts?.includes('بنت') || mode === 'roman') layers.push(LAYERS.girl);
  if (/(?:مصر|اهلي|زمالك|كورة|قهو|طعمية|شيشة|فيصل|الهرم|كشري|فول|هكز)/.test(lower)) {
    layers.push(LAYERS.egypt);
  }
  if (/(?:هكز|شيشة|شيشا|دخان|تبغ|معسل|hookah)/i.test(lower)) {
    layers.push(LAYERS.hookah);
  }
  return layers;
}

function buildInstruction(profile, pushName, contact, { voice, extra, mood, mode, analysis, text, full, budgetOverride = null }) {
  const budget = budgetOverride ?? (full ? FULL_BUDGET : COMPACT_BUDGET);
  // الشخصية الكاملة + الأمثلة الحقيقية (بس مع Groq)
  const base = full ? `${PERSONA_FULL}\n\n${FEW_SHOTS_FULL}` : PERSONA_COMPACT;
  const parts = [base];

  // 💚 العلاقة الخاصة — أعلى أولوية بعد الشخصية نفسها
  // (شروق حبيبة أدهم: شعر ودلع ومواساة / أدهم المطور: صاحب مقرب)
  if (full) {
    parts.push(RELATIONSHIPS[contact?.role] ?? RELATIONSHIPS.default);

    // 🛡️ الدفاع عن الكرامة — اللي يهين بيتقابل بقهر (الأصدقاء محميين)
    if (INSULT_RE.test(text) && !contact) {
      parts.push(INSULT_DEFENSE);
    }
  } else {
    // المسار المضغوط: نسخة قصيرة من العلاقة
    if (contact?.role === 'حبيبة') {
      parts.push('💗 دي صاحبة خاصة جداً (حبيبة صاحبك أدهم اسمها شروق) — كل رد بحنان ودلع وسطر شعر خفيف، ولو زعلانة واسيها الأول قبل أي حاجة.');
    } else if (contact?.role === 'صاحب') {
      parts.push('⚒️ ده أدهم — صاحبك المقرب والمطور اللي برمجك. كلمه كصاحبك مع احترام خاص.');
    } else if (contact?.style) {
      parts.push(contact.style);
    }
  }

  // 😐 نظام الحنية — لو زهق من كتر
  if (currentTone(profile) === 'chill') {
    parts.push('مودك هادي دلوقتي: رد عادي خفيف كصاحب عادي — من غير "يا قلبي" ولا كلام حنية زيادة.');
  } else if (mood && MOOD_HINTS[mood]) {
    parts.push(MOOD_HINTS[mood]);
  }

  // 🎭 أنماط الشخصية المفعّلة
  if (MODES[mode]) parts.push(MODES[mode]);

  for (const layer of pickLayers({ text, profile, analysis, mode })) parts.push(layer);

  // 🧠 الذاكرة (الاسم، المعلومات، الإحساس السابق، آخر 8 رسايل)
  const used = parts.join('\n').length;
  const { block } = contextBlock(profile, pushName, Math.max(100, budget - used - 30));
  if (block) parts.push('معلومات عنه:\n' + block);

  if (voice) parts.push('ردك هيتبعت صوت — جملة واحدة بس.');
  if (extra) parts.push(extra);

  return parts.join('\n').slice(0, budget);
}

// 🚫 نصوص المزوّد اللي بترفض — بتتخطّى ومتخزّنش
const ERROR_PATTERNS = [
  /لم أتمكن|تعذّر|تعذر|فشل|غير متاح|too many|rate limit|حاول مرة أخرى|إعادة المحاولة/i,
  /لا أستطيع|لا يمكنني|مجرد نموذج|نموذجًا لغويًا|نموذج لغوي|بصفتي نموذج|لستُ مصمم|لست مصمم|لا أفهم ذلك/i,
  /I cannot|I can't|I'm just|as a language model|I am unable/i,
];

// ⚠️ كان فيه `|| t.length < 12` — وده كان يرفض أي رد عربي قصير صحيح
// ("تمام" و"أيوه" و"يا معلم") كأنه رد مزود فاشل. الرد القصير السليم مشروع
// في المحادثة المصرية، فلازم نرفض الفراغ بس لا القصير.
const MIN_USEFUL = 2;

export function isErrorText(text) {
  const t = String(text ?? '').trim();
  if (t.length < MIN_USEFUL) return true; // فراغ أو حرف واحد = مفيش رد
  return ERROR_PATTERNS.some((re) => re.test(t));
}

// 🧠 تحليل قبل الرد
async function analyzeMessage(text) {
  if (isGroqReady()) {
    const a = await groqAnalyze(text);
    if (a) return a;
  }
  try {
    const raw = await api.gpt(
      `حلّل الرسالة دي وأجيب بـ JSON بس: {"mood":"إحساسه","intent":"فضفضة|سؤال|مزح|دعم|غزل|نصيحة|أمر","topic":"باختصار"}\nالرسالة: ${text.slice(0, 250)}`,
    );
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

// ✨ تنظيف الرد — بلا ما يمسح المعنى
export function polishReply(reply, { allowLong = false } = {}) {
  let t = String(reply).trim();

  // روابط وماركداون
  t = t.replace(/\[([^\]]{1,40})\]\([^)]*\)/g, '$1');
  t = t.replace(/https?:\/\/[^\s)\]]+/g, '');
  t = t.replace(/^#{1,4}\s*/gm, '');
  t = t.replace(/\*\*(.+?)\*\*/g, '*$1*');
  t = t.replace(/^\s*[-*]\s+/gm, '• ');
  t = t.replace(/\s{2,}/g, ' ');

  // "أنا مجرد بوت" → "أنا استرو" — بدون ما ناكل باقي الجملة
  t = t.replace(/\bأنا\s+(?:مجرد\s+|بس\s+|في\s+الأساس\s+)?(?:بوت|روبوت|ذكاء\s+اصطناعي|برنامج|كود|نظام)\b[،,]?/g, 'أنا استرو');

  t = t.replace(/\n{3,}/g, '\n\n').trim();

  if (!allowLong && t.length > MAX_CHARS && !/[.…]$/.test(t)) {
    t = t.slice(0, MAX_CHARS).replace(/\s+\S*$/, '') + '…';
  }
  return t;
}

// 🔁 تشابه بين نصّين (نسبة الكلمات المشتركة)
function similarity(a, b) {
  const words = (s) => new Set(String(s).split(/\s+/).filter((w) => w.length > 2));
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

// 🚫 لو الرد شبه الردود السابقة — يجيب بديل بنبرة مختلفة
function isRepetitive(newReply, history) {
  if (!newReply || newReply.length < 10) return false;
  for (const old of history ?? []) {
    if (old?.text && similarity(newReply, old.text) > 0.6) return true;
  }
  return false;
}

export async function chatWithAI({
  text, key, sender, senderAlt, pushName, voice = false,
  extra = '', allowLong = false, mode = 'normal', variants = 0,
}) {
  const idKey = key ?? sender;
  const profile = getProfile(idKey);
  const contact = findContact(sender, senderAlt, idKey);

  // 🧠 التعلم + الإحساس (مرة واحدة)
  learnFromText(idKey, text);
  const mood = detectMood(text);
  if (mood) rememberMood(idKey, mood);

  // 🎯 تصنيف محلي أولاً (فوري، بدون شبكة). نداء الـAI للتحليل بيحصل بس
  // للنص الغامض أو الطويل — قبل كده كان نداء Groq إضافي في كل رسالة.
  const local = analyzeLocally(text);
  const analysis = needsAiAnalysis(text, local) ? await analyzeMessage(text) : null;
  // النتيجة المدمجة: المحلي أولاً (أسرع وأدق في الإحساس البسيط)
  const merged = {
    mood: local.mood ?? mood ?? analysis?.mood ?? null,
    intent: local.intent ?? analysis?.intent ?? null,
    topic: local.topic || analysis?.topic || '',
    confidence: Math.max(local.confidence, analysis?.confidence ?? 0),
  };

  const analysisHint = analysis
    ? `إحساسه "${analysis.mood ?? mood ?? 'عادي'}" — عايز "${analysis.intent ?? 'كلام'}" — "${analysis.topic ?? 'عام'}".`
    : '';

  // 🧠 تاريخ المحادثة الحقيقي — النموذج يشوف الكلام كأنه محادثة، مش سطور
  const history = (profile.lastMessages ?? []).slice(-6);
  const convo = history
    .filter((h) => h.text && !h.text.startsWith(text))
    .map((h) => ({ role: h.role === 'bot' ? 'assistant' : 'user', content: String(h.text).slice(0, 300) }));

  const instruction = buildInstruction(profile, pushName, contact, {
    voice, mood, mode, analysis, text,
    extra: [analysisHint, extra].filter(Boolean).join(' '),
    full: isGroqReady(),
  });

  const userMsg = { role: 'user', content: text.slice(0, 500) };
  // البديل بتاع منع التكرار
  const retryHint = variants > 0
    ? `\n⚠️ الرد اللي قبله كان مكرر — جاوب بنبرة مختلفة تماماً وابدأ بكلمة مختلفة خالص.`
    : '';

  // 🧠 تعليمات لكل محرك بميزانيته (الـ engez و Groq لهم حدود مختلفة)
  const gptInstruction = buildInstruction(profile, pushName, contact, {
    voice, mood, mode, analysis, text,
    extra: [analysisHint, extra].filter(Boolean).join(' '),
    full: false,
    budgetOverride: 1400,
  });
  const fullInstruction = buildInstruction(profile, pushName, contact, {
    voice, mood, mode, analysis, text,
    extra: [analysisHint, extra].filter(Boolean).join(' '),
    full: true,
  });
  const compactInstruction = buildInstruction(profile, pushName, contact, {
    voice, mood, mode, analysis, text,
    extra: [analysisHint, extra].filter(Boolean).join(' '),
    full: false,
  });
  const isInsult = INSULT_RE.test(text) && !contact;
  const roastInstruction = `${PERSONA_COMPACT}\n\n${INSULT_DEFENSE}\n\nالمهم دلوقتي: الرسالة دي إهانة ليك — رد عليه بقهر مصري حاد وسخرية في سطر واحد من غير سباب صريح.`;

  // 1) GPT-5.6 Luna (engez) — أساسي إن كان endpoint متاحًا.
  // إذا عاد 500 عدة مرات، يفتحه breaker ويُتخطّى مؤقتًا.
  //
  // ⚠️ الراوت دلوقتي بيرجّع 500 (المزوّد رجّع 404 جوه) = خدمة ميتة.
  // كل رسالة كانت بتدفع 2-3 ثواني قبل ما توصل لـ Groq. دلوقتي بنسأل
  // دائرة الأمان الأول ونتخطاه لو مقفول.
  if (!isOpen('/api/v1/ai/gpt')) {
    try {
      const q = isInsult
        ? `${roastInstruction.slice(0, 900)}\n\nرسالته: ${text.slice(0, 250)}`
        : `${gptInstruction}${retryHint}\n\nرسالته: ${text.slice(0, 400)}`;
      const reply = await api.gpt(q);
      if (reply?.trim()) {
        const clean = polishReply(reply, { allowLong });
        if (!isErrorText(clean)) return { reply: clean, engine: 'gpt5.6' };
      }
    } catch (err) {
      console.error('⚠️ GPT فشل:', err.message?.slice(0, 80));
    }
  }

  // 2) ⚡ Groq qwen3.8-27b — بالشخصية الكاملة (احتياط قوي)
  if (isGroqReady()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await chatGroq({
          system: isInsult ? roastInstruction : (retryHint ? fullInstruction + retryHint : fullInstruction),
          messages: [...convo, userMsg],
          maxTokens: 260,
          temperature: variants > 0 ? 0.9 : 0.7,
          topP: 0.8,
        });
        if (reply) {
          const clean = polishReply(reply, { allowLong });
          if (!variants || !isRepetitive(clean, profile.lastMessages)) {
            return { reply: clean, engine: 'groq' };
          }
          const alt = await chatGroq({
            system: fullInstruction + `\n⚠️ ابدأ الرد بكلمة مختلفة تماماً عن أي رد سابق، وغيّر أسلوبك كلياً.`,
            messages: [...convo, userMsg],
            maxTokens: 260,
            temperature: 1.0,
            topP: 0.9,
          });
          if (alt) return { reply: polishReply(alt, { allowLong }), engine: 'groq' };
        }
        break; // نجح بس مفيش رد صالح — مش هعيد
      } catch (err) {
        const rateLimit = /rate|429|limit/i.test(err.message ?? '');
        if (rateLimit && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200)); // استنى شوية وحاول تاني
          continue;
        }
        console.error('⚠️ Groq فشل:', err.message?.slice(0, 80));
        break;
      }
    }
  }

  // 3) Gemini احتياط — بشخصية مضغوطة (الـ API بيرفض >1200)
  //
  // ⚠️ الـ endpoint دايماً بيرجّع success مع reply فاضي (خدمة شبه ميتة).
  // الرد الفاضي كان بيمرّ كنجاح فالعدّاد مش بيتحرك، يعني كل رسالة بتدفع
  // 1.5 ثانية مقابل محاولة مالهاش نتيجة. بنتخطاها لو في وضع آمن.
  if (!isOpen('/api/v1/ai/gemini')) {
    try {
      const compact = isInsult ? roastInstruction : compactInstruction;
      const { reply } = await api.gemini(text.slice(0, 500), { instruction: compact });
      if (reply?.trim()) {
        const clean = polishReply(reply, { allowLong });
        if (!isErrorText(clean)) return { reply: clean, engine: 'gemini' };
      }
      noteEmpty('/api/v1/ai/gemini');
    } catch (err) {
      console.error('⚠️ Gemini فشل:', err.message?.slice(0, 80));
    }
  }

  // 4) 🛟 آخر خط: رد من الشخصية نفسها بدون أي API
  // قبل كده لو كل المزوّدات وقعت البوت كان بيقول "كل المصادر فشلت" —
  // رد ميت وغامض. دلوقتي بيرد بكلام حقيقي (حسب المزاج) عشان المستخدم
  // ميحسش إن البوت كسر خالص.
  try {
    const sim = await api.simsimi(text.slice(0, 200)).catch(() => null);
    if (sim?.trim()) return { reply: polishReply(sim, { allowLong }), engine: 'simsimi' };
  } catch {}

  const canned = offlineReply(text, { isInsult, profile });
  if (canned) return { reply: canned, engine: 'offline' };

  throw new Error('كل المصادر فشلت');
}

// 🛟 ردود جاهزة باللهجة المصرية لما كل الشبكات تفصل
// ⚠️ المفاتيح لازم تكون نفس الأسماء اللي `detectMood` بتخزّنها في الذاكرة
// (زعلان/تعبان/قلقان/مبسوط/حبيت) — قبل كده كانت بالإنجليزي فمعظم
// ردود المزاج ما كانتش بتظهر خالص.
const OFFLINE_BY_MOOD = {
  زعلان: 'والله يا صاحبي الكلام ده وجعني معاك 🤍 مفيش كلام أطمّنك بيه غير إنك قلتّه، وأنا فاكر كله.',
  تعبان: 'إنت تعبان يا واد، قوم اتنفس وشرب مية وأرجع بعدين — الدنيا هتفضل مكانها.',
  قلقان: 'خد نفس يا باشا، القلق ده بيكبر في دماغك لوحده. قولّي إيه اللي مقلقك بالظبط وأنا معاك.',
  مبسوط: 'يا سلام عليك يا حبيبي 😄 كلامك ده بيحلّي اليوم، قولّي تاني في أي وقت 💚',
  حبيت: 'يا حبيبي 🥰 الكلام الحلو ده بيفرحني، خلّيني أعيده في دماغي على طول. بحبك 🫶',
};

function offlineReply(text, { isInsult, profile }) {
  if (isInsult) {
    return '😏 إنت بتحب الكلام القوي؟ جرّب تاني — أنا مش بلاش منك، بس خلّي في حدود 😂';
  }
  // lastMood مخزّن كـ { mood, at } مش نص — نقرأMood من الكائن
  const mood = typeof profile?.lastMood === 'string' ? profile.lastMood : profile?.lastMood?.mood;
  if (mood && OFFLINE_BY_MOOD[mood]) return OFFLINE_BY_MOOD[mood];
  if (/(شكرا|شكرًا|thank|merci)/i.test(text)) return 'العفو يا غالي 😄 أي حاجة تانية أنا موجود.';
  if (/(سلام|اهلا|اهلاً|ازيك|إزيك|مساء|صباح|هاي|hi|hello)/i.test(text)) {
    return 'أهلاً بيك يا صاحبي 😄 قاعد فين، عاملين إيه النهارده؟';
  }
  if (/\?\s*$/.test(text.trim())) {
    return '🤔 الشبكة بتأخر شوية — عاّد السؤال تاني وأنا جايك بالتفاصيل.';
  }
  return '🤍 أنا سامعك يا باشا، بس الشبكة بتقطع شوية دلوقتي. جرّب تاني بعد شوية وأنا هنا.';
}

export function cleanForVoice(text) {
  return String(text)
    .replace(/[*_~`#]+/g, '')
    .replace(/[^\p{L}\p{N}\s.,!?،؟:؛"'\-()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}
