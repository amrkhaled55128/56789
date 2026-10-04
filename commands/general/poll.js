import { sendPoll } from '../../core/send.js';

// 📊 .poll — استطلاع رأي حقيقي
export default {
  name: 'poll',
  aliases: ['تصويت', 'استطلاع'],
  description: 'اعمل استطلاع — .poll السؤال | خيار1 | خيار2 | خيار3',
  usage: '.poll أحسن أكلة؟ | كشري | محشي | ملوخية',
  async execute(sock, m, args) {
    const raw = args.join(' ');
    const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);

    if (parts.length < 3) {
      return m.reply('📊 اكتب السؤال والخيارات مفصولين بـ |:\n`.poll أحسن أكلة؟ | كشري | محشي | ملوخية`');
    }

    const [question, ...options] = parts;
    if (options.length > 12) return m.reply('🔒 أقصى 12 خيار');

    return sendPoll(sock, m.jid, { name: question, values: options, selectableCount: 1 });
  },
};
