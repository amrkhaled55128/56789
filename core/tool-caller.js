import api from './api.js';
import { sendText, sendImage, sendVideo, sendVoice, sendQuickReplies } from './send.js';
import { db } from './db.js';
import { speak } from './tts.js';

// 🤖 AI Tool Calling & Intent Orchestrator لـ Astro / Nova
// يكتشف نوايا وأفعال المستخدم الطبيعية في المحادثة وينفذ الأدوات التفاعلية فوراً

/**
 * توحيد ومعايرة النص العربي والإنجليزي للتعرف الدقيق
 */
export function normalizeText(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '') // حذف التشكيل
    .replace(/[،,.:;!؟?]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * تنظيف نداءات البوت وكلمات المجاملة الزائدة
 */
export function cleanUserInput(str) {
  let s = String(str || '').trim();
  // إزالة مناداة البوت
  s = s.replace(/^(?:يا\s*(?:استرو|نوفا|بوت|عم\s*استرو|عم\s*نوفا)|astro|nova)\s*[,:،-]?\s*/i, '');
  // إزالة كلمات الرجاء والمجاملات
  s = s.replace(/^(?:لو\s*سمحت|من\s*فضلك|بالله\s*عليك|بليز|ارجوك|أرجوك|عايزك|عاوزك|ممكن|تقدر|please|can\s*you|could\s*you)\s*[,:،-]?\s*/i, '');
  s = s.replace(/[,:،-]?\s*(?:لو\s*سمحت|من\s*فضلك|بالله\s*عليك|بليز|ارجوك|أرجوك|please)$/i, '');
  return s.trim();
}

/**
 * فحص وتصنيف نية المستخدم (Intent Detection)
 */
export function detectIntent(rawText) {
  const norm = normalizeText(rawText);
  if (!norm) return null;

  // 1. 🎙️ Anime TTS (صوت شخصيات الأنمي والمشاهير)
  // "قول بصوت غوكو...", "اتكلم بصوت ميسي...", "انطق بصوت ايمينيم..."
  const animeTtsMatch = norm.match(/^(?:قول|اتكلم|انطق|احكي|غرد|say)\s+(?:لي\s+|ليا\s+)?(?:بصوت|صوت|in(?:\s+the)?\s+voice\s+of|as)\s+([ء-يa-zA-Z0-9]+)(?:[\s:،,-]+(.+))?$/i);
  if (animeTtsMatch) {
    let character = animeTtsMatch[1].trim();
    if (/غوكو|goku|كوكو/.test(character)) character = 'غوكو';
    else if (/ميسي|messi/.test(character)) character = 'ميسي';
    else if (/ايمينيم|eminem|امينيم/.test(character)) character = 'ايمينيم';

    // استخراج النص الأصلي للقول من rawText
    let promptText = '';
    const originalMatch = rawText.match(/(?:بصوت|صوت|in(?:\s+the)?\s+voice\s+of|as)\s+[^\s:،,-]+[\s:،,-]+(.+)$/i);
    if (originalMatch) {
      promptText = originalMatch[1].trim();
    } else if (animeTtsMatch[2]) {
      promptText = animeTtsMatch[2].trim();
    }

    return {
      type: 'anime_tts',
      character,
      text: promptText,
    };
  }

  // 2. 📝 كلمات الأغاني (Song Lyrics)
  // "كلمات اغنية...", "كلمات تراك...", "lyrics of..."
  const lyricsPattern = /^(?:عايز|عاوز|بدي|محتاج|هات|جيب|ابحث\s+عن|ابحثلي\s+عن|وريني)?\s*كلمات\s+(?:اغنيه|تراك|انشوده|لحن|song)?\s*(?:لـ|ل|عن)?\s*(.+)$/i;
  const lyricsEnPattern = /^(?:lyrics\s+(?:of|for)|song\s+lyrics(?:\s+for)?)\s*(.+)$/i;
  if (lyricsPattern.test(norm) || lyricsEnPattern.test(norm)) {
    let clean = norm
      .replace(/^(?:عايز|عاوز|بدي|محتاج|هات|جيب|ابحث\s+عن|ابحثلي\s+عن|وريني)\s*/, '')
      .replace(/^كلمات\s*(?:اغنيه|تراك|انشوده|لحن|song)?\s*(?:لـ|ل|عن)?\s*/, '')
      .replace(/^(?:lyrics\s+(?:of|for)|song\s+lyrics(?:\s+for)?)\s*/, '')
      .trim();

    // استخراج من النص الأصلي للحفاظ على الحروف الإنجليزية بدقة
    let originalQuery = cleanUserInput(rawText)
      .replace(/^(?:عايز|عاوز|بدي|محتاج|هات|جيب|ابحث\s+عن|ابحثلي\s+عن|وريني)\s*/i, '')
      .replace(/^كلمات\s*(?:اغنية|أغنية|اغنيه|تراك|انشودة|أنشودة|song)?\s*(?:لـ|ل|عن)?\s*/i, '')
      .replace(/^(?:lyrics\s+(?:of|for)|song\s+lyrics(?:\s+for)?)\s*/i, '')
      .trim();

    return {
      type: 'lyrics',
      query: originalQuery || clean,
    };
  }

  // 3. 🔍 أدوات البحث (تيك توك، بينترست، يوتيوب)
  // a) تيك توك: "ابحثلي في تيك توك عن...", "ابحث في تيك توك عن...", "دور في تيك توك عن..."
  const ttSearchPattern = /(?:ابحثلي|ابحث\s+لي|ابحث|دورلي|دور\s+لي|دور|سيرش|search)\s+(?:في|علي|على|بـ|ب)?\s*(?:تيك\s*توك|tiktok)\s*(?:عن|علي|على|for)?\s*(.+)/i;
  const ttDirectPattern = /^(?:تيك\s*توك|tiktok)\s+(?:عن|for)\s*(.+)$/i;
  if (ttSearchPattern.test(norm) || ttDirectPattern.test(norm)) {
    let query = cleanUserInput(rawText)
      .replace(/.*?(?:تيك\s*توك|tiktok)\s*(?:عن|علي|على|for)?\s*/i, '')
      .trim();
    return {
      type: 'tiktok_search',
      query,
    };
  }

  // b) بينترست: "صور من بينترست عن...", "ابحث في بينترست عن...", "صور بينترست عن..."
  const pinSearchPattern = /(?:صور(?:ه)?\s+(?:من\s+)?|ابحثلي\s+في\s+|ابحث\s+في\s+|دور\s+في\s+|سيرش\s+)?(?:بينترست|بنترست|بينتريست|pinterest)\s*(?:عن|لـ|ل|for|of)?\s*(.+)/i;
  if (/بينترست|بنترست|بينتريست|pinterest/i.test(norm) && pinSearchPattern.test(norm)) {
    let query = cleanUserInput(rawText)
      .replace(/.*?(?:بينترست|بنترست|بينتريست|pinterest)\s*(?:عن|لـ|ل|for|of)?\s*/i, '')
      .trim();
    return {
      type: 'pinterest_search',
      query,
    };
  }

  // c) يوتيوب: "ابحث في يوتيوب عن...", "ابحثلي في يوتيوب عن...", "دور في يوتيوب عن..."
  const ytSearchPattern = /(?:ابحثلي|ابحث\s+لي|ابحث|دورلي|دور\s+لي|دور|سيرش|search)\s+(?:في|علي|على|بـ|ب)?\s*(?:يوتيوب|اليوتيوب|youtube|yt)\s*(?:عن|علي|على|for)?\s*(.+)/i;
  const ytDirectPattern = /^(?:يوتيوب|youtube)\s+(?:عن|for)\s*(.+)$/i;
  if (ytSearchPattern.test(norm) || ytDirectPattern.test(norm)) {
    let query = cleanUserInput(rawText)
      .replace(/.*?(?:يوتيوب|اليوتيوب|youtube|yt)\s*(?:عن|علي|على|for)?\s*/i, '')
      .trim();
    return {
      type: 'youtube_search',
      query,
    };
  }

  // 4. 🎬 Video Generation (صناعة الفيديو بالذكاء الاصطناعي)
  // "اعمللي فيديو", "سويلي فيديو", "عايز فيديو", "فيديو لـ", "توليد فيديو", "اصنع فيديو", "make video", "generate video"
  const videoTriggers = [
    'اعمللي فيديو', 'اعمل لي فيديو', 'اعملي فيديو', 'اعمل فيديو',
    'سويلي فيديو', 'سوي لي فيديو', 'سوي فيديو',
    'عايز فيديو', 'عاوز فيديو', 'بدي فيديو', 'محتاج فيديو',
    'فيديو لـ', 'فيديو ل', 'فيديو عن',
    'توليد فيديو', 'ولد فيديو', 'اصنعلي فيديو', 'اصنع لي فيديو', 'اصنع فيديو', 'صمملي فيديو', 'صمم فيديو', 'انشئ فيديو', 'أنشئ فيديو',
    'make video', 'make a video', 'generate video', 'generate a video', 'create video', 'create a video', 'video of',
  ];

  const hasVideoTrigger = videoTriggers.some((tr) => norm.includes(normalizeText(tr)));
  if (hasVideoTrigger) {
    // كشف أبعاد الفيديو: بالطول / ريلز / تيك توك / ستوري -> 9:16 ، غير ذلك -> 16:9
    const isPortrait = /(?:بالطول|طولي|ريلز|ريل|تيك\s*توك|تيكتوك|ستوري|قصة|portrait|vertical|reels|reel|tiktok|story|9:16|9\/16)/i.test(rawText);
    const ratio = isPortrait ? '9:16' : '16:9';

    // تنظيف الوصف من كلمات التشغيل والأبعاد
    let prompt = cleanUserInput(rawText);
    // إزالة عبارات التوليد
    for (const tr of videoTriggers) {
      const reg = new RegExp(tr.replace(/[\s\-_]+/g, '[\\s\\-_]+'), 'gi');
      prompt = prompt.replace(reg, ' ');
    }
    // إزالة كلمات الأبعاد
    const ratioPattern = /(?:^|\s+)(?:بالطول|طولي|ريلز|ريل|تيك\s*توك|تيكتوك|ستوري|قصة|بالعرض|عرضي|افقي|أفقي|portrait|vertical|landscape|horizontal|reels|reel|tiktok|story|9:16|16:9|9\/16|16\/9)(?=\s+|$)/gi;
    while (ratioPattern.test(prompt)) {
      prompt = prompt.replace(ratioPattern, ' ');
    }
    prompt = prompt
      .trim()
      .replace(/^(?:لـ|ل\s+|عن|of\s+|about\s+)/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      type: 'video_gen',
      prompt,
      ratio,
    };
  }

  // 5. 🎨 Image Generation (رسم الصور بالذكاء الاصطناعي)
  // "ارسم لي", "ارسم", "عايز صورة", "اعملي صورة", "صورة لـ", "توليد صورة", "draw me", "generate image"
  const imageTriggers = [
    'ارسم لي صورة', 'ارسم لي', 'ارسملي', 'ارسم ليا', 'ارسم صورة', 'ارسم',
    'عايز صورة', 'عاوز صورة', 'بدي صورة', 'محتاج صورة',
    'اعمللي صورة', 'اعملي صورة', 'اعمل لي صورة', 'اعمل صورة',
    'سويلي صورة', 'سوي لي صورة', 'سوي صورة',
    'صورة لـ', 'صورة ل', 'صورة عن',
    'توليد صورة', 'ولد صورة', 'اصنع صورة', 'صمم صورة',
    'draw me', 'draw a', 'draw', 'paint me', 'paint',
    'generate image', 'generate an image', 'create image', 'create an image', 'make an image',
    'image of', 'picture of',
  ];

  // تأكد ألا يكون فيديو أولاً
  const hasImageTrigger = imageTriggers.some((tr) => {
    const ntr = normalizeText(tr);
    // لو الكلمة "ارسم" أو "draw"، نتأكد من مطابقتها كبداية أو كلمة مستقلة
    if (ntr === 'ارسم' || ntr === 'draw' || ntr === 'paint') {
      return new RegExp(`(?:^|\\s)${ntr}(?:\\s|$)`).test(norm);
    }
    return norm.includes(ntr);
  });

  if (hasImageTrigger) {
    let prompt = cleanUserInput(rawText);
    for (const tr of imageTriggers) {
      const reg = new RegExp(`(^|\\s)${tr.replace(/[\\s\\-_]+/g, '[\\s\\-_]+')}(\\s|$)`, 'gi');
      prompt = prompt.replace(reg, ' ');
    }
    prompt = prompt
      .trim()
      .replace(/^(?:لـ|ل\s+|عن|of\s+|about\s+)/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      type: 'image_gen',
      prompt,
    };
  }

  // 6. 🎵 Song & Music Search/Download (الأغاني والموسيقى)
  // "حملي اغنية", "شغللي اغنية", "عايز اغنية", "اسمع اغنية", "هات اغنية", "نزل اغنية"
  const songTriggers = [
    'حمللي اغنية', 'حملي اغنية', 'حمل لي اغنية', 'حمل اغنية', 'حمللي تراك', 'حمل تراك',
    'شغللي اغنية', 'شغل لي اغنية', 'شغل اغنية', 'شغللي تراك', 'شغل تراك',
    'عايز اغنية', 'عاوز اغنية', 'بدي اغنية', 'محتاج اغنية',
    'اسمع اغنية', 'عايز اسمع اغنية', 'عاوز اسمع اغنية', 'اسمعني اغنية',
    'هات اغنية', 'هاتلي اغنية', 'هات لي اغنية',
    'نزل اغنية', 'نزل لي اغنية', 'نزلي اغنية', 'نزل تراك', 'نزلي تراك',
    'play song', 'download song', 'get song', 'listen to song',
  ];

  const hasSongTrigger = songTriggers.some((tr) => norm.includes(normalizeText(tr)));
  if (hasSongTrigger) {
    let query = cleanUserInput(rawText);
    for (const tr of songTriggers) {
      const reg = new RegExp(tr.replace(/[\s\-_]+/g, '[\\s\\-_]+'), 'gi');
      query = query.replace(reg, ' ');
    }
    query = query
      .trim()
      .replace(/^(?:لـ|ل\s+|عن|بتاعت|حق|of\s+|for\s+)/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      type: 'song_download',
      query,
    };
  }

  return null;
}

/**
 * 🚀 الموزع الذكي لتنفيذ الأدوات (Tool Dispatcher)
 * @param {object} sock - اتصال Baileys
 * @param {object} m - كائن الرسالة
 * @param {string} text - نص الرسالة
 * @param {object} profile - بروفايل المستخدم
 * @returns {Promise<boolean>} true إذا تم التعرف على الأداة وتنفيذها، false للمحادثة العادية
 */
export async function dispatchToolAction(sock, m, text, profile) {
  if (!text || typeof text !== 'string') return false;

  const intent = detectIntent(text);
  if (!intent) return false;

  console.log(`🎯 [Tool-Caller] تم اكتشاف أداة ذكية: ${intent.type} للرسالة: "${text.slice(0, 50)}"`);

  // ─────────────────────────────────────────────────────────────
  // a) Video Generation (صناعة الفيديو)
  // ─────────────────────────────────────────────────────────────
  if (intent.type === 'video_gen') {
    const cleanPrompt = intent.prompt;
    const ratio = intent.ratio;

    if (!cleanPrompt || cleanPrompt.length < 2) {
      await sendText(
        sock,
        m.jid,
        '🎬 قولي يا صاحبي فكرة الفيديو أو المشهد اللي في خيالك عشان أصنعهولك! 🚀\nمثال: "اعمللي فيديو قطة بتلعب كورة في الشارع بالطول"',
      );
      return true;
    }

    // رد فوري بشخصية استرو المصرية
    await sendText(
      sock,
      m.jid,
      `🎬 حاضر من عيني يا صاحبي! ثواني وأصنعلك أحلى فيديو بالذكاء الاصطناعي... ⏳\n(الأبعاد: ${ratio === '9:16' ? '📱 ريلز/تيك توك 9:16' : '🎬 بالعرض 16:9'})`,
    );

    try {
      const url = await api.video(cleanPrompt, { ratio });
      if (!url) throw new Error('لم يرجع رابط فيديو من الـ API');

      await sendVideo(sock, m.jid, url, `🎬 *${cleanPrompt}*`);

      // أزرار المتابعة التفاعلية
      await sendQuickReplies(sock, m.jid, {
        title: '🎬 خيارات الفيديو',
        text: 'عايز تعيد توليد المشهد بأبعاد تانية؟ اختار من هنا 👇',
        buttons: [
          { label: '🎬 إعادة بالعرض 16:9', id: `اعمللي فيديو بالعرض ${cleanPrompt}` },
          { label: '📱 إعادة بالطول 9:16', id: `اعمللي فيديو بالطول ${cleanPrompt}` },
        ],
      });
    } catch (err) {
      console.error('❌ فشل توليد الفيديو في tool-caller:', err.message);
      await sendText(
        sock,
        m.jid,
        '🥴 معلش يا صاحبي سيرفر الفيديو مضغوط دلوقتي أو المشهد معقد شوية، جرّب تاني بعد لحظات أو بسّط الوصف!',
      );
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // b) Image Generation (رسم الصور)
  // ─────────────────────────────────────────────────────────────
  if (intent.type === 'image_gen') {
    const cleanPrompt = intent.prompt;

    if (!cleanPrompt || cleanPrompt.length < 2) {
      await sendText(
        sock,
        m.jid,
        '🎨 قولي تحب أرسم لك إيه بالتفصيل يا فنان؟ 🖌️\nمثال: "ارسم لي قطة سيامية بتشرب قهوة على شاطئ البحر"',
      );
      return true;
    }

    // رد بشخصية استرو
    await sendText(sock, m.jid, '🎨 حالا يا سيدي، ببدأ أرسمها بالذكاء الاصطناعي... ⏳');

    try {
      const url = await api.image(cleanPrompt, { pretty: false });
      if (!url) throw new Error('فشل رابط الصورة');

      await sendImage(sock, m.jid, url, `🎨 *${cleanPrompt}*`);

      // أزرار متابعة تفاعلية: تحويل لفيديو أو رسم نسخة تانية
      await sendQuickReplies(sock, m.jid, {
        title: '🎨 خيارات الصورة',
        text: 'عجبتك الصورة؟ تقدر تحولها لفيديو أو ترسم نسخة تانية 👇',
        buttons: [
          { label: '🎬 تحويل لفيديو', id: `اعمللي فيديو ${cleanPrompt}` },
          { label: '🎨 رسم نسخة أخرى', id: `ارسم لي ${cleanPrompt}` },
        ],
      });
    } catch (err) {
      console.error('❌ فشل توليد الصورة في tool-caller:', err.message);
      await sendText(
        sock,
        m.jid,
        '🥴 معلش يا صاحبي حصل ضغط على رسام الذكاء الاصطناعي، جرّب تاني كمان ثواني!',
      );
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // c) Song & Music Search/Download (الأغاني والموسيقى)
  // ─────────────────────────────────────────────────────────────
  if (intent.type === 'song_download') {
    const cleanQuery = intent.query;

    if (!cleanQuery || cleanQuery.length < 2) {
      await sendText(
        sock,
        m.jid,
        '🎵 قولي اسم الأغنية أو المغني اللي عايز تسمعه يا سكرة! 🎧\nمثال: "شغللي اغنية عمرو دياب تملي معاك"',
      );
      return true;
    }

    await sendText(sock, m.jid, `🎵 ثواني يا فنان، بدورلك على "${cleanQuery}" وبجهزلك أحلى جودة... ⏳`);

    try {
      let results = await api.ytSearch(cleanQuery, 3).catch(() => []);
      if (!results || !results.length) {
        // تجربة سبوتيفاي احتياط
        const sp = await api.spotifySearch(cleanQuery, 3).catch(() => []);
        if (sp?.length) {
          results = sp.map((item, idx) => ({
            index: idx,
            id: item.id || String(idx),
            title: item.title || item.name || cleanQuery,
            duration: item.duration,
            author: item.artist || item.artists?.[0]?.name,
            url: item.url,
          }));
        }
      }

      if (!results || !results.length) {
        await sendText(
          sock,
          m.jid,
          `😕 ملقتش الأغنية دي يا صاحبي، اتأكد من الاسم أو اكتب اسم المغني وجرب تاني!`,
        );
        return true;
      }

      // حفظ في الكاش عشان الزرار يحملها على طول
      const all = db.get('searchCache', {});
      all[m.jid] = { type: 'song', results, at: Date.now() };
      db.set('searchCache', all);

      const buttons = results.slice(0, 3).map((r, i) => ({
        label: `🎧 ${String(r.title).slice(0, 30)}`,
        id: `.song dl-${r.index ?? i}-audio`,
      }));

      await sendQuickReplies(sock, m.jid, {
        title: `🎵 نتايج أغنية: ${cleanQuery.slice(0, 25)}`,
        text:
          results
            .slice(0, 3)
            .map((r, i) => `${i + 1}. 🎵 *${r.title}*\n⏱️ ${r.duration || ''} • 👤 ${r.author || ''}`)
            .join('\n\n') + '\n\nاضغط على الزر لتحميل الصوت فوراً 👇',
        buttons,
      });
    } catch (err) {
      console.error('❌ فشل بحث الأغاني:', err.message);
      await sendText(sock, m.jid, '🥴 حصل خطأ أثناء البحث عن الأغنية، جرب تاني!');
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // d) Search Tools (بحث تيك توك، بينترست، يوتيوب)
  // ─────────────────────────────────────────────────────────────
  if (intent.type === 'tiktok_search') {
    const query = intent.query;
    if (!query) {
      await sendText(sock, m.jid, '📱 قولي عايز تبحث عن إيه في تيك توك؟\nمثال: "ابحثلي في تيك توك عن مقالب مضحكة"');
      return true;
    }

    await sendText(sock, m.jid, `📱 ثواني يا غالي، بدورلك في تيك توك على "${query}"... ⏳`);

    try {
      const results = await api.tiktokSearch(query).catch(() => []);
      if (!results || !results.length) {
        await sendText(sock, m.jid, '😕 ملقيتش أي مقاطع في تيك توك مطابقة للبحث ده.');
        return true;
      }

      const all = db.get('searchCache', {});
      all[m.jid] = { type: 'ttsearch', results, at: Date.now() };
      db.set('searchCache', all);

      const top = results.slice(0, 3);
      const buttons = top.map((r, i) => ({
        label: `🎬 مقطع ${i + 1}`,
        id: `.ttsearch dl-${i}-video`,
      }));

      const summary = top
        .map((r, i) => `${i + 1}. 📱 *${(r.desc || 'مقطع تيك توك').slice(0, 45)}*\n👤 ${r.author?.name ?? ''}`)
        .join('\n\n');

      await sendQuickReplies(sock, m.jid, {
        title: `📱 تيك توك: ${query.slice(0, 25)}`,
        text: `${summary}\n\nاختر مقطع لتنزيله فوراً بدون علامة مائية 👇`,
        buttons,
      });
    } catch (err) {
      console.error('❌ فشل بحث تيك توك:', err.message);
      await sendText(sock, m.jid, '🥴 تعذر البحث في تيك توك حالياً، جرب كمان شوية.');
    }
    return true;
  }

  if (intent.type === 'pinterest_search') {
    const query = intent.query;
    if (!query) {
      await sendText(sock, m.jid, '📌 قولي عايز صور إيه من بينترست؟\nمثال: "صور من بينترست عن ديكور غرف نوم"');
      return true;
    }

    await sendText(sock, m.jid, `📌 حاضر يا سيدي، بدورلك في بينترست على أجمل الصور لـ "${query}"... ⏳`);

    try {
      const results = await api.pinimg(query, 6).catch(() => []);
      if (!results || !results.length) {
        await sendText(sock, m.jid, '😕 ملقيتش صور في بينترست بالكلمات دي.');
        return true;
      }

      const all = db.get('searchCache', {});
      all[m.jid] = { type: 'pin', results, at: Date.now() };
      db.set('searchCache', all);

      // إرسال أول صورة فوراً
      const first = results[0];
      const imgUrl = first?.image ?? first?.url;
      if (imgUrl) {
        await sendImage(sock, m.jid, imgUrl, `📌 *${first.title || query}*`);
      }

      // إرسال أزرار لباقي الصور
      const buttons = results.slice(1, 4).map((r, i) => ({
        label: `🖼️ صورة أخرى ${i + 1}`,
        id: `.pin img-${i + 1}`,
      }));

      if (buttons.length) {
        await sendQuickReplies(sock, m.jid, {
          title: `📌 صور بينترست: ${query.slice(0, 25)}`,
          text: 'عايز تشوف صور تانية من نفس البحث؟ اختار من هنا 👇',
          buttons,
        });
      }
    } catch (err) {
      console.error('❌ فشل بحث بينترست:', err.message);
      await sendText(sock, m.jid, '🥴 تعذر جلب صور بينترست حالياً، جرب تاني بعد قليل.');
    }
    return true;
  }

  if (intent.type === 'youtube_search') {
    const query = intent.query;
    if (!query) {
      await sendText(sock, m.jid, '🎬 قولي عايز تبحث عن إيه في يوتيوب؟\nمثال: "ابحث في يوتيوب عن ملخص أهداف اليوم"');
      return true;
    }

    await sendText(sock, m.jid, `🎬 حالا يا برو، ببحثلك في يوتيوب على "${query}"... ⏳`);

    try {
      const results = await api.ytSearch(query, 5).catch(() => []);
      if (!results || !results.length) {
        await sendText(sock, m.jid, '😕 ملقيتش فيديوهات في يوتيوب مطابقة للبحث ده.');
        return true;
      }

      const all = db.get('searchCache', {});
      all[m.jid] = { type: 'song', results, at: Date.now() };
      db.set('searchCache', all);

      const buttons = results.slice(0, 3).map((r, i) => ({
        label: `🎬 تحميل ${i + 1}`,
        id: `.song dl-${r.index ?? i}`,
      }));

      const summary = results
        .slice(0, 3)
        .map((r, i) => `${i + 1}. 🎬 *${r.title}*\n⏱️ ${r.duration || ''} • 👤 ${r.author || ''}`)
        .join('\n\n');

      await sendQuickReplies(sock, m.jid, {
        title: `🎬 نتائج يوتيوب: ${query.slice(0, 25)}`,
        text: `${summary}\n\nاختر فيديو للمشاهدة أو التحميل 👇`,
        buttons,
      });
    } catch (err) {
      console.error('❌ فشل بحث يوتيوب:', err.message);
      await sendText(sock, m.jid, '🥴 تعذر البحث في يوتيوب حالياً، جرب تاني بعد شوية.');
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // e) Song Lyrics (كلمات الأغاني)
  // ─────────────────────────────────────────────────────────────
  if (intent.type === 'lyrics') {
    const query = intent.query;
    if (!query) {
      await sendText(
        sock,
        m.jid,
        '📝 قولي اسم الأغنية اللي عايز كلماتها يا غالي! 🎶\nمثال: "كلمات اغنية تملي معاك عمرو دياب"',
      );
      return true;
    }

    await sendText(sock, m.jid, `📝 حاضر يا صاحبي، ثواني وأجيبلك كلمات "${query}"... ⏳`);

    try {
      const res = await api.lyrics(query).catch(() => null);
      if (!res || !res.lyrics) {
        await sendText(
          sock,
          m.jid,
          `😕 ملقتش كلمات لأغنية "${query}" يا صاحبي، اتأكد من كتابة الاسم صح أو اكتب المغني جنبها!`,
        );
        return true;
      }

      const header = `📝 *${res.title ?? query}*\n${res.artist && res.artist !== res.title ? `🎤 الفنان: *${res.artist}*\n` : ''}───────────────────\n\n`;
      const body = res.lyrics.length > 3500 ? res.lyrics.slice(0, 3500) + '\n\n... (تم اختصار الكلمات لطولها)' : res.lyrics;
      await sendText(sock, m.jid, header + body);
    } catch (err) {
      console.error('❌ فشل جلب كلمات الأغنية:', err.message);
      await sendText(sock, m.jid, '🥴 حصل خطأ أثناء جلب كلمات الأغنية، جرب تاني!');
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // f) Anime TTS (صوت شخصيات الأنمي)
  // ─────────────────────────────────────────────────────────────
  if (intent.type === 'anime_tts') {
    const character = intent.character || 'غوكو';
    const textToSay = intent.text;

    if (!textToSay || textToSay.length < 2) {
      await sendText(
        sock,
        m.jid,
        `🎙️ قولي عايز ${character} يقول إيه بالظبط؟ 🔥\nمثال: "قول بصوت ${character} أنا أقوى محارب في الكون"`,
      );
      return true;
    }

    try {
      const url = await api.animeTts(textToSay.slice(0, 300), character).catch(() => null);
      if (url) {
        await sendVoice(sock, m.jid, url);
      } else {
        // احتياطي إذا تعذر صوت الأنمي
        await speak(sock, m.jid, textToSay, { voice: character });
      }
    } catch (err) {
      console.error('❌ فشل صوت الأنمي:', err.message);
      await sendText(sock, m.jid, `🥴 معلش يا صاحبي حصل مشكلة في تقليد صوت ${character} دلوقتي، جرب تاني!`);
    }
    return true;
  }

  return false;
}

export default {
  dispatchToolAction,
  detectIntent,
  normalizeText,
  cleanUserInput,
};
