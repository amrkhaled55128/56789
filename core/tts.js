import api from './api.js';
import { sendVoice } from './send.js';
import { config } from '../config.js';

// 🎙️ طبقة الصوت — رسالة صوتية بصوت استرو (غوكو افتراضيًا، فارس احتياط)
export async function speak(sock, jid, text, { voice = null, dialect = 'fusha' } = {}) {
  const clean = String(text).trim().slice(0, 300);
  if (!clean) throw new Error('مفيش كلام');

  // 🐉 غوكو افتراضيًا، ولو فشل → فارس (12) احتياط
  const requested = voice ?? config.ttsVoice ?? 'غوكو';
  const isGoku = requested === 'goku' || requested === 'غوكو';

  if (isGoku) {
    try {
      const url = await api.animeTts(clean, 'غوكو');
      if (url) return sendVoice(sock, jid, url);
    } catch {
      // نكمل بالفارس
    }
  }

  const fallbackVoice = isGoku ? '12' : requested;
  const url = await api.tts(clean, { voice: fallbackVoice, dialect });
  if (!url) throw new Error('مفيش رابط صوت');
  return sendVoice(sock, jid, url);
}

export async function speakAs(sock, jid, text, character = 'غوكو') {
  const url = await api.animeTts(String(text).trim().slice(0, 300), character);
  if (!url) throw new Error('مفيش رابط صوت');
  return sendVoice(sock, jid, url);
}

// أصوات الشخصيات الكرتونية المتاحة فعليًا في الـ API
export const CHARACTERS = ['غوكو', 'ميسي', 'ايمينيم'];

// أصوات TTS المتاحة (عشان تختارها بـ .say)
export const VOICES = {
  فارس: '12',
  ماجد: '1',
  تركي: '2',
  يوسف: '3',
  جيك: '4',
  عبدالعزيز: '5',
  عبدالرحمن_حمدي: '6',
  أروى: '7',
  سالم: '8',
  أحمد: '9',
  عبدالله: '10',
  سلطان: '11',
};
