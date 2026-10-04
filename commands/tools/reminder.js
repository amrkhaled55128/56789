import { sendQuickReplies } from '../../core/send.js';
import { addJob, parseEgyptianDuration, listJobs, removeJob } from '../../core/scheduler.js';
import { db } from '../../core/db.js';

// ⏰ .ذكرني — تذكيرات محفوظة بتتنفذ في وقتها حتى لو البوت اتقفل وفتح
// .ذكرني <النص> [بعد كذا]      أنشئ
// .ذكرني list                    شوف تذكيراتك (بتاعتك إنت بس)
// .ذكرني cancel رقم            امسح واحد
// .ذكرني clear                   امسح الكل
export default {
  name: 'ذكرني',
  aliases: ['reminder', 'فكرني', 'التذكير', 'تذكير'],
  description: 'تذكير بمهمة — .ذكرني اقرأ الدرس بعد ساعة',
  usage: '.ذكرني النص [بعد 5 دقايق / بعد ساعتين / بعد يوم]',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;

    // 📋 القايمة — بتاعتك إنت بس (كان countJobs عام فكنت بتشوف ناس تانية)
    if (!args.length || (args[0] ?? '').toLowerCase() === 'list') {
      const mine = listJobs('reminder').filter((j) => (j.meta?.who ?? j.meta?.by) === key);
      if (!mine.length) {
        return sendQuickReplies(sock, m.jid, {
          title: '⏰ تذكيراتك',
          text: 'مفيش تذكيرات محفوظة.\n\nاكتب: `.ذكرني اقرأ الدرس بعد ساعة`',
        });
      }
      const fmt = (t) =>
        new Date(t).toLocaleString('ar-EG', {
          timeZone: 'Africa/Cairo',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      const rows = mine
        .sort((a, b) => a.at - b.at)
        .slice(0, 20)
        .map((j, i) => `${i + 1}. ⏰ ${fmt(j.at)}\n   📝 ${String(j.meta?.text ?? '').slice(0, 50)}`)
        .join('\n');

      return sendQuickReplies(sock, m.jid, {
        title: `⏰ تذكيراتك (${mine.length})`,
        text: `${rows}\n\n🗑️ تمسح: \`.ذكرني cancel رقم\``,
        buttons: [
          { label: '🗑️ امسح الكل', id: '.ذكرني clear' },
          { label: '⏰ تذكير جديد', id: '.menu tools' },
        ],
      });
    }

    const sub = (args[0] ?? '').toLowerCase();

    // 🗑️ إلغاء واحد
    if (sub === 'cancel' || sub === 'del' || sub === 'امسح') {
      const idx = Number(args[1]) - 1;
      const mine = listJobs('reminder')
        .filter((j) => (j.meta?.who ?? j.meta?.by) === key)
        .sort((a, b) => a.at - b.at);
      if (!Number.isFinite(idx) || idx < 0 || idx >= mine.length) {
        return m.reply(`❌ رقم غلط — اكتب \`.ذكرني list\` وشوف الأرقام (1-${mine.length})`);
      }
      const job = mine[idx];
      removeJob(job.id);
      return m.reply(`🗑️ اتمسح التذكير: *${String(job.meta?.text ?? '').slice(0, 60)}*`);
    }

    // 🧹 مسح الكل
    if (sub === 'clear' || sub === 'all') {
      const mine = listJobs('reminder').filter((j) => (j.meta?.who ?? j.meta?.by) === key);
      for (const j of mine) removeJob(j.id);
      return m.reply(mine.length ? `🗑️ اتمسحت ${mine.length} تذكير` : 'مفيش تذكيرات نمسحها 🤷');
    }

    const full = args.join(' ').trim();
    if (!full) {
      return sendQuickReplies(sock, m.jid, {
        title: '⏰ التذكيرات',
        text: [
          'اكتب: `.ذكرني اقرأ الدرس بعد ساعة`',
          '',
          '⏱️ الصيغ المدعومة: بعد X دقيقة • بعد X ساعة • بعد يوم • بعد نص ساعة',
          '📋 شوف تذكيراتك: `.ذكرني list`',
        ].join('\n'),
      });
    }

    // الوقت في آخر الكلام: "بعد ..."
    const afterIdx = full.lastIndexOf('بعد');
    let text = full;
    let duration = null;

    if (afterIdx >= 0) {
      const tail = full.slice(afterIdx);
      duration = parseEgyptianDuration(tail);
      if (duration) text = full.slice(0, afterIdx).trim();
    }
    if (!duration) {
      // من غير وقت → ساعة افتراضية
      duration = { minutes: 60, at: Date.now() + 3600000, label: 'ساعة' };
    }

    addJob('reminder', m.jid, duration.at, {
      text: text.slice(0, 200),
      who: key,
      whoName: m.pushName,
    });

    const time = new Date(duration.at);
    const hh = time.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });

    return m.reply(
      `⏰ تمام يا ${m.pushName}! هفكرك بعد *${duration.label}* (${hh})\n` +
        `📝 التذكير: *${text.slice(0, 100)}*\n\n` +
        '☑️ محفوظ — حتى لو البوت اتقفل وفتح هيفكرك ✅\n' +
        '🗑️ عايز تلغيه؟ `.ذكرني cancel`',
    );
  },
};
