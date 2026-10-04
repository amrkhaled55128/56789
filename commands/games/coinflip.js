import { sendQuickReplies } from '../../core/send.js';
import { getEco, addCoins } from '../../core/economy.js';

// 🪙 .coinflip — قرش ع Heads/Tails مع رهان
// (من أكتر الأوامرpresence في كل بوت عربي — Was missing)
const SIDES = ['صورة', 'كتابة', 'وجه', 'ظهر'];

export default {
  name: 'coinflip',
  aliases: ['قرش', 'عملة', 'كoin'],
  description: 'اقلب قرش — .coinflip heads 50 (رهان)',
  usage: '.coinflip  أو  .coinflip heads 50',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    const pick = (args[0] ?? '').toLowerCase();
    const bet = Number(args[1]);

    // 🎲 رهان
    if (Number.isFinite(bet) && bet > 0) {
      if (bet < 5) return m.reply('📉 أقل رهان 5 عملات');
      if (bet > 500) return m.reply('📈 أقصى رهان 500 عملة');
      const eco = getEco(key);
      if (eco.coins < bet) return m.reply(`🪙 رصيدك *${eco.coins}* مش كفاية للرهان ده`);

      if (!pick) {
        return sendQuickReplies(sock, m.jid, {
          title: `🪙 رهان ${bet} عملة`,
          text: 'اختار وش هتقع؟ 👇',
          buttons: [
            { label: '🪙 صورة', id: `.coinflip heads ${bet}` },
            { label: '✍️ كتابة', id: `.coinflip tails ${bet}` },
          ],
        });
      }

      const wantHeads = /^(heads?|صورة|وش|ش heads)$/i.test(pick) ? true : /^(tails?|كتابة|ظهر|push)$/i.test(pick) ? false : null;
      if (wantHeads === null) return m.reply('اكتب `heads` أو `tails` — أو دوس الزر 👇');

      const got = Math.random() < 0.5;
      const won = got === wantHeads;
      const delta = addCoins(key, won ? bet : -bet);
      const side = got ? SIDES[0] : SIDES[1];

      return sendQuickReplies(sock, m.jid, {
        title: won ? '🎉 ربحت! 🪙' : '😔 خسرت',
        text:
          `🪙 القرش وقع: *${side}*\n` +
          `اخترت: *${wantHeads ? 'صورة' : 'كتابة'}*\n\n` +
          `💰 ${won ? '+' : ''}${delta} عملة • رصيدك: ${getEco(key).coins}`,
        buttons: [
          { label: '🔄 ارهن تاني', id: `.coinflip heads ${bet}` },
          { label: '🛑 قف', id: '.coinflip' },
        ],
      });
    }

    // 🎲 من غير رهان
    const got = Math.random() < 0.5;
    return sendQuickReplies(sock, m.jid, {
      title: `🪙 ${got ? SIDES[0] : SIDES[1]}!`,
      text: `القرش وقع *${got ? 'صورة 🪙' : 'كتابة ✍️'}*`,
      buttons: [
        { label: '🪙 على صورة', id: '.coinflip heads' },
        { label: '✍️ على كتابة', id: '.coinflip tails' },
      ],
    });
  },
};
