import { getEco, addCoins, saveEco } from '../../core/economy.js';
import { db } from '../../core/db.js';
import { resolveKey } from '../../core/identity.js';

// 💸 .تحويل — حوّل عملات لصاحبك
export default {
  name: 'تحويل',
  aliases: ['تحويل-عملات', 'اعطي'],
  description: 'حوّل عملات لصاحبك — منشنه واكتب المبلغ: .تحويل @شخص 100',
  usage: '.تحويل @شخص 100',
  async execute(sock, m, args) {
    const amount = Number(args.find((a) => /^\d+$/.test(a)));
    const info = m.message?.extendedTextMessage?.contextInfo;

    // ⚠️ كان بيقرأ contextInfo.participant بس — وده موجود بس لما ترد على حد.
    // الصيغة المكتوبة في الـ usage (منشن) كانت بتطبع "اكتب المبلغ" دايمًا.
    // دلوقتي: منشن ← رد ← رقم في النص
    const raw = info?.mentionedJid?.[0] ?? info?.participant ?? null;
    if (!raw || !amount) {
      return m.reply(
        'اكتب المبلغ ومنشن صاحبك:\n`.تحويل @شخص 100`\n(أو رد على رسالته واكتب المبلغ)',
      );
    }
    if (amount < 10) return m.reply('📉 أقل تحويل هو *10 عملات*');
    if (amount > 5000) return m.reply('📈 أقصى تحويل في العملية الواحدة *5000*');

    const fromKey = m.identityKey ?? m.sender;
    // ⚠️ كان بيخزّن المستلم بالـ JID الخام والباقي كله بمفاتيح الهوية
    // → المستلم بيبقى ليه رصيدين منفصلين. دلوقتي كله على مفتاح واحد.
    const toKey = resolveKey(raw) ?? raw;

    if (fromKey === toKey) return m.reply('😂 هتحول لنفسك؟! فكرة حلوة بس لأ 😄');

    // جهّز حساب المرسل والمستلم قبل الخصم. getEco ممكن يرجع default غير محفوظ؛
    // نحفظه أولاً حتى لا ننجح في فحص الرصيد ثم ننهار عند senderEco.coins.
    const senderEco = getEco(fromKey);
    if (!db.get('economy', {})[fromKey]) saveEco(fromKey, senderEco);
    const balance = senderEco.coins ?? 0;
    if (balance < amount) {
      return m.reply(`🪙 رصيدك *${balance}* مش كفاية للتحويل ده`);
    }

    senderEco.coins = balance - amount;
    saveEco(fromKey, senderEco);
    addCoins(toKey, amount);
    const receiver = db.get('economy', {})[toKey]?.coins ?? amount;

    const toJid = String(raw).replace('@lid', '@s.whatsapp.net');
    await sock.sendMessage(m.jid, {
      text:
        `💸 *تحويل ناجح!*\n\n${m.pushName} حوّل *${amount}* عملة لـ @${String(raw).split('@')[0]}\n\n` +
        `💰 رصيدك: ${senderEco.coins}\n💰 رصيده: ${receiver}`,
      mentions: [toJid],
    });
  },
};
