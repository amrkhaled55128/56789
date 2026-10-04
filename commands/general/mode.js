import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';

// 🎭 .mode — شخصية نوفا القابلة للتبديل (محفوظة لكل شات)
const MODES_UI = [
  { key: 'normal', label: '⚡ نوفا العادي', desc: 'شخصية نوفا الأصلية — حنون ومزح ومسؤول' },
  { key: 'roman', label: '💘 رومانسي', desc: 'غزل وجمال وحنان في كل رد' },
  { key: 'funny', label: '😜 هزوش', desc: 'نكتة في كل رد، خفيف الدم' },
  { key: 'serious', label: '📚 جاد', desc: 'معلومات وذكاء من غير هزر' },
  { key: 'quiet', label: '🤫 صامت', desc: 'مايتكلمش غير لما تناديه — وردوده قصيرة' },
];

export default {
  name: 'mode',
  aliases: ['نمط', 'شخصية'],
  description: 'غيّر شخصية نوفا في الشات ده — رومانسي، هزوش، جاد، صامت',
  usage: '.mode  أو  .mode roman',
  async execute(sock, m, args) {
    const arg = (args[0] ?? '').toLowerCase();
    const modes = db.get('modes', {});

    if (MODES_UI.some((x) => x.key === arg)) {
      modes[m.jid] = arg;
      db.set('modes', modes);
      const chosen = MODES_UI.find((x) => x.key === arg);
      return m.reply(`✅ الشخصية اتغيرت: ${chosen.label}\n${chosen.desc}`);
    }

    const current = modes[m.jid] ?? 'normal';
    const cur = MODES_UI.find((x) => x.key === current);
    return sendQuickReplies(sock, m.jid, {
      title: `🎭 شخصية نوفا هنا: ${cur?.label ?? '⚡ العادي'}`,
      text: cur?.desc + '\n\nاختار الشخصية اللي تعجبك 👇',
      buttons: MODES_UI.map((x) => ({
        label: x.key === current ? `✅ ${x.label}` : x.label,
        id: `.mode ${x.key}`,
      })),
    });
  },
};
