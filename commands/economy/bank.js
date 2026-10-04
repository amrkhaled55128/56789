import { sendQuickReplies } from '../../core/send.js';
import { getEco, saveEco } from '../../core/economy.js';
import { db } from '../../core/db.js';
import { targetOf } from '../../core/groupadmin.js';

// 🏦 .bank — البنك: حط فلوسك في مكان ما حدش يقدر ياخدها
// (مفيش بنك في البوت — .roll و .slot مفتوحين على أي مبلغ ومفيش حد فليور)
export default {
  name: 'bank',
  aliases: ['البنك', 'خزنه'],
  description: 'البنك — حط وسحب فلوسك: .bank deposit 100  |  .bank rob @شخص',
  usage: '.bank deposit 100',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    const sub = (args[0] ?? '').toLowerCase();
    const amount = Number(args[1]);

    if (sub === 'deposit' || sub === 'حط' || sub === 'ادخار') {
      if (!Number.isFinite(amount) || amount <= 0) return m.reply('اكتب المبلغ: `.bank deposit 100`');
      const eco = getEco(key);
      if (eco.coins < amount) return m.reply(`🪙 رصيدك *${eco.coins}* مش كفاية — مش هقدر أحط ${amount}`);
      eco.coins -= amount;
      eco.bank = (eco.bank ?? 0) + amount;
      saveEco(key, eco);
      return m.reply(
        `🏦 حطيت *${amount}* في البنك\n💰 في جيبك: ${eco.coins}\n🏛️ في البنك: ${eco.bank}\n\n💡 اللي في البنك ما حدش يقدر ياخده غيرك`,
      );
    }

    if (sub === 'withdraw' || sub === 'سحب' || sub === 'اخد') {
      if (!Number.isFinite(amount) || amount <= 0) return m.reply('اكتب المبلغ: `.bank withdraw 50`');
      const eco = getEco(key);
      if ((eco.bank ?? 0) < amount) return m.reply(`🏦 في البنك عندك ${eco.bank ?? 0} بس`);
      eco.bank -= amount;
      eco.coins += amount;
      saveEco(key, eco);
      return m.reply(`💵 سحبت *${amount}* من البنك\n💰 في جيبك: ${eco.coins}\n🏛️ في البنك: ${eco.bank}`);
    }

    if (sub === 'rob' || sub === 'سرقه') {
      const target = targetOf(m);
      if (!target) return m.reply('منشن اللي عايز تسرقه: `.bank rob @شخص`');
      const targetDigits = String(target).split('@')[0];
      const mineKey = key;
      const mineDigits = String(m.sender).split(':')[0].split('@')[0];
      if (targetDigits === mineDigits) return m.reply('😂 هتسرق نفسك؟ جرّب حد تاني');

      const ecoAll = db.get('economy', {});
      const entry = Object.entries(ecoAll).find(([k]) => k.split('@')[0] === targetDigits);
      if (!entry?.[1]) return m.reply(`@${targetDigits} لسه ماعندوش رصيد محفوظ 💨`);

      const mine = getEco(mineKey);
      const victim = entry[1];
      const now = Date.now();
      const cooldownMs = 24 * 60 * 60 * 1000;
      if (now - (mine.lastRob ?? 0) < cooldownMs) {
        const h = Math.ceil((cooldownMs - (now - mine.lastRob)) / 3600000);
        return m.reply(`⏳ استنى ${h} ساعة قبل محاولة سرقة تانية`);
      }
      if ((mine.coins ?? 0) < 50) return m.reply('🪙 محتاج 50 عملة في جيبك على الأقل عشان تسرق');
      if ((victim.coins ?? 0) < 100) return m.reply(`@${targetDigits} فقير أوي — ماينفعش نتعبه 😅`);

      // محاولة واحدة في اليوم، الحد الأقصى للسرقة 100 عملة.
      mine.lastRob = now;
      if (Math.random() < 0.4) {
        const stolen = Math.min(100, Math.max(1, Math.floor((victim.coins ?? 0) * 0.1)));
        victim.coins -= stolen;
        mine.coins = (mine.coins ?? 0) + stolen;
        saveEco(entry[0], victim);
        saveEco(mineKey, mine);
        return m.reply(`🔪 نجحت! خدت *${stolen}* عملة من @${targetDigits} 💰\n(بحد أقصى 100، وما تقدرش تحاول تاني قبل بكرة)`);
      }

      const fine = Math.min(mine.coins, 25);
      mine.coins -= fine;
      saveEco(mineKey, mine);
      return m.reply(`🚔 اتمسكت! خسرت *${fine}* عملة غرامة\n@${targetDigits} كان مخدعك 😏`);
    }

    // 📊 الرصيد
    const eco = getEco(key);
    return sendQuickReplies(sock, m.jid, {
      title: '🏦 بنك استرو',
      text:
        `💰 في جيبك: *${eco.coins}* عملة\n` +
        `🏛️ في البنك: *${eco.bank ?? 0}* عملة\n` +
        `💵 الإجمالي: *${eco.coins + (eco.bank ?? 0)}*\n\n` +
        '💡 خلّي فلوس كبيرة في البنك عشان محدش ياخدها في اللعبة',
      buttons: [
        { label: '⬇️ حط 100', id: '.bank deposit 100' },
        { label: '⬆️ اسحب 50', id: '.bank withdraw 50' },
        { label: '🔪 سرقة', id: '.bank rob' },
      ],
    });
  },
};
