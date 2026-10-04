import { db } from './db.js';
import { CONTACTS } from '../config.js';

// 🆔 هوية الأشخاص — مينساش حد أبدًا
// واتساب 2026 بيبعت هوية LID (@lid) — ورقم التليفون الحقيقي بيبقى في الحقل البديل:
//   خاص  → remoteJidAlt   |  جروب → participantAlt
// نظامنا: كل صيغة بتتربط بمفتاح أساسي واحد، فالشخص = بروفايل واحد مهما جه منين

// ⚠️ ممنوع تحط 'lid' هنا — @lid هي هوية الأشخاص نفسها في واتساب 2026
// (كانت موجودة قبل كده وبتخلي normalize يرفض كل جيادات الـ LID → البروفايلات بتتكرر)
const RESERVED = new Set(['g.us', 'broadcast', 'newsletter', 'status', 'server', 'bot']);

let botIds = [];

// تطبيع أي صيغة JID لصيغة موحدة — @lid زي ما هو وغيرها على s.whatsapp.net
export function normalize(j) {
  const s = String(j ?? '').trim();
  if (!s) return '';
  const [numPart, domainPart] = s.split('@');
  const num = (numPart ?? '').split(':')[0];
  const domain = (domainPart ?? '').toLowerCase();
  if (!num || !/^\d+$/.test(num)) return '';
  if (RESERVED.has(domain)) return '';
  return domain === 'lid' ? `${num}@lid` : `${num}@s.whatsapp.net`;
}

// تسجيل هوية البوت نفسه + تنظيف الخريطة
export function setBotIdentity(sock) {
  botIds = [sock.user?.id, sock.user?.lid, sock.user?.jid].map(normalize).filter(Boolean);
  cleanIdentityMap();
  clearCanonicalCache(); // هوية البوت اتغيرت؟ الكاش القديم ميصلحش
}

// المفتاح الأساسي للشخص من أي صيغة هوية + ربط الصيغ ببعض
export function resolveKey(...candidates) {
  const ids = candidates
    .map(normalize)
    .filter(Boolean)
    .filter((id) => !botIds.includes(id)); // البوت مش شخص
  if (!ids.length) return null;

  const aliases = db.get('identities', {});

  for (const id of ids) {
    const known = aliases[id];
    if (known && !botIds.includes(known)) {
      let changed = false;
      for (const other of ids) {
        if (!aliases[other]) {
          aliases[other] = known;
          changed = true;
        }
      }
      if (changed) db.set('identities', aliases);
      return known;
    }
  }

  // شخص جديد — الـ LID هو المفتاح الأساسي، وإلا أول هوية موجودة
  const primary = ids.find((i) => i.endsWith('@lid')) ?? ids[0];
  for (const id of ids) aliases[id] = primary;
  db.set('identities', aliases);
  return primary;
}

// 🎯 مين صاحبنا صاحب المفتاح ده؟ (مزامنة — من config وخريطة identities بس، من غير شبكة)
// بيرجع المفتاح الأساسي للصاحب = رقمه الدولي، أو null لو مش من الأصحاب
export function contactKeyOf(jid) {
  const id = normalize(jid);
  if (!id) return null;

  // الرقم نفسه مفتاح أساسي في CONTACTS؟
  if (CONTACTS[id]) return id;

  // 🆔 LID مسجّل جنب صاحبنا في config (metadata `lids`)
  for (const [pn, meta] of Object.entries(CONTACTS)) {
    if ((meta.lids ?? []).map(normalize).includes(id)) return pn;
  }

  // الأسماء البديلة المسجلة في identities — بسلسلة خطوة أو اتنين
  const aliases = db.get('identities', {});
  const t1 = aliases[id];
  if (t1) {
    if (CONTACTS[t1]) return t1;
    const t2 = aliases[t1];
    if (t2 && CONTACTS[t2]) return t2;
  }
  return null;
}

// كاش المفاتيح الكانونية — عشان مانسألش المكتبة/الشبكة مع كل رسالة
const CANON_TTL = 10 * 60 * 1000; // النتايج المؤكدة
const NEG_TTL = 30 * 1000; // السلبية بتتقارب بسرعة — لمسة شبكة واحدة ما تبقاش
// 10 دقايق، عشان الشخص مايتقسمش لبروفايل جديد طول الوقت
const canonCache = new Map(); // id → { key, at, sure }

