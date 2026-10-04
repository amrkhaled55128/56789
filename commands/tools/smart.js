import { sendQuickReplies } from '../../core/send.js';
import api from '../../core/api.js';

// 🧠 أدوات ذكية — تلخيص / تصحيح / شرح / تحليل
export default {
  name: 'smart',
  aliases: ['ذكي', 'ادوات-ai'],
  description: 'أدوات ذكية: تلخيص، تصحيح إملائي، شرح مبسط، تحليل مشاعر',
  usage: '.smart  أو  .smart sum النص',
  async execute(sock, m, args) {
    const sub = (args[0] ?? '').toLowerCase();
    const text = args.slice(1).join(' ').trim();

    const TOOLS = {
      sum: (t) => `لخّص ده في 3 نقاط واضحة بالعربي:\n\n${t}`,
      fix: (t) => `صحّح الإملاء والنحو في النص ده وارجّعه مكتوب صح بالعربي من غير ما تغيّر المعنى:\n\n${t}`,
      explain: (t) => `اشرحلي ده ببساطة كأني بسمعه لأول مرة، في 5 أسطر بالعربي:\n\n${t}`,
      mood: (t) => `حلّل المشاعر والإحساس في الكلام ده، وارجّع: المشاعر الأساسية (من 10) + نوع الشعور + سبب التقييم:\n\n${t}`,
    };

    if (!sub) {
      return sendQuickReplies(sock, m.jid, {
        title: '🧠 أدوات نوفا الذكية',
        text: 'اختار الأد اللي عايزها وابعت الكلام اللي بعدها 👇',
        buttons: [
          { label: '📝 تلخيص', id: '.smart sum ' },
          { label: '✍️ تصحيح إملائي', id: '.smart fix ' },
          { label: '📖 شرح مبسط', id: '.smart explain ' },
          { label: '💭 تحليل مشاعر', id: '.smart mood ' },
        ],
      });
    }

    const fn = TOOLS[sub];
    if (!fn) return m.reply(`❓ مفيش أداة اسمها "${sub}" — الأدوات: sum, fix, explain, mood`);

    const target = text || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
    if (!target) return m.reply(`📌 اكتب الكلام بعد الأداة، مثال: \`.smart ${sub} النص هنا\``);

    const result = await api.gpt(fn(target.slice(0, 3000)));
    return m.reply(`🧠 *${sub === 'sum' ? 'التلخيص' : sub === 'fix' ? 'التصحيح' : sub === 'explain' ? 'الشرح' : 'تحليل المشاعر'}*\n\n${result}`);
  },
};
