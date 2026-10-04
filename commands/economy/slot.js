import { sendQuickReplies } from '../../core/send.js';
import { getEco, addCoins } from '../../core/economy.js';

// 🎰 .slot — آلة الحظ بالعملات
// الرموز: 🍒 🍋 🔔 ⭐ 💎 — تلات متشابهين = جايزة
const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎'];
const PAYOUT = { '💎💎💎': 10, '⭐⭐⭐': 7, '🔔🔔🔔': 5, '🍒🍒🍒': 5, '🍋🍋🍋': 5 };
const MAX_BET = 200;

function spin() {
  return [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

export default {
  name: 'slot',
  aliases: ['حظ', 'ماكينة'],
  description: 'آلة الحظ — راهن بعملاتك ولفّ! 🎰 (أقصى رهان 200)',
  usage: '.slot [مبلغ الرهان]',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    const bet = Math.min(MAX_BET, Math.max(10, Number(args[0]) || 20));
    const eco = getEco(key);

    if (eco.coins < bet) {
      return m.reply(`🪙 رصيدك *${eco.coins}* مش كفاية لرهان *${bet}*!\nخد \`.daily\` أو اكسب من الألعاب 🎮`);
    }

    const result = spin();
    const combo = result.join('');
    let win = 0;
    if (result[0] === result[1] && result[1] === result[2]) {
      win = bet * (PAYOUT[combo] ?? 5);
    } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
      win = Math.ceil(bet * 0.5);
    }

    const balance = addCoins(key, win - bet);
    const title = win > bet ? `🎉 كسبت *${win}* عملة!` : win === bet ? '🤝 رجع رهانك تقريبًا!' : win > 0 ? '😅 خدت نص حظك' : '💀 خسرت الرهان!';

    return sendQuickReplies(sock, m.jid, {
      title: `🎰 ${result.join(' ')} — ${title}`,
      text: [
        `💰 رهانك: ${bet} • ربحك: ${win}`,
        `🪙 رصيدك دلوقتي: *${balance}*`,
        ``,
        `💎💎💎 = ×10 رهانك!`,
      ].join('\n'),
      buttons: [
        { label: `🔄 لفة تانية (${bet})`, id: `.slot ${bet}` },
        { label: '⬆️ ضاعف الرهان', id: `.slot ${Math.min(MAX_BET, bet * 2)}` },
        { label: '🪪 رصيدي', id: '.mystats' },
      ],
    });
  },
};
