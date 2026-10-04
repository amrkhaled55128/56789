import { sendInteractive } from '../../core/send.js';
import { db } from '../../core/db.js';
import { grantWin, grantLoss } from '../../core/economy.js';

const CHOICES = {
  rock:     { emoji: '✊', ar: 'حجر',   beats: 'scissors' },
  paper:    { emoji: '✋', ar: 'ورقة',  beats: 'rock' },
  scissors: { emoji: '✌️', ar: 'مقص',   beats: 'paper' },
};

const ALIASES = {
  rock:     ['حجر', 'ح', 'rock', 'r', '1'],
  paper:    ['ورقة', 'ورق', 'و', 'paper', 'p', '2'],
  scissors: ['مقص', 'م', 'scissors', 's', '3'],
};

function pick(arg) {
  if (!arg) return null;
  const a = String(arg).toLowerCase();
  for (const [key, names] of Object.entries(ALIASES)) {
    if (names.includes(a)) return key;
  }
  return null;
}

export default {
  name: 'rps',
  aliases: ['حجر'],
  description: 'حجر ورقة مقص ضد البوت — بأزرار تفاعلية',
  usage: '.rps  أو  .rps حجر',
  async execute(sock, m, args) {
    const stats = db.get('rps', {});
    const me = stats[m.sender] ?? { win: 0, lose: 0, draw: 0 };

    const choice = pick(args[0]);

    // مفيش اختيار → اعرض أزرار اللعب
    if (!choice) {
      await sendInteractive(sock, m.jid, {
        text: [
          `🎮 *حجر ورقة مقص*`,
          ``,
          `اختار حركتك من الأزرار 👇`,
          `أو اكتبها: ${'`.rps حجر`'} / ${'`.rps ورقة`'} / ${'`.rps مقص`'}`,
        ].join('\n'),
        buttons: [
          { label: '✊ حجر', id: '.rps rock' },
          { label: '✋ ورقة', id: '.rps paper' },
          { label: '✌️ مقص', id: '.rps scissors' },
        ],
      });
      return;
    }

    const botPick = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];
    let result;
    if (choice === botPick) {
      result = '🤝 تعادل!';
      me.draw++;
    } else if (CHOICES[choice].beats === botPick) {
      result = '🎉 فزت عليّ!';
      me.win++;
      grantWin(m.identityKey ?? m.sender, 20);
    } else {
      result = '😎 كسبتك!';
      me.lose++;
      grantLoss(m.identityKey ?? m.sender);
    }
    stats[m.sender] = me;
    db.set('rps', stats);

    await m.reply([
      `🎮 *حجر ورقة مقص*`,
      ``,
      `${CHOICES[choice].emoji} أنت (${CHOICES[choice].ar}) *مقابل* ${CHOICES[botPick].emoji} أنا (${CHOICES[botPick].ar})`,
      ``,
      `🏆 ${result}`,
      `📊 سجلّك: ${me.win} فوز • ${me.lose} خسارة • ${me.draw} تعادل`,
      ``,
      `_عايز تاني؟ اكتب .rps أو دوس زر جديد_`,
    ].join('\n'));
  },
};