// 🆔 المفتاح الكانوني للشخص من أي صيغة هوية — دي القاعدة اللي بتقفل مشكلة
// البروفايلات المكررة (LID ورقم لكل نفس الشخص):
//   صاحبنا → رقمه الدولي دايمًا (مفتاح ثابت مهما جه الوش ده منين)
//   مش صاحبنا → نفس منطق resolveKey القديم (السلوك ميتغيرش)
export async function canonicalKey(sock, jid) {
  try {
    const id = normalize(jid);
    if (!id || botIds.includes(id)) return null;

    const hit = canonCache.get(id);
    // ⚠️ كان `Date.now() - hit.at < CANON_TTL` بيخصم النتائج السلبية كمان —
    // يعني `phoneOf` الرجّع null (شبكة خبطت) فالنتيجة اتخزّنت 10 دقايق،
    // ورسايل الشخص ده بتروح لبروفايل LID جديد = الذاكرة والاقتصاد
    // بيتقسموا. دلوقتي: المؤكدة تتخزّن طويل، والسلبية بتتقارب بسرعة.
    if (hit) {
      const age = Date.now() - hit.at;
      if (hit.sure ? age < CANON_TTL : age < NEG_TTL) return hit.key;
    }

    // 1) معروف من config أو خريطة identities — من غير أي نداء شبكة
    let key = contactKeyOf(id);
    let sure = !!key;

    // 2) لسه متعرفناش؟ نداء المكتبة يحوّل الـ LID لرقمه (وبيرجع يسجّل في identities)
    if (!key) {
      const pn = normalize(await phoneOf(sock, id));
      if (pn && CONTACTS[pn]) {
        key = pn;
        sure = true;
      }
    }

    // 3) مش صاحبنا — نفس المفتاح الموحّد القديم عشان السلوك يفضل زي ما هو
    if (!key) key = resolveKey(id);

    canonCache.set(id, { key, at: Date.now(), sure });
    return key;
  } catch {
    return null; // فشل آمن — المستدعي يكمّل بالمفتاح القديم
  }
}

// تصفير كاش المفاتيح الكانونية — لما خريطة الهويات تتحدث (lid-mapping جديد مثلًا)
export function clearCanonicalCache() {
  canonCache.clear();
}

// 🧹 تنظيف من الارتباطات الملوثة
export function cleanIdentityMap() {
  const aliases = db.get('identities', {});
  const users = db.get('users', {});
  let changed = false;
  for (const [alias, target] of Object.entries(aliases)) {
    // البوت مش شخص — نتخلص من أي ارتباط فيه
    if (botIds.includes(alias) || botIds.includes(target)) {
      delete aliases[alias];
      changed = true;
      continue;
    }
    // ⚠️ كان بيحذف أي alias مشendants عنده بروفايل — والربط ده
    // بيتبني من `lid-mapping.update` لحد ما الشخص يكلمنا أول مرة.
    // التنظيف بيشتغل وقت الإقلاع (قبل أي رسالة) فكان بيمسح كل
    // خرائط الـ LID السليمة ويرجّعنا لمشكلة البروفايلات المكررة.
    // دلوقتي: بنمسح بس لو الـ alias لنفسه أو لقيمة مش صالحة.
    const selfLinked = alias === target;
    const badTarget = !target || typeof target !== 'string';
    if (selfLinked && alias.endsWith('@lid')) {
      // ارتباط LID بنفسه — مش مفيد، نمسحه
      delete aliases[alias];
      changed = true;
    } else if (badTarget) {
      delete aliases[alias];
      changed = true;
    }
  }
  if (changed) db.set('identities', aliases);
}

// ربط LID برقمه
function linkIdentities(lid, pn) {
  if (!lid || !pn) return null;
  const aliases = db.get('identities', {});
  aliases[lid] = pn;
  aliases[pn] = pn;
  db.set('identities', aliases);
  return pn;
}

// 🔄 رقم التليفون الحقيقي من الـ LID (محلياً ← ذاكرة الإشارة ← findUserId)
export async function phoneOf(sock, jid) {
  const key = normalize(jid);
  if (!key) return null;
  if (key.endsWith('@s.whatsapp.net')) return key;
  if (!key.endsWith('@lid')) return null;

  try {
    const alias = db.get('identities', {})[key];
    if (alias && alias.endsWith('@s.whatsapp.net')) return alias;

    const fromSig = await sock.signalRepository?.lidMapping
      ?.getPNForLID?.(jid)
      ?.catch?.(() => null);
    if (fromSig) {
      const linked = linkIdentities(key, normalize(fromSig));
      if (linked) return linked;
    }

    const found = await sock.findUserId?.(jid).catch?.(() => null);
    if (found?.phoneNumber) {
      const linked = linkIdentities(key, normalize(found.phoneNumber));
      if (linked) return linked;
    }
  } catch {}
  return null;
}

// 💚 صاحبنا في قائمة الأصدقاء — بأي صيغة هوية (رقم / LID من config / اسم بديل في identities)
export function findContact(...keys) {
  for (const k of keys) {
    if (!k) continue;
    const pn = contactKeyOf(k);
    if (pn) return CONTACTS[pn];
  }
  return null;
}
