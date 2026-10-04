// 🎯 تصنيف النية والإحساس محلياً — بدون نداء AI
//
// ⚠️ كل رسالة كانت بتعمل نداءين لـGroq: واحد للتحليل (mood/intent) وواحد للرد.
// يعني ضعف الزمن المستغرق في كل رسالة، وكاش خلفي في الجروبات المزدحمة.
// التصنيف المحلي ده بيغطي أغلب الرسائل فورًا؛ الـAI بيشتغل بس للنص الغامض.

// 📊 الإشارات دي مرتبة من الأقوى للأضعف
const SIGNALS = {
  غزل: {
    weight: 3,
    patterns: [
      /بحبك|بحبّك|حبيبي|حبيبتي|حياتي|قلبي|عاشق|غROUP/,
      /حبيبك|حبك|الحب|رومانسي|فزاعة|شفق عليك/i,
      /وريني|ورّينا|قولة|شعر لي|اكتبلي شعر/i,
    ],
  },
  دعم: {
    weight: 3,
    patterns: [
      /(?:انا)s*(?:مش|لا)s*(?:كويس|مرتاح|فاهم|مردود)/,
      /مش عارف|تايه|محتار|مش قادر|حاسس إن/,
      /وحدي|مش لاقي حد|حاسس بوحده/,
    ],
  },
  سؤال: {
    weight: 2,
    patterns: [
      /\?|؟$/,
      /(?:ايه|إيه|ازاي|إزاي|ليه|لماذا|امتى|إمتى|فين|اين|مين|كام)\b/,
      /^(?:قوّل|قولي|وضح|اشرح|هات|وريني)\b/,
      /(?:is|are|what|how|why|when|where|who)\b/i,
    ],
  },
  هزل: {
    weight: 2,
    patterns: [
      /نكت|اضحكني|ضحكني|هزر|هز|مضحك|ضحك|عجب|نكيه/,
      /(?:joke|funny|make me laugh|haha)/i,
    ],
  },
  نصيحة: {
    weight: 2,
    patterns: [
      /نصيح|انصحني|اعمل ايه|افضل|أحسن|ينفع|أعمل ايه|رايك/,
      /(?:advice|should i|tips)/i,
    ],
  },
  أمر: {
    weight: 2,
    patterns: [
      /^(?:محو|ابعت|ابعت|نفذ|شغل|اقفل|حضّ|حضر)/,
      /(?:اكتب|اكتبلي|عملي|سجل|حفظ)\s/,
      /\.(?:ai|song|yt|help|menu)\b/,
    ],
  },
};

// 💓 الإحساس — بيشتغل مع handle النفي (مش زعلان ≠ زعلان)
const MOOD_HINTS = {
  حبيت: /بحب|حبيت|عاشق|غرمت|في قلبي|حبيبتي|حبيبي|نور عيني/,
  زعلان: /زعلان|مجروح|حزين|مكسور|ضايق|بكيت|زهقان|تعبت من الدنيا| unfair|من unfair/,
  قلقان: /قلقان|خايف|متوتر|قلقي|همّي|قلق|مش مرتاح/,
  تعبان: /تعبان|مخنوق|مضغوط|منهار|مرهق|مش قادر/,
  مبسوط: /مبسوط|سعيد|فرحان|أجمل ما في|رابح|الحمد لله|فتحت|مبروك|يا سلام/,
};

// 🚫 كلمات تدل إن المزاج سلبي فعلاً (لازم نتجاهل لو فيها)
const NEGATION = /مش|مست|ما\s*ب?ش|بخصوص|مش\s*خالص|not\b|n't\b/;

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    // توحيد الألف/الهاء/التاء المربوطة زي Arabic.js
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * يحلّل الرسالة محلياً.
 * @returns {{mood: string|null, intent: string|null, topic: string, confidence: number, local: true}}
 */
export function analyzeLocally(text) {
  const raw = String(text ?? '');
  const t = normalize(raw);
  if (!t) return { mood: null, intent: null, topic: '', confidence: 0, local: true };

  // 💓 الإحساس
  let mood = null;
  let moodHits = 0;
  for (const [name, re] of Object.entries(MOOD_HINTS)) {
    const pattern = new RegExp(re.source, re.flags.replace('g', ''));
    if (pattern.test(t)) {
      // "أنا مش زعلان" = مش زعلان، مش زعلان
      const negMatch = new RegExp(`${NEGATION.source}[^]{0,12}?${re.source}`, 'u').test(t);
      if (!negMatch) {
        mood = name;
        moodHits++;
      }
    }
  }
  // المزاج يحتاج إشارتين متفرقتين عشان ما نلغبطش كلام عادي
  if (mood && moodHits === 0) mood = null;

  // 🎯 النية — أعلى وزن يفوز
  let intent = null;
  let best = 0;
  for (const [name, { weight, patterns }] of Object.entries(SIGNALS)) {
    const hits = patterns.filter((p) => p.test(t)).length;
    const score = weight * hits;
    if (score > best) {
      best = score;
      intent = name;
    }
  }

  // الموضوع: أهم الكلمات دلالة
  const words = t.split(' ')
    .filter((w) => w.length > 3 && !/^(?:الي|ده|دي|ان|انا|احنا|ليكو|بتاع|يعني|اهو|فوق|تحت)/.test(w));
  const topic = words.slice(0, 4).join(' ') || t.slice(0, 40);

  // ⚖️ الثقة: لو لقينا إحساس أو نية واضحة، نثق محلياً
  let confidence = 0;
  if (mood) confidence += 0.4;
  if (intent) confidence += 0.35;
  if (best >= 4) confidence += 0.15; // إشارة قوية
  if (words.length >= 3) confidence += 0.1; // فيه سياق كافي

  return { mood, intent, topic, confidence: Math.min(1, confidence), local: true };
}

/**
 * هل الرسالة محتاجة تحليل AI؟
 * بنرجع للقواعد دي: نصوص قصيرة جداً، أو غامضة، أو عالية الطول (السياق بيهم).
 */
export function needsAiAnalysis(text, local) {
  const raw = String(text ?? '');
  const t = raw.trim();
  if (!t) return false;
  if (t.length < 4) return false; // "تمام" — مفيش حاجة نحلّلها
  if (t.length > 600) return true; // نص طويل فعلاً بيستاهل تحليل عميق
  if (local.confidence >= 0.75) return false; // التحليل واضح
  if (local.mood || local.intent) return false; // لقينا إحساس أو نية
  // نص متوسط بلا إشارات واضحة
  return t.length > 40 || /[؟?]/.test(t);
}

export { MOOD_HINTS, SIGNALS };
