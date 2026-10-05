// 🎯 تصنيف النية والإحساس محلياً — بدون نداء AI
//
// ⚠️ كل رسالة كانت بتعمل نداءين لـGroq: واحد للتحليل (mood/intent) وواحد للرد.
// يعني ضعف الزمن المستغرق في كل رسالة، وكاش خلفي في الجروبات المزدحمة.
// التصنيف المحلي ده بيغطي أغلب الرسائل فورًا؛ الـAI بيشتغل بس للنص الغامض.
//
// 🛠️ إصلاحات جولة الذكاء:
// - النفي بقى مجموعة regex صحيحة (قبل كده NEGATION.source كان بيتكتب خام
//   فالـalternation بتتفتح وكل كلمة إحساس بتبقى "نفي" مستقل → الكشف مات).
// - النفي لازم يكون ملاصق لكلمة الإحساس (مش أي مكان في الجملة) عشان
//   "مش زعلان انا مبسوط" ما تقفلش المبسوط كمان.
// - تنضيف النصوص المتلفة ("غGROUP"، "s*" بدل \s*، "unfair").
// - إشارات دعم أكتر شمول عشان "انا مش كويس" ما يفوتش من غير تحليل.

// 📊 الإشارات دي مرتبة من الأقوى للأضعف
const SIGNALS = {
  غزل: {
    weight: 3,
    patterns: [
      /بحبك|بحبّك|حبيبي|حبيبتي|حياتي|قلبي|عاشق|غرمت/,
      /حبيبك|حبك|الحب|رومانسي|فزاعة|شفق عليك|شوقان/,
      /اكتبلي شعر|قولي شعر|شعر عن|وريني حب/,
    ],
  },
  دعم: {
    weight: 3,
    patterns: [
      /(?:^|\s)انا\s+(?:مش|لا)\s+(?:كويس|مرتاح|فاهم|قادر|بخير|مزبوط)/,
      /مش\s*(?:عارف|قادر|مرتاح|بخير|طيب|مزبوط)|تايه|محتار|حاسس ان(?:ي|ه)|حاسس ب/,
      /وحيد|مش لاقي حد|محتاج حد|زهقت من|تعبت من الدنيا|مكسور/,
      /محتاج مساعدة|ساعدني|احكيلي|سمعني|فضفضة|خسرت/,
    ],
  },
  سؤال: {
    weight: 2,
    patterns: [
      /[?؟]/,
      /(?:ايه|إيه|ازاي|إزاي|ليه|لماذا|امتى|إمتى|فين|اين|مين|كام)\b/,
      /(?:^|\s)(?:قول|قولي|وضح|اشرح|هات|وريني)(?:\s|$)/,
      /(?:is|are|what|how|why|when|where|who)\b/i,
    ],
  },
  هزل: {
    weight: 2,
    patterns: [
      /نكت|اضحكني|ضحكني|هزر|هز|مضحك|ضحك|عجب|هيصة/,
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
      /^(?:محو|ابعت|نفذ|شغل|اقفل|حضّ|حضر)/,
      /(?:اكتب|اكتبلي|عملي|سجل|حفظ)\s/,
      /\.(?:ai|song|yt|help|menu)\b/,
    ],
  },
};

// 💓 الإحساس — كل نمط بينما، والنفي بيتفحص عليه كوحدة مستقلة
// ⚠️ ممنوع نحط "مش كذا" جوه النمط نفسه — فاحص النفي بيقرا "مش" الملاصقة
// فالكلمة اللي بعدها بتتلغي. الصيغ المنفية (مش قادر/مش مرتاح) مكانها إشارات الدعم.
const MOOD_HINTS = {
  حبيت: /بحب|حبيت|عاشق|غرمت|في قلبي|حبيبتي|حبيبي|نور عيني/,
  زعلان: /زعلان|مجروح|حزين|مكسور|ضايق|بكيت|زهقان|زهقت|خسرت|وحدتني/,
  قلقان: /قلقان|خايف|متوتر|قلقي|همّي|قلق/,
  تعبان: /تعبان|مخنوق|مضغوط|منهار|مرهق|تعبت/,
  مبسوط: /مبسوط|سعيد|فرحان|أجمل ما في|رابح|الحمد لله|فتحت|مبروك|يا سلام/,
};

// 🚫 كلمات النفي — بتتفحص ملاصقة لكلمة الإحساس مباشرة (شوف isNegated)
const NEGATION = /(?:مش|مست|ليس|لست|ما\s*ب?ش|ولا)/;

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

// النفي لازم يكون واقف قبل كلمة الإحساس على طول (بمسافات بينهم بس).
// ⚠️ بنلفّ المصدرين في (?:...) — من غير التغليف الـalternation بتاعة
// النمطين بتتدمج وكل كلمة إحساس بتبقى بديل مستقل فالنفي بيرجع true غلط.
function isNegated(t, moodRe) {
  return new RegExp(`(?:${NEGATION.source})\\s*(?:${moodRe.source})`, 'u').test(t);
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
  for (const [name, re] of Object.entries(MOOD_HINTS)) {
    const pattern = new RegExp(re.source, re.flags.replace('g', ''));
    if (pattern.test(t) && !isNegated(t, pattern)) {
      mood = name;
      break; // أول إحساس واضح يكسب — الترتيب من الأعمق للأخف
    }
  }

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
  // نص متوسط بلا إشارات واضحة — والسؤال مهما كان قصير بيتحلل
  return t.length > 24 || /[?؟]/.test(t);
}

export { MOOD_HINTS, SIGNALS };
