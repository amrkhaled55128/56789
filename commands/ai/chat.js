import { sendQuickReplies, sendText, sendVoice, sendImage } from '../../core/send.js';
import { chatWithAI, cleanForVoice } from '../../core/ai.js';
import { rememberMessage } from '../../core/memory.js';
import { db } from '../../core/db.js';
import { speak } from '../../core/tts.js';
import api from '../../core/api.js';
import { config } from '../../config.js';

const SUGGESTIONS = [
  { label: '🎧 قولها بصوت', id: '.ai voice' },
];

// ⚠️ الحالة كانت متخزّنة بالشات (m.jid) — في جروب، أي حد يضغط
// "قولها بصوت" بيبعت إجابة حد تاني/group كامل، و"زوّدني" بيرد على
// ذاكرة شخص مش هو. دلوقتي كل مستخدم ليه حالته في كل شات.
function stateKey(m) {
  return `${m.jid}::${m.identityKey ?? m.sender}`;
}

function getState(m) {
  return db.get('aiState', {})[stateKey(m)] ?? {};
}

function saveState(m, state) {
  const all = db.get('aiState', {});
  const key = stateKey(m);
  // ⚠️ `by` كان مكتوب بعد الـ spread فبيسحق `by` اللي حد تاني حطّه
  all[key] = { ...all[key], ...state, by: state.by ?? all[key]?.by ?? null, at: Date.now() };
  db.set('aiState', all);
}

export default {
  name: 'ai',
  aliases: ['نوفا', 'اسال', 'اسأل', 'اسأل_الذكاء'],
  description: 'اسأل نوفا أي حاجة — أو استخدم أزرار المتابعة (كمان/صوت/صورة)',
  usage: '.ai سؤالك  أو  .ai more|voice|image',
  async execute(sock, m, args) {
    const sub = (args[0] ?? '').toLowerCase();
    const state = getState(m);

    // 🎧 تكرار آخر رد بصوت استرو (غوكو افتراضيًا مع احتياطي فارس)
    if (sub === 'voice') {
      if (!state.lastReply) return m.reply('مفيش رد لسه — اسألني الأول بـ `.ai سؤالك`');
      await m.reply('🎙️ ثواني بتسجّلها...');
      return speak(sock, m.jid, cleanForVoice(state.lastReply));
    }

    // 🖼️ تحويل آخر سؤال لصورة
    if (sub === 'image') {
      if (!state.lastPrompt) return m.reply('مفيش سؤال لسه — اكتب `.image وصف الصورة` على طول');
      await m.reply('🎨 بجهز الصورة... استنى شوية');
      const url = await api.image(state.lastPrompt);
      if (!url) throw new Error('فشل التوليد');
      return sendImage(sock, m.jid, url, `🖼️ ${state.lastPrompt}`);
    }

    // 🔄 زوّد كلام عن آخر موضوع
    if (sub === 'more') {
      if (!state.lastPrompt) return m.reply('مفيش موضوع لسه — اسألني الأول بـ `.ai سؤالك`');
      return ask(sock, m, `زوّدني بمعلومات أكتر عن: ${state.lastPrompt}`, state.by);
    }

    // 💬 سؤال جديد
    const question = args.join(' ').trim();
    if (!question) {
      return sendQuickReplies(sock, m.jid, {
        title: '🧠 أنا نوفا — اسألني أي حاجة',
        text: 'اكتب سؤالك كده: `.ai إيه أحسن أكل مصري؟`\n\nوفي الخاص تقدر تكلممني من غير أوامر خالص، وأنا فاكر كل حاجة قلتها لي 🫡',
        buttons: [
          { label: '😄 هزل معايا', id: '.simsimi ازيك' },
          { label: '🖼️ صورة بالذكاء', id: '.ai image-help' },
        ],
      });
    }
    if (sub === 'image-help') return m.reply('اكتب: `.image قطة فضائية` — وهعملها بالذكاء الاصطناعي');
    return ask(sock, m, question, m.sender);
  },
};

async function ask(sock, m, question, sender) {
  const key = sender ?? m.identityKey ?? m.sender ?? m.jid;
  saveState(m, { lastPrompt: question, by: key });
  rememberMessage(key, 'user', question);

  const { reply } = await chatWithAI({
    text: question,
    key,
    pushName: m.pushName,
  });
  rememberMessage(key, 'bot', reply);
  saveState(m, { lastReply: reply });

  await sendQuickReplies(sock, m.jid, { text: reply, buttons: SUGGESTIONS });
}
