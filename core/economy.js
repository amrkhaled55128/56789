import { db } from './db.js';

// 💰 نظام الاقتصاد والمستويات — الخبرة والعملات والألقاب
// db key 'economy' → { [identityKey]: { xp, level, coins, dailyStreak, lastDaily, totalWins, totalGames } }

export function getEco(key) {
  return (
    db.get('economy', {})[key] ?? {
      xp: 0,
      level: 1,
      coins: 100, // رصيد ترحيبي
      dailyStreak: 0,
      lastDaily: 0,
      totalWins: 0,
      totalGames: 0,
    }
  );
}

export function saveEco(key, eco) {
  const all = db.get('economy', {});
  all[key] = eco;
  db.set('economy', all);
}

// الخبرة اللازمة للقفز من مستوى لبعده — بتزيد أسّي
export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// ⚠️ كان المستوى بيتحسب لـ 1 للأبد — مفيش سطر في البوت كله بيعمل
// eco.level = …، فكل الناس "مستوى 1" وتاني .top و .mystats بلا معنى.
// دلوقتي المستوى بيتحسب من الخبرة المجمّعة عند كل awarded XP.
export function totalXpFor(level) {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i);
  return total;
}

export function levelFromXp(xp) {
  let level = 1;
  while (totalXpFor(level + 1) <= xp) level++;
  return level;
}

// يرجّع الـ level الجديد لو حصل ترقية (null لو مفيش)
function syncLevel(eco) {
  const want = levelFromXp(eco.xp ?? 0);
  if (want > (eco.level ?? 1)) {
    const from = eco.level ?? 1;
    eco.level = want;
    return { from, to: want };
  }
  if (want < (eco.level ?? 1)) eco.level = want; // ترضيب لو الداتا اتعملتلها يد
  return null;
}

export function progressInfo(eco) {
  // ⚠️ كان بيقرا eco.level مباشرة — والقيمة القديمة (1) كانت بتفضل ثابتة لأن
  // مفيش سطر كان بيحدّثها، فالكارت بيقول "مستوى 1" طول عمره. دلوقتي بنحسبه
  // من الخبرة وناخد الأكبر من الاتنين.
  const fromXp = levelFromXp(eco.xp ?? 0);
  const level = Math.max(eco.level ?? 1, fromXp);
  const floor = totalXpFor(level);
  const need = xpForLevel(level);
  const into = (eco.xp ?? 0) - floor;
  const pct = Math.max(0, Math.min(100, Math.round((into / need) * 100)));
  const bars = Math.round(pct / 10);
  return {
    level,
    need,
    into,
    floor,
    pct,
    bar: '▰'.repeat(bars) + '▱'.repeat(10 - bars),
  };
}

// ⚡ XP مع كولداون 60 ثانية ضد الفارم
const xpGates = new Map();
const GATE_TTL = 10 * 60 * 1000; // تنظيف دوري عشان الخريطة متكبرش للأبد

function sweepGates() {
  const now = Date.now();
  for (const [k, t] of xpGates) if (now - t > GATE_TTL) xpGates.delete(k);
}
setInterval(sweepGates, GATE_TTL).unref?.();

// ⚠️ كان بيرجّع الرصيد الجديد مش اللي زاد — فحد جديد (رصيده 100) بياخد
// 30 عملة كان البوت يقوله "+130". دلوقتي بيرجّع المبلغ اللي اتضاف فعليًا.
export function awardXp(key, amount = 2) {
  const now = Date.now();
  if (now - (xpGates.get(key) ?? 0) < 60000) return null;
  xpGates.set(key, now);
  const eco = getEco(key);
  eco.xp += amount;
  const up = syncLevel(eco);
  saveEco(key, eco);
  return up;
}

export function addCoins(key, amount) {
  const eco = getEco(key);
  const before = eco.coins;
  eco.coins = Math.max(0, eco.coins + amount);
  const delta = eco.coins - before; // اللي اتضاف فعلًا (بيحترم حد الصفر)
  if (amount > 0) {
    eco.xp += Math.max(1, Math.ceil(amount / 2)); // العملات بتدي خبرة كمان
    syncLevel(eco);
  }
  saveEco(key, eco);
  return delta;
}

