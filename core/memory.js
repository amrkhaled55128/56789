import { db } from './db.js';
import api from './api.js';
import { CONTACTS } from '../config.js';
import { findContact, normalize } from './identity.js';

// 🧠 ذاكرة نوفا طويلة المدى — مينساش حد ولا اسم ولا ذكرى
// البروفايل: { name, facts[], memories[{at,text}], lastMessages[], mood, tone, lastSeen, msgCount }

const MAX_MEMORIES = 15;
const EXTRACT_EVERY = 8; // كل 8 رسايل من المستخدم نستخرج ذكرى

function users() {
  return db.get('users', {});
}

export function getProfile(key) {
  const all = users();
  const profile = all[key] ?? {
    name: null,
    facts: [],
    memories: [],
    lastMessages: [],
    joinedAt: Date.now(),
    lastSeen: null,
    msgCount: 0,
    lastMood: null,
    tone: null,
  };
  // 💚 الأصدقاء المقربين — اسمهم من config عمره ما يضيع
  // (بأي صيغة مفتاح: رقم دولي أو LID — findContact بتحل أي صيغة للمفتاح الأساسي)
  const contact = CONTACTS[key] ?? findContact(key);
  if (contact && !profile.name) profile.name = contact.name;
  return profile;
}

export function saveProfile(key, profile) {
  const all = users();
  profile.lastSeen = Date.now();
  all[key] = profile;
  db.set('users', all);
}

// ⏳ تحديث آخر ظهور + آخر شات + عداد الرسايل (لجدولة استخراج الذكريات)
export function touchProfile(key, chatJid = null) {
  const p = getProfile(key);
  p.lastSeen = Date.now();
  if (chatJid) p.lastChat = chatJid;
  p.msgCount = (p.msgCount ?? 0) + 1;
  saveProfile(key, p);
  return p;
}

export function rememberMessage(key, role, text) {
  const p = getProfile(key);
  p.lastMessages = [...(p.lastMessages ?? []), { role, text: String(text).slice(0, 300) }].slice(-8);
  saveProfile(key, p);
}

export function rememberMemory(key, text) {
  const p = getProfile(key);
  const memories = p.memories ?? [];
  const clean = String(text).trim().slice(0, 150);
  if (!clean || memories.some((m) => m.text === clean)) return false;
  // ⚠️ مهم: بنكتب على نفس الـ object عشان مايضيعش بالتحديث المتأخر من saveProfile
  p.memories = [...memories, { at: Date.now(), text: clean }].slice(-MAX_MEMORIES);
  saveProfile(key, p);
  return true;
}

export function rememberFact(key, fact) {
  const p = getProfile(key);
  p.facts = p.facts ?? [];
  if (!p.facts.includes(fact)) {
    p.facts = [...p.facts, fact].slice(-10);
    saveProfile(key, p);
    return true;
  }
  return false;
}

export function rememberMood(key, mood) {
  const p = getProfile(key);
  p.lastMood = { mood, at: Date.now() };
  saveProfile(key, p);
}

// 😊 كشف الإحساس من كلام المستخدم — مع قراءة النفي صح
// (المشكلة القديمة: "أنا مش مبسوط" كانت بتتفسّر فرحان!)
const NEGATION = /(?:مش|مست|ما\s*ب?ش|ما\s*ب?عرفش|بخصوص|مش\s*خالص)/;
const MOODS = [
  { mood: 'زعلان', re: /زعلان|مجروح|حزين|مكسور|ضايق|بكيت|زهقان|تعبت من الدنيا|مصعّب|مضايق/, neg: /مش\s*(?:زعلان|مكسور)|محدش\s*زعلان/ },
  { mood: 'تعبان', re: /تعبان|مخنوق|مضغوط|مش قادر|منهار|مرهق/, neg: /مش\s*(?:تعبان|مخنوق)/ },
  { mood: 'قلقان', re: /قلقان|خايف|متوتر|قلقي|همي|قلق/, neg: /مش\s*(?:قلقان|خايف)/ },
  { mood: 'حبيت', re: /بحب|حبيت|عاشق|غرمت|في قلبي|حبيبتي|حبيبي/, neg: null },
  { mood: 'مبسوط', re: /مبسوط|سعيد|فرحان|أجمد|رابح|الحمد لله|فتحت|مبروك/, neg: /مش\s*(?:مبسوط|سعيد|فرحان)/ },
];

export function detectMood(text) {
  for (const { mood, re, neg } of MOODS) {
    if (!re.test(text)) continue;
    // لو فيه نفي قبل الكلمة مباشرة → مشMood ده (يعكسه)
    if (neg && neg.test(text)) continue;
    return mood;
  }
  return null;
}

