// 📊 عدادات استرو الحية — بتغذي الداشبورد
import { db } from './db.js';

// ⚖️ العدادات دي بتتخزن في db.json كل شوية — عشان الريستارت ما يصفرّش
// إحصائيات المالك (كانت بترجع صفر مع كل إعادة نشر على Railway)
const PERSIST_KINDS = ['messages', 'commands', 'aiReplies', 'voices', 'stickers', 'downloads', 'sendFailures'];

const stats = {
  startedAt: Date.now(),
  messages: 0,
  commands: 0,
  aiReplies: 0,
  voices: 0,
  stickers: 0,
  downloads: 0,
  sendFailures: 0,
  apiStatus: 'ok',
  lastCommands: [], // آخر 12 أمر
};

// بنكمّل من آخر حفظ — الإجماليات التراكمية مش بتضيع
const saved = db.get('statsCounters', {});
for (const k of PERSIST_KINDS) {
  if (Number.isFinite(saved[k])) stats[k] += Number(saved[k]);
}
if (saved.commandErrors && typeof saved.commandErrors === 'object') {
  stats.commandErrors = { ...(saved.commandErrors ?? {}) };
}

let persistTimer = null;
function persistCounters() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const out = {};
      for (const k of PERSIST_KINDS) out[k] = stats[k] ?? 0;
      if (stats.commandErrors) out.commandErrors = stats.commandErrors;
      db.set('statsCounters', out);
    } catch {
      // الإحصائيات رفاهية — فشل الحفظ ميبوظش البوت
    }
  }, 5000);
}

let groupsProvider = null;

export function setGroupsProvider(fn) {
  groupsProvider = fn;
}

export function bump(kind, detail) {
  stats[kind] = (stats[kind] ?? 0) + 1;
  if (kind === 'commands' && detail) {
    stats.lastCommands.unshift(detail);
    stats.lastCommands = stats.lastCommands.slice(0, 12);
  }
  // العدادات التراكمية بتنزل للـ db بشكل متباعد — مش كل bump
  if (PERSIST_KINDS.includes(kind)) persistCounters();
}

// ⚠️ الدالة دي كانت معرّفة ومش متنادى من أي مكان — فالداشبورد بيقول
// "🟢 حالة API: شغال" حتى وهو في وضع آمن فعلاً (وهي بالظبط اللحظة اللي
// المالك محتاج يشوفها). دلوقتي api.js بيناديها مع كل تغيّر.
export function setApiStatus(status, openCount = 0) {
  stats.apiStatus = status;
  stats.apiDown = openCount;
}

// 📊 عدادات الأخطاء حسب الأمر — عشان `.reload` يقول للمالك إيه اللي بيفشل
export function recordCommandError(name) {
  if (!name) return;
  stats.commandErrors = stats.commandErrors ?? {};
  stats.commandErrors[name] = (stats.commandErrors[name] ?? 0) + 1;
  persistCounters();
}

export function setConnected(value) {
  stats.connected = !!value;
}

export function snapshot() {
  return { ...stats, uptime: Date.now() - stats.startedAt };
}

export async function fullSnapshot() {
  const groups = groupsProvider
    ? await Promise.race([
        groupsProvider().catch(() => []),
        new Promise((res) => setTimeout(() => res([]), 500)),
      ])
    : [];
  return { ...snapshot(), groups };
}
