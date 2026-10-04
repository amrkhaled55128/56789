import { sendText } from '../../core/send.js';
import { isOwner } from '../../lib/utils.js';
import { db } from '../../core/db.js';
import { config } from '../../config.js';

// 🔛 .boton / .botoff — تشغيل وقفل البوت في شات معين (للمالك والأدمن)
function toggle(sock, m, off) {
  const all = db.get('botOff', {});
  if (off) all[m.jid] = true;
  else delete all[m.jid];
  db.set('botOff', all);
  return sendText(sock, m.jid, off ? '😴 البوت اتقفل هنا — للمالك بس يفتحه' : '⚡ البوت اشتغل تاني هنا!');
}

export default {
  name: 'botoff',
  aliases: ['اقفلبوت'],
  description: 'قفل البوت في الشات الحالي (للمالك/الأدمن)',
  usage: '.botoff',
  async execute(sock, m) {
    if (!isOwner(m, config) && !(await isAdminSafe(sock, m))) return m.reply('🔐 للأدمن أو المالك');
    return toggle(sock, m, true);
  },
};

async function isAdminSafe(sock, m) {
  if (!m.isGroup) return false;
  try {
    const { isAdmin } = await import('../../core/protection.js');
    return await isAdmin(sock, m.jid, m.sender);
  } catch {
    return false;
  }
}
