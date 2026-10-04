// 📊 عدادات نوفا الحية — بتغذي الداشبورد (localhost:3000)

const stats = {
  startedAt: Date.now(),
  messages: 0,
  commands: 0,
  aiReplies: 0,
  voices: 0,
  stickers: 0,
  downloads: 0,
  apiStatus: 'ok',
  lastCommands: [], // آخر 12 أمر
};

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
}

// ⚠️ الدالة دي كانت معرّفة ومش متنادى من أي مكان — فالداشبورد بيقول
// "🟢 حالة API: شغال" حتى وهو في وضع آمن فعلاً (وهي بالظبط اللحظة اللي
// المالك محتاج يشوفها). دلوقتي api.js بيناديها مع كل تغيّر.
export function setApiStatus(status, openCount = 0) {
  stats.apiStatus = status;
  stats.apiDown = openCount;
}

// 📊 عدادات الأخطاء حسب الأمر — عشان `.stats` says إيه اللي بيفشل
export function recordCommandError(name) {
  if (!name) return;
  stats.commandErrors = stats.commandErrors ?? {};
  stats.commandErrors[name] = (stats.commandErrors[name] ?? 0) + 1;
}

export function setConnected(value) {
  stats.connected = !!value;
}

export function snapshot() {
  return { ...stats, uptime: Date.now() - stats.startedAt };
}

export async function fullSnapshot() {
  const groups = groupsProvider ? await groupsProvider().catch(() => []) : [];
  return { ...snapshot(), groups };
}
