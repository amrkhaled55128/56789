import api from '../../core/api.js';

// 📱 .checknum — اشحن الرقم واعرف بلديته ونوعه
// (api.checkNum كان مكتوب وشغال ومفيش ولا أمر بيستدعيه)
export default {
  name: 'checknum',
  aliases: ['فحص_رقم', 'الرقم', 'معرف_الرقم'],
  description: 'فحص رقم تليفون — بلديته ونوعه (بالعربي)',
  usage: '.checknum 01012345678',
  async execute(sock, m, args) {
    const raw = args.join('').replace(/\D/g, '');
    if (!raw) return m.reply('اكتب الرقم: `.checknum 01012345678`');
    if (raw.length < 8) return m.reply('📏 الرقم قصير — اتأكد منه');

    // مصر: نضيف 20 لو المستخدم كتب 01 أو ناقص
    let num = raw;
    if (num.startsWith('0')) num = `20${num.slice(1)}`;
    else if (num.length === 10 && num.startsWith('2')) num = `2${num}`;

    const res = await api.checkNum(num);
    if (!res || typeof res !== 'object' || !Object.keys(res).length) {
      return m.reply('🤔 مفيش نتيجة للرقم ده — اتأكد إنه صح');
    }

    const lines = Object.entries(res)
      .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !k.startsWith('_'))
      .slice(0, 12)
      .map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : v}`);

    return m.reply(lines.length ? `📱 *الرقم ${num}*\n\n${lines.join('\n')}` : '🤔 مفيش بيانات');
  },
};