// 😐 مقياس الحنية — لو زهق من كتر الحنية يتراجع لفترة
export function setTone(key, mode) {
  const p = getProfile(key);
  p.tone = mode === 'chill' ? { mode, until: Date.now() + 2 * 3600000, msgsLeft: 10 } : null;
  saveProfile(key, p);
}

export function currentTone(profile) {
  const t = profile?.tone;
  if (!t) return 'warm';
  if (t.mode === 'chill') {
    if (Date.now() > t.until || t.msgsLeft <= 0) {
      return 'warm'; // المنادي مش هيتحدث هنا — اتحدث في saveProfile اللاحقة
    }
    return 'chill';
  }
  return t.mode ?? 'warm';
}

export function chillTick(key) {
  const p = getProfile(key);
  if (p.tone?.mode === 'chill') {
    p.tone.msgsLeft--;
    if (p.tone.msgsLeft <= 0) p.tone = null;
    saveProfile(key, p);
  }
}

// اسم الشخص لا يُنسى: الأولوية للأصدقاء (بأي صيغة هوية)، ثم "اسمي فلان"، ثم pushName
export function ensureName(key, profile, pushName, sender, senderAlt) {
  // 💚 الأصدقاء المقربين — اسمهم ثابت من config (بأي صيغة هوية: رقم أو LID)
  const contact = findContact(key, sender, senderAlt);
  if (contact) {
    if (profile.name !== contact.name) {
      profile.name = contact.name;
      // نسجل جهازه عشان المرات الجاية
      profile.phoneJid = sender;
      saveProfile(key, profile);
      return true;
    }
    return false;
  }
  if (profile.name) return false;
  const candidate = pushName && pushName !== 'صديقي' && pushName.length >= 2 ? pushName : null;
  if (candidate) {
    profile.name = candidate;
    saveProfile(key, profile);
    return true;
  }
  return false;
}

// استخراج معلومات ذاتية من كلام المستخدم: "اسمي أحمد" / "أنا بنت" / "أنا ولد"
export function learnFromText(key, text) {
  const p = getProfile(key);
  const facts = p.facts ?? [];
  let changed = false;

  // الاسم — بكل صيغه (بهمزة أو بدون، و"اسمي"/"اسمي"/"اسمي")
  const nameMatch = /(?:اسمي|اسمي|اسمي|إسمي|إسمي|انا اسمي|أنا اسمي)\s+([\p{L}\p{N}]{2,20})/u.exec(text);
  if (nameMatch && nameMatch[1] !== p.name) {
    p.name = nameMatch[1];
    changed = true;
  }

  // النوع — مع احترام النفي ("أنا مش بنت" = ولد)
  if (/(?:^|\s)(?:أنا|انا)\s*(?:مش|مست)?\s*(بنت|صبية|ست|بنتة)/.test(text)) {
    const isNegated = /(?:أنا|انا)\s*(?:مش|مست)\s*(بنت|صبية|ست)/.test(text);
    const want = isNegated ? 'ولد' : 'بنت';
    if (!facts.includes(want)) {
      const other = want === 'بنت' ? 'ولد' : 'بنت';
      const i = facts.indexOf(other);
      if (i >= 0) facts.splice(i, 1);
      facts.push(want);
      changed = true;
    }
  }
  if (/(?:^|\s)(?:أنا|انا)\s*(?:مش|مست)?\s*(ولد|راجل|رجالة)/.test(text)) {
    const isNegated = /(?:أنا|انا)\s*(?:مش|مست)\s*(ولد|راجل)/.test(text);
    const want = isNegated ? 'بنت' : 'ولد';
    if (!facts.includes(want)) {
      const other = want === 'بنت' ? 'ولد' : 'بنت';
      const i = facts.indexOf(other);
      if (i >= 0) facts.splice(i, 1);
      facts.push(want);
      changed = true;
    }
  }

  // 🔍 لحظات مهمة تستاهل ذكرى
  const bigMoment = /(?:سافرت|عندي (?:امتحان|مقابلة|شغل جديد)|اتخرجت|بشتغل دلوقتي|سكنت|جوازي|خطوبتي|مريض|دخلت (?:الجامعة|الجيش)|خلصت مشروع)/.test(text);
  if (bigMoment) {
    rememberMemory(key, text.slice(0, 120));
  }

  if (changed) {
    p.facts = facts;
    saveProfile(key, p);
  }
  return changed;
}

