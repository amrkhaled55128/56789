import { isAdmin } from './protection.js';
import { isOwner } from '../lib/utils.js';
import { config } from '../config.js';

// 🛠️ أدوات مشتركة لأوامر الجروبات — عشان كل أمر ما يكرّرش منطق الـ guard

// الأدمن بس (أو المالك). بترجّع الرسالة اللي اتبعتت لو الرفض نجح.
export async function requireAdmin(sock, m, what = 'الأمر ده') {
  if (!m.isGroup) {
    m.reply('الأمر ده في الجروبات بس 👥');
    return true;
  }
  if (isOwner(m, config)) return false;
  if (await isAdmin(sock, m.jid, m.sender)) return false;
  m.reply(`🔐 ${what} للأدمن بس`);
  return true;
}

// جيب الشخص المستهدف: منشن أو رد على رسالته
export function targetOf(m) {
  const info = m.message?.extendedTextMessage?.contextInfo;
  return info?.mentionedJid?.[0] ?? info?.participant ?? null;
}

// 🔢 رقم الجاي بعد الأمر (بينفع للأعدادات: `.antiflood 5 10`)
export function numbersFrom(args) {
  return args.map((a) => Number(a)).filter((n) => Number.isFinite(n) && n > 0);
}

export function mentionOf(jid) {
  return '@' + String(jid).split('@')[0];
}

// 📋 قائمة أعضاء الجروب (بفلترة مخفّفين)
export async function listParticipants(sock, jid) {
  const meta = await sock.groupMetadata(jid).catch(() => null);
  if (!meta) return null;
  return (meta.participants ?? []).map((p) => ({
    jid: p.id,
    admin: p.admin ?? null,
    name: p.name ?? String(p.id).split('@')[0],
  }));
}
