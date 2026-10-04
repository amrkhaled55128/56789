import { sendQuickReplies } from '../../core/send.js';
import { db } from '../../core/db.js';
import { grantWin, grantLoss } from '../../core/economy.js';

const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // صفوف
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // أعمدة
  [0, 4, 8], [2, 4, 6],            // قطرين
];

function cell(v) {
  return v === 'X' ? '❌' : v === 'O' ? '⭕' : '⬜';
}

function render(board) {
  return [
    `${cell(board[0])} ${cell(board[1])} ${cell(board[2])}`,
    `${cell(board[3])} ${cell(board[4])} ${cell(board[5])}`,
    `${cell(board[6])} ${cell(board[7])} ${cell(board[8])}`,
  ].join('\n');
}

function winner(board) {
  for (const [a, b, c] of WINS) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

// ذكاء البوت: يكسب لو يعرف، يصد لو مهدد، ياخد النص، وبعدين ركن عشوائي
function botMove(board) {
  const empties = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  for (const i of empties) {
    const t = [...board];
    t[i] = 'O';
    if (winner(t) === 'O') return i;
  }
  for (const i of empties) {
    const t = [...board];
    t[i] = 'X';
    if (winner(t) === 'X') return i;
  }
  if (!board[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !board[i]);
  const pool = corners.length ? corners : empties;
  return pool[Math.floor(Math.random() * pool.length)];
}

function boardButtons(board) {
  return board
    .map((v, i) => (v ? null : { label: `▫️ ${i + 1}`, id: `.xo p${i + 1}` }))
    .filter(Boolean);
}

function games() {
  return db.get('xo', {});
}

export default {
  name: 'xo',
  aliases: ['اكس', 'اكس او', 'xo9'],
  description: 'إكس-أو ضد البوت — العب بأزرار المربعات',
  usage: '.xo  أو  .xo new',
  async execute(sock, m, args) {
    const all = games();
    const game = all[m.jid];

    if (args[0] === 'stop') {
      delete all[m.jid];
      db.set('xo', all);
      return m.reply('🛑 اتلغت اللعبة. اكتب `.xo` لو عايز تبدأ من جديد');
    }

    // مفيش لعبة أو اللاعب عايز يبدأ من جديد
    if (!game || args[0] === 'new') {
      all[m.jid] = { board: Array(9).fill(null), player: m.sender };
      db.set('xo', all);
      return sendQuickReplies(sock, m.jid, {
        title: '❌⭕ إكس-أو — إنت ❌ وأنا ⭕',
        text: 'اللوحة فاضية! دوس على رقم المربع اللي عايز تلعب فيه 👇',
        buttons: boardButtons(Array(9).fill(null)),
      });
    }

    if (game.player !== m.sender) {
      return m.reply('😆 في لعبة شغالة هنا للاعب تاني! اكتب `.xo new` لبدء لعبتك');
    }

    const pos = /^p([1-9])$/.test(args[0] ?? '') ? Number(args[0].slice(1)) - 1 : null;
    if (pos === null) {
      return m.reply('اكتب `.xo` عشان تشوف اللوحة، أو `.xo new` لعبة جديدة');
    }

    if (game.board[pos]) {
      return m.reply('🚫 المربع ده متاخد خلاص — اختار واحد فاضي من الأزرار');
    }

    // حركة اللاعب
    game.board[pos] = 'X';
    let result = winner(game.board);
    let botPlayed = null;

    // حركة البوت لو مفيش نتيجة
    if (!result) {
      const botPos = botMove(game.board);
      game.board[botPos] = 'O';
      botPlayed = botPos;
      result = winner(game.board);
    }

    if (result) {
      const stats = db.get('xoStats', {});
      const me = stats[m.sender] ?? { win: 0, lose: 0, draw: 0 };
      let endText;
      if (result === 'X') {
        me.win++;
        endText = `🎉 *كسبتني!* برافو عليك\n💰 +30 عملة`;
        grantWin(m.identityKey ?? m.sender, 30);
      } else if (result === 'O') {
        me.lose++;
        endText = '😎 *كسبتك المرة دي!* جرب تاني';
        grantLoss(m.identityKey ?? m.sender);
      } else {
        me.draw++;
        endText = '🤝 *تعادل!* لعبة محترمة';
      }
      stats[m.sender] = me;
      delete all[m.jid];
      db.set('xo', all);
      db.set('xoStats', stats);

      return sendQuickReplies(sock, m.jid, {
        title: endText,
        text: `${render(game.board)}\n\n📊 سجلّك: ${me.win} فوز • ${me.lose} خسارة • ${me.draw} تعادل`,
        buttons: [{ label: '🔄 العب تاني', id: '.xo new' }],
      });
    }

    db.set('xo', all);
    return sendQuickReplies(sock, m.jid, {
      title: '❌⭕ دورك — دوس المربع اللي عايزه',
      text: `${render(game.board)}\n\n${botPlayed !== null ? '_أنا لعبت ✅_ ' : ''}لوحة اللعبة فوق 👇`,
      buttons: boardButtons(game.board),
    });
  },
};
