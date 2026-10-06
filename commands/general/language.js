import { sendQuickReplies, sendText } from '../../core/send.js';
import { getProfile, setLanguage } from '../../core/memory.js';

// 🔤 .لغتي — تحديد أسلوب ولغة التخاطب مع استرو
const LANGS = {
  مصري: { id: 'egyptian', label: '🇪🇬 عامية مصرية (الافتراضي)', reply: 'يا مرحب يا معلم! من هنا ورايح كلامنا مصري بلدي من القهوة والشارع 🇪🇬☕' },
  فصحى: { id: 'msa', label: '📖 لغة عربية فصحى', reply: 'أهلاً بك! تم ضبط أسلوب المحادثة على اللغة العربية الفصحى المبسطة والأنيقة 📜✨' },
  english: { id: 'english', label: '🇬🇧 English Language', reply: "Got it! I will now speak with you in English with friendly warmth. Let's chat! 🇬🇧✨" },
  انجليزي: { id: 'english', label: '🇬🇧 English Language', reply: "Got it! I will now speak with you in English with friendly warmth. Let's chat! 🇬🇧✨" },
  فرانكو: { id: 'franco', label: '📱 فرانكو (Franco-Arab)', reply: 'Tamam ya basha! Keda hanetkallem Franco 3ady gdn, ay khedma! 📱🔥' },
  franco: { id: 'franco', label: '📱 فرانكو (Franco-Arab)', reply: 'Tamam ya basha! Keda hanetkallem Franco 3ady gdn, ay khedma! 📱🔥' },
};

export default {
  name: 'لغتي',
  aliases: ['اللغة', 'اللهجة', 'الاسلوب', 'language'],
  description: 'تحديد أسلوب ولغة التخاطب مع استرو (مصري / فصحى / English / فرانكو)',
  usage: '.لغتي  أو  .لغتي مصري / فصحى / english / فرانكو',
  async execute(sock, m, args, ctx) {
    const key = m.identityKey ?? m.sender;
    const profile = getProfile(key);
    const target = (args[0] ?? '').toLowerCase().trim();

    if (!target || !LANGS[target]) {
      const current = profile.lang ?? 'egyptian';
      const currentLabel = Object.values(LANGS).find((l) => l.id === current)?.label ?? '🇪🇬 عامية مصرية';

      return sendQuickReplies(sock, m.jid, {
        title: '🔤 اختيار لغة وأسلوب استرو',
        text: `أسلوبك الحالي هو: *${currentLabel}*\n\nاختار اللغة أو اللهجة اللي تحب استرو يكلمك بيها 👇`,
        buttons: [
          { label: '🇪🇬 عامية مصرية', id: '.لغتي مصري' },
          { label: '📖 عربية فصحى', id: '.لغتي فصحى' },
          { label: '🇬🇧 English', id: '.لغتي english' },
        ],
      });
    }

    const chosen = LANGS[target];
    setLanguage(key, chosen.id);

    return sendQuickReplies(sock, m.jid, {
      title: '🔤 تم تغيير لغة التخاطب',
      text: chosen.reply,
      buttons: [
        { label: '🤖 جرب كلم استرو', id: '.ai ازيك' },
        { label: '🔤 اللغات', id: '.لغتي' },
      ],
    });
  },
};