// 💭 استخراج ذكرى من آخر محادثة — نداء AI سريع، بيتنادى كل EXTRACT_EVERY رسالة
export async function extractMemory(key) {
  const p = getProfile(key);
  const convo = (p.lastMessages ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .join(' | ')
    .slice(0, 700);
  if (!convo || convo.length < 20) return false;

  try {
    const raw = await api.gpt(
      `من الكلام ده استخرج معلومة شخصية واحدة مهمة عن "${p.name ?? 'الشخص'}" — حاجة تستاهل تتفتكر بعدين (عمله، خلافه، خبر حصلله، حاجة بتحبها). رد بالمعلومة بس في سطر واحد قصير بالعامية المصرية، ولو مفيش حاجة مهمة رد بالحرفين: مفيش\n\nالكلام: ${convo}`,
    );
    const clean = raw.trim().replace(/^["'-]+|["'-]+$/g, '');
    if (clean && clean.length > 5 && clean.length < 150 && !/مفيش|لا يوجد|لا توجد/i.test(clean)) {
      return rememberMemory(key, clean);
    }
  } catch {}
  return false;
}

// هل ده "رجوع" بعد غياب؟ وكم ساعة؟
export function absenceHours(profile) {
  if (!profile?.lastSeen) return 0;
  return (Date.now() - profile.lastSeen) / 3600000;
}

// نص سياق جاهز للحقن في تعليمات الـ AI — بيحترم ميزانية طول الرابط
export function contextBlock(profile, pushName, budget = 300) {
  const lines = [];
  const name = profile.name ?? (pushName !== 'صديقي' ? pushName : null);
  if (name) lines.push(`- اسمه: "${name}"`);
  for (const f of profile.facts ?? []) lines.push(`- معلومة: ${f}`);

  // آخر إحساس معروف — البوت يفتح بيه
  const moodInfo = profile.lastMood;
  if (moodInfo?.mood) {
    const hoursAgo = (Date.now() - moodInfo.at) / 3600000;
    if (hoursAgo < 24) {
      const ago = hoursAgo < 1 ? 'من شوية' : `من ${Math.round(hoursAgo)} ساعة`;
      lines.push(`- آخر إحساس له: "${moodInfo.mood}" (${ago}) — افتح بالسؤال عن إحساسه`);
    }
  }

  let block = lines.join('\n');

  // 💭 الذكريات — أحدث 3
  const mems = (profile.memories ?? []).slice(-3);
  if (mems.length) {
    const memLine = '- ذكريات من كلامه قبل كده: ' + mems.map((m) => m.text).join(' • ');
    if (block.length + memLine.length + 1 < budget) block += (block ? '\n' : '') + memLine;
  }

  // آخر الكلام — بنلحق اللي يملا الميزانية
  const convoParts = [];
  const msgs = profile.lastMessages ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const line = `${msgs[i].role === 'user' ? 'هو قال' : 'إنت ردت'}: ${msgs[i].text.slice(0, 120)}`;
    if (block.length + line.length + 1 > budget) break;
    convoParts.unshift(line);
    block = lines.join('\n') + (mems.length ? '\n' + mems.map((m) => '- ذكرى: ' + m.text).join('\n') : '') + (convoParts.length ? '\nآخر الكلام:\n' + convoParts.join('\n') : '');
  }

  return { block };
}

// 🧹 ترحيل بيانات قديمة — بيتنده مرة عند الإقلاع
export function migrateOldData() {
  const all = users();
  if (!all['']) return;

  // مين كان آخر واحد مستخدم البروفايل المكسور (الفاضي)؟ — الأحدث بالتوقيت
  const aiStates = db.get('aiState', {});
  const lastUser = Object.entries(aiStates)
    .filter(([, v]) => (v?.by ?? '') === '' || v?.at)
    .sort((a, b) => (b[1]?.at ?? 0) - (a[1]?.at ?? 0))
    .map(([lid]) => lid)[0];

  if (lastUser && !all[lastUser]) {
    all[lastUser] = { ...all[''], joinedAt: all[''].joinedAt ?? Date.now() };
    delete all[''];
    db.set('users', all);
    console.log(`🧠 ترحيل الذاكرة: البروفايل القديم اتربط بالهوية ${lastUser}`);
  }
}

// 🔀 دمج بروفايلين لنفس الشخص — الأساس a (الأغنى) والبروفايل b بيتصب فيه
function mergeProfiles(a, b) {
  const out = JSON.parse(JSON.stringify(a));
  // المعلومات: اتحاد بدون تكرار
  out.facts = [...new Set([...(a.facts ?? []), ...(b.facts ?? [])])].slice(-10);
  // الذكريات: اتحاد بدون تكرار مرتب بالزمن
  const seen = new Set();
  out.memories = [...(a.memories ?? []), ...(b.memories ?? [])]
    .filter((m) => {
      if (!m?.text || seen.has(m.text)) return false;
      seen.add(m.text);
      return true;
    })
    .sort((x, y) => (x.at ?? 0) - (y.at ?? 0))
    .slice(-MAX_MEMORIES);
  // آخر الكلام: بدون تكرار — آخر ظهور للجملة يكسب مكانه
  const convo = new Map();
  for (const msg of [...(a.lastMessages ?? []), ...(b.lastMessages ?? [])]) {
    if (msg?.text) convo.set(`${msg.role}|${msg.text}`, msg);
  }
  out.lastMessages = [...convo.values()].slice(-8);
  // العدادات والتواريخ بتتجمع
  out.msgCount = (a.msgCount ?? 0) + (b.msgCount ?? 0);
  out.joinedAt = Math.min(a.joinedAt ?? Date.now(), b.joinedAt ?? Date.now());
  out.lastSeen = Math.max(a.lastSeen ?? 0, b.lastSeen ?? 0);
  // آخر إحساس: الأحدث زمنًا يكسب
  if ((b.lastMood?.at ?? 0) > (out.lastMood?.at ?? 0)) out.lastMood = b.lastMood;
  // التبريد: لو الأساس مفيش منه خد بتاع التاني
  if (!out.tone && b.tone) out.tone = b.tone;
  // أي حقول ناقصة في الأساس كمّلها من التاني
  for (const [k, v] of Object.entries(b)) if (out[k] === undefined) out[k] = v;
  out.name = a.name ?? b.name ?? null;
  return out;
}

// 🧬 إصلاح جذري للبروفايلات المكررة: "شروق" بمفتاحين (LID ورقم) = بروفايل واحد
// بتتنده من bootCleanup عند الإقلاع:
//   1. بتلاقي كل مفاتيح نفس الشخص (الرقم + LIDs من config + الأسماء البديلة في identities)
//   2. بتدمجهم في بروفايل واحد تحت المفتاح الأساسي (الرقم الدولي) —
//      الأغنى ذكريات (وعند التعادل الأحدث ظهور) هو اللي بياخد الأساس
//   3. بتربط كل المفاتيح القديمة في identities بالمفتاح الأساسي
// بترجع عدد البروفايلات اللي اتمسحت بالدمج
export function mergeDuplicateProfiles() {
  const all = users();
  const aliases = db.get('identities', {});

  // كل صاحب ومفاتيحه المعروفة (رقم + LIDs من config + أسماء بديلة بيشاوروا عليهم)
  const groups = [];
  for (const [pn, meta] of Object.entries(CONTACTS)) {
    const ids = new Set([pn, ...(meta.lids ?? []).map(normalize).filter(Boolean)]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [alias, target] of Object.entries(aliases)) {
        if (ids.has(target) && !ids.has(alias)) {
          ids.add(alias);
          grew = true;
        }
      }
    }
    groups.push({ pn, meta, ids });
  }

  // بروفايلات اسمها نفس اسم صاحب من CONTACTS؟ دي لنفس الشخص برضه
  // — بس من غير ما نلمس مفتاح محجوز لصاحب تاني (مفيش دمج شخصين مختلفين بالغلط)
  for (const g of groups) {
    for (const [key, p] of Object.entries(all)) {
      if (g.ids.has(key) || p?.name !== g.meta.name) continue;
      if (groups.some((o) => o !== g && o.ids.has(key))) continue;
      g.ids.add(key);
    }
  }

  let mergedCount = 0;
  for (const { pn, meta, ids } of groups) {
    const keys = [...ids].filter((k) => all[k]);
    if (!keys.length) continue; // مفيش بروفايلات للشخص ده أصلًا
    if (keys.length === 1 && keys[0] === pn) continue; // مفيش تكرار

    // البروفايل الأغنى يكسب: الأكبر ذكريات، وعند التعادل الأحدث ظهور
    const winner = [...keys].sort((a, b) => {
      const byMem = (all[b].memories?.length ?? 0) - (all[a].memories?.length ?? 0);
      if (byMem) return byMem;
      return (all[b].lastSeen ?? 0) - (all[a].lastSeen ?? 0);
    })[0];

    let merged = JSON.parse(JSON.stringify(all[winner]));
    for (const k of keys) {
      if (k === winner) continue;
      merged = mergeProfiles(merged, all[k]);
      delete all[k];
      mergedCount++;
    }
    // 💚 اسم الأصدقاء من config هو المصدر الرسمي دايمًا
    merged.name = meta.name;
    all[pn] = merged;
    if (winner !== pn) {
      delete all[winner];
      mergedCount++;
    }

    // 🔗 كل المفاتيح القديمة بتبص على المفتاح الأساسي من دلوقتي
    for (const id of ids) aliases[id] = pn;
    aliases[pn] = pn;

    console.log(`🧬 دمج بروفايلات "${meta.name}": ${keys.filter((k) => k !== pn).join(' + ') || '(نقل)'} → ${pn}`);
  }

  if (mergedCount) {
    db.set('users', all);
    db.set('identities', aliases);
  }
  return mergedCount;
}
