import { sendQuickReplies } from '../../core/send.js';
import { getEco, addCoins } from '../../core/economy.js';

// 🎲 .roll — نرد الحظ: جيب 6 وتاخد ×3 رهانك
const MAX_BET = 150;

export default {
  name: 'roll',
  aliases: ['نرد', 'ارمي'],
  description: 'ارمي نرد — جيب 6 وتاخد ×3 رهانك! (أقصى 150)',
  usage: '.roll [مبلغ]',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    const bet = Math.min(MAX_BET, Math.max(10, Number(args[0]) || 20));
    const eco = getEco(key);

    if (eco.coins < bet) {
      return m.reply(`🪙 رصيدك *${eco.coins}* مش كفاية لرهان *${bet}* — خد \`.daily\` الأول`);
    }

    const dice = 1 + Math.floor(Math.random() * 6);
    const diceEmoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][dice - 1];
    let win = 0;
    if (dice === 6) win = bet * 3;
    else if (dice >= 4) win = Math.ceil(bet * 0.5);

    const balance = addCoins(key, win - bet);

    return sendQuickReplies(sock, m.jid, {
      title: `🎲 ${diceEmoji} طلع *${dice}*!`,
      text: [
        dice === 6 ? '🎉 سدس! خدت *×3* رهانك!' : dice >= 4 ? '😌 نص حظك رجع' : '💀 حظ أوظى المرة الجاية',
        '',
        `💰 رهان: ${bet} • ربح: ${win}`,
        `🪙 رصيدك: *${balance}*`,
      ].join('\n'),
      buttons: [
        { label: `🎲 ارمي تاني (${bet})`, id: `.roll ${bet}` },
        { label: '🎰 جرب الماكينة', id: '.slot' },
      ],
    });
  },
};