// 💸 صرف عملات — بيرجّع true لو نجح. مستخدم في المتجر والرهان
export function spend(key, amount) {
  if (amount <= 0) return true;
  const eco = getEco(key);
  if ((eco.coins ?? 0) < amount) return false;
  eco.coins -= amount;
  saveEco(key, eco);
  return true;
}

// 🏆 مكافآت الألعاب — بتتنادى من أوامر الألعاب
export function grantWin(key, coins = 25) {
  const eco = getEco(key);
  eco.totalWins = (eco.totalWins ?? 0) + 1;
  eco.totalGames = (eco.totalGames ?? 1) + 1;
  saveEco(key, eco);
  addCoins(key, coins);
  return coins;
}

export function grantLoss(key) {
  const eco = getEco(key);
  eco.totalGames = (eco.totalGames ?? 0) + 1;
  saveEco(key, eco);
}

// 📅 المكافأة اليومية مع ستريك متزايد
export function dailyReward(key) {
  const eco = getEco(key);
  const now = Date.now();
  const DAY = 86400000;
  const passed = now - (eco.lastDaily ?? 0);
  if (eco.lastDaily && passed < DAY) {
    const hoursLeft = Math.ceil((DAY - passed) / 3600000);
    return { ok: false, hoursLeft };
  }
  eco.dailyStreak = eco.lastDaily && passed < 2 * DAY ? (eco.dailyStreak ?? 0) + 1 : 1;
  eco.lastDaily = now;
  const reward = 50 + Math.min(eco.dailyStreak, 7) * 25; // 75 → 225
  eco.coins += reward;
  const up = syncLevel(eco);
  saveEco(key, eco);
  return { ok: true, reward, streak: eco.dailyStreak, levelUp: up };
}

// الرتبة العالمية حسب المستوى والخبرة
export function globalRank(key) {
  const all = db.get('economy', {});
  const level = (k) => (k[1] && k[1].level) || levelFromXp(k[1]?.xp ?? 0);
  const sorted = Object.entries(all).sort(
    (a, b) => level(b) - level(a) || (b[1]?.xp ?? 0) - (a[1]?.xp ?? 0),
  );
  const idx = sorted.findIndex(([k]) => k === key);
  return idx === -1 ? null : { rank: idx + 1, total: sorted.length };
}

// أسماء اللاعبين من الذاكرة — للوحة الصدارة
export function nameOf(key, users) {
  return users[key]?.name ?? String(key).split('@')[0];
}

// 🏅 الأوسمة — بتتفتح بالشرط، متتخزَّنة في كائن achievements
export const BADGES = [
  { id: 'first_win', label: 'أول فوز', emoji: '🥇', test: (e) => (e.totalWins ?? 0) >= 1 },
  { id: 'wins10', label: '10 انتصارات', emoji: '🏆', test: (e) => (e.totalWins ?? 0) >= 10 },
  { id: 'wins50', label: 'ملك الألعاب', emoji: '👑', test: (e) => (e.totalWins ?? 0) >= 50 },
  { id: 'rich', label: 'ثري', emoji: '💎', test: (e) => (e.coins ?? 0) >= 1000 },
  { id: 'streak7', label: 'سباق 7 أيام', emoji: '🔥', test: (e) => (e.dailyStreak ?? 0) >= 7 },
  { id: 'level5', label: 'مستوى 5', emoji: '⭐', test: (e) => (e.level ?? 1) >= 5 },
  { id: 'level10', label: 'مستوى 10', emoji: '🌟', test: (e) => (e.level ?? 1) >= 10 },
  { id: 'gamer', label: 'لاعب محترف', emoji: '🎮', test: (e) => (e.totalGames ?? 0) >= 50 },
];

// بيرجّع الأوسمة الجديدة اللي اتفتحت دلوقتي (مرة واحدة بس لكل واحدة)
export function checkBadges(key) {
  const eco = getEco(key);
  const got = db.get('achievements', {})[key] ?? {};
  const fresh = BADGES.filter((b) => !got[b.id] && b.test(eco));
  if (!fresh.length) return [];
  for (const b of fresh) got[b.id] = Date.now();
  const all = db.get('achievements', {});
  all[key] = got;
  db.set('achievements', all);
  return fresh;
}
