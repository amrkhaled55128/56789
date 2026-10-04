/**
 * 🎮 اختبار الألعاب — السيناريوهات اللي كانت بتقفل الجروب.
 *
 * التشغيل: node _test/games.mjs
 */
import { makeSock, makeCtx } from './harness.mjs';
import { loadCommands } from '../core/loader.js';
import { db } from '../core/db.js';

const { commands } = await loadCommands();
const get = (n) => commands.get(n);
const GROUP = '120363000000000000@g.us';
const A = '201273990719@s.whatsapp.net';
const B = '201111111111@s.whatsapp.net';

let pass = 0;
let fail = 0;
const check = (label, ok, extra = '') => {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label} ${extra}`);
  }
};

function ctx(sock, body, { jid = GROUP, sender = A, message = {} } = {}) {
  return makeCtx(sock, { jid, sender, body: '.' + body, message });
}
const args = (m) => m.args.slice(1);
const run = async (body, opts) => {
  const sock = makeSock();
  const m = ctx(sock, body, opts);
  await get(body.split(/\s+/)[0]).execute(sock, m, args(m), { commands, categories: new Map() });
  return { sock, m };
};
const lastText = (sock) => {
  const s = [...sock.sent].reverse();
  const hit = s.find((x) => x.content?.text);
  return hit?.content?.text ?? '';
};

// ═══════════ .duel ═══════════
console.log('\n⚔️  .duel');
{
  db.set('duels', {});
  // تحدي عبر منشن (الصيغة المكتوبة في الـ usage)
  const sock = makeSock();
  const m = ctx(sock, 'duel', { message: { extendedTextMessage: { contextInfo: { mentionedJid: [B] } } } });
  await get('duel').execute(sock, m, args(m), { commands, categories: new Map() });
  const g = db.get('duels', {})[GROUP];
  check('المنشن بيعمل تحدي (كان بيرجع "منشن اللي عايز تتحداه" دايمًا)', !!g);
  check('اللاعب التاني متخزّن بمفتاح هوية زي البOTH', g && g.pO === g.target);

  // الرد على حد (contextInfo.participant) لازم برضه يشتغل
  db.set('duels', {});
  const sock2 = makeSock();
  const m2 = ctx(sock2, 'duel', { message: { extendedTextMessage: { contextInfo: { participant: B } } } });
  await get('duel').execute(sock2, m2, args(m2), { commands, categories: new Map() });
  check('الرد على رسالة (participant) بيشتغل', !!db.get('duels', {})[GROUP]);

  // القبول
  const sock3 = makeSock();
  const m3 = ctx(sock3, 'duel yes', { sender: g.pO });
  await get('duel').execute(sock3, m3, args(m3), { commands, categories: new Map() });
  check('اللاعب التاني يقدر يقبل', db.get('duels', {})[GROUP]?.stage === 'playing');

  // ⭐ DLLUB: بعد القبول الدور على X (المتحدّي) — نلعب أول خطوة بيه
  const sx = makeSock();
  const mx = ctx(sx, 'duel mv-1', { sender: g.pX });
  await get('duel').execute(sx, mx, args(mx), { commands, categories: new Map() });
  const turnNow = db.get('duels', {})[GROUP]?.turn;
  check('المتحدّي (X) كسب دوره', db.get('duels', {})[GROUP]?.board?.[0] === 'X', `→ ${lastText(sx).slice(0, 40)}`);

  // ⭐ وبعدها اللاعب التاني (O) يقدر يلعب — ده كان مستحيل خالص
  const sock4 = makeSock();
  const m4 = ctx(sock4, 'duel mv-2', { sender: g.pO });
  await get('duel').execute(sock4, m4, args(m4), { commands, categories: new Map() });
  const after = db.get('duels', {})[GROUP];
  check('⭐ اللاعب التاني قدر يلعب دوره (مش "مش دورك")', after?.board?.[1] === 'O', `→ ${lastText(sock4).slice(0, 40)}`);

  // إلغاء
  db.set('duels', {});
  const sock5 = makeSock();
  const m5 = ctx(sock5, 'duel @x', { message: { extendedTextMessage: { contextInfo: { mentionedJid: [B] } } } });
  await get('duel').execute(sock5, m5, args(m5), { commands, categories: new Map() });
  const sock6 = makeSock();
  const m6 = ctx(sock6, 'duel cancel', { sender: A });
  await get('duel').execute(sock6, m6, args(m6), { commands, categories: new Map() });
  check('🚪 `.duel cancel` بيفكّ الجروب (كان مش موجود خالص)', !db.get('duels', {})[GROUP]);

  // تحدي قديم
  db.set('duels', { [GROUP]: { stage: 'pending', pX: A, pO: B, target: B, at: Date.now() - 40 * 60 * 1000 } });
  const sock7 = makeSock();
  const m7 = ctx(sock7, 'duel');
  await get('duel').execute(sock7, m7, args(m7), { commands, categories: new Map() });
  check('تحدي متسني من ساعة اتشال تلقائياً', !db.get('duels', {})[GROUP]);
}

// ═══════════ .race ═══════════
console.log('\n🏎️  .race');
{
  db.set('race', {});
  await run('race');
  check('سباق بدأ', !!db.get('race', {})[GROUP]);

  const sock2 = makeSock();
  const m2 = ctx(sock2, 'race');
  await get('race').execute(sock2, m2, args(m2), { commands, categories: new Map() });
  check('سباق شغال بيقول السؤال + الوقت المتبقي', lastText(sock2).includes('ثانية'), `→ ${lastText(sock2).slice(0, 50)}`);

  // ⭐ انتهاء الوقت يُفحص على أي مسار
  db.set('race', { [GROUP]: { score: 0, queue: [{ q: 'x', a: 1 }], current: { q: 'x', a: 1 }, at: Date.now() - 120000 } });
  const sock3 = makeSock();
  const m3 = ctx(sock3, 'race');
  await get('race').execute(sock3, m3, args(m3), { commands, categories: new Map() });
  check('⭐ سباق منتهي الوقت اتشال وبدأ جديد', !!db.get('race', {})[GROUP]);

  // stop
  const sock4 = makeSock();
  const m4 = ctx(sock4, 'race stop');
  await get('race').execute(sock4, m4, args(m4), { commands, categories: new Map() });
  check('🚪 `.race stop` بيشتغل', !db.get('race', {})[GROUP]);
}

// ═══════════ .guess ═══════════
console.log('\n🔢  .guess');
{
  db.set('guess', {});
  await run('guess', { sender: A });
  await run('guess', { sender: B });
  const all = db.get('guess', {});
  const keys = Object.keys(all);
  check('⭐ كل لاعب ليه اللعبة بتاعته (كانوا مشتركين في واحدة)', keys.length === 2, `→ ${keys.length} لعبة`);

  // استسلام من غير لعبة
  const sock = makeSock();
  const m = ctx(sock, 'guess surrender', { sender: '201222222222@s.whatsapp.net' });
  await get('guess').execute(sock, m, args(m), { commands, categories: new Map() });
  check('استسلام من غير لعبة مابيديكش لعبة جديدة', lastText(sock).includes('مفيش لعبة'));
}

// ═══════════ .guesswho ═══════════
console.log('\n🎭  .guesswho');
{
  db.set('guessWho', {});
  const sock = makeSock();
  const m = ctx(sock, 'guesswho');
  await get('guesswho').execute(sock, m, args(m), { commands, categories: new Map() });
  const game = db.get('guessWho', {})[GROUP];

  // ⭐ حرف واحد ما يكسبش
  const sock2 = makeSock();
  const m2 = ctx(sock2, 'guesswho guess ا', { sender: '201333333333@s.whatsapp.net' });
  await get('guesswho').execute(sock2, m2, args(m2), { commands, categories: new Map() });
  check('⭐ حرف واحد ما يكسبش اللعبة', lastText(sock2).includes('3 حروف'), `→ ${lastText(sock2).slice(0, 40)}`);
  // ⭐ التلميح مابيبقاش undefined
  let undef = false;
  for (let i = 0; i < 2; i++) {
    const s = makeSock();
    const mm = ctx(s, 'guesswho guess ززززز', { sender: '201333333333@s.whatsapp.net' });
    await get('guesswho').execute(s, mm, args(mm), { commands, categories: new Map() });
    if (lastText(s).includes('undefined')) undef = true;
  }
  check('⭐ مفيش "تلميح: undefined" أبداً', !undef);

  // الإجابة الصح
  const sock3 = makeSock();
  const m3 = ctx(sock3, `guesswho guess ${game.who}`, { sender: '201333333333@s.whatsapp.net' });
  await get('guesswho').execute(sock3, m3, args(m3), { commands, categories: new Map() });
  check('الإجابة الكاملة بتكسب', lastText(sock3).includes('صح'));
}

// ═══════════ .hang ═══════════
console.log('\n🔤  .hang');
{
  db.set('hang', {});
  const sock = makeSock();
  const m = ctx(sock, 'hang');
  await get('hang').execute(sock, m, args(m), { commands, categories: new Map() });
  const g = db.get('hang', {})[GROUP];
  check('كلمة مخفية بدأت', !!g);
  // ⭐ دايمًا فيه طريقة للكسب
  const winable = [...new Set(g.word.split(''))].every((c) => 'ابتثجحخدذرزسشصضطظعغفقكلمنهوىيءأإؤئ'.includes(c));
  check('⭐ الكلمة دي قابلة للكسب', winable, `→ ${g.word}`);

  // ⭐ التاء المربوطة مقبولة
  const sock2 = makeSock();
  const m2 = ctx(sock2, 'hang ه');
  await get('hang').execute(sock2, m2, args(m2), { commands, categories: new Map() });
  check('⭐ الحرف "ه" (بدل ة) مقبول', !lastText(sock2).includes('ابعت حرف'));
}

// ═══════════ .color ═══════════
console.log('\\n🎨  .color');
{
  db.set('colorGames', {});
  const sock = makeSock();
  const m = ctx(sock, 'color');
  await get('color').execute(sock, m, args(m), { commands, categories: new Map() });
  const gameKey = `${GROUP}::${A}`;
  const g = db.get('colorGames', {})[gameKey];
  check('اللعبة تتخزن في قاعدة البيانات لكل لاعب', !!g);
  const sent = sock.sent.find((x) => x.kind === 'relay')?.msg?.interactiveMessage;
  const buttons = sent?.nativeFlowMessage?.buttons ?? [];
  const labels = buttons.map((b) => JSON.parse(b.buttonParamsJson).id);
  const correctLabel = `.color ${['أحمر','أزرق','أخضر','أصفر','برتقالي','بنفسجي','بني','أسود'][g?.correct]}`;
  check('زر الإجابة الصحيحة موجود (ما بقاش الفوز مستحيل)', labels.includes(correctLabel), `الإجابة=${correctLabel}, أزرار=${labels.join('|')}`);
  check('كل 8 ألوان ظاهرة', labels.length === 8, `عدد الأزرار=${labels.length}`);

  // لاعب تاني في نفس الجروب مايمسحش حالة الأول.
  const sockB = makeSock();
  const mB = ctx(sockB, 'color', { sender: B });
  await get('color').execute(sockB, mB, args(mB), { commands, categories: new Map() });
  check('حالة لاعب تاني مستقلة', Object.keys(db.get('colorGames', {})).length === 2);

  // التخمين الصحيح يدي مكافأة ويمسح حالة اللاعب نفسه فقط.
  const answerSock = makeSock();
  const answer = ['أحمر','أزرق','أخضر','أصفر','برتقالي','بنفسجي','بني','أسود'][g.correct];
  const answerCtx = ctx(answerSock, `color ${answer}`);
  await get('color').execute(answerSock, answerCtx, args(answerCtx), { commands, categories: new Map() });
  check('الإجابة الصحيحة تكسب وتمسح حالة اللاعب', !db.get('colorGames', {})[gameKey]);
  check('حالة اللاعب الثاني تفضل موجودة', !!db.get('colorGames', {})[`${GROUP}::${B}`]);

  const privateA = makeSock();
  const privateCtxA = ctx(privateA, 'color', { jid: `${A}`, sender: A });
  await get('color').execute(privateA, privateCtxA, args(privateCtxA), { commands, categories: new Map() });
  const privateB = makeSock();
  const privateCtxB = ctx(privateB, 'color', { jid: `${B}`, sender: B });
  await get('color').execute(privateB, privateCtxB, args(privateCtxB), { commands, categories: new Map() });
  const privateSameChatA = makeSock();
  const privateSameCtxA = ctx(privateSameChatA, 'color', { jid: '201000000000@s.whatsapp.net', sender: A });
  await get('color').execute(privateSameChatA, privateSameCtxA, args(privateSameCtxA), { commands, categories: new Map() });
  const privateSameChatB = makeSock();
  const privateSameCtxB = ctx(privateSameChatB, 'color', { jid: '201000000000@s.whatsapp.net', sender: B });
  await get('color').execute(privateSameChatB, privateSameCtxB, args(privateSameCtxB), { commands, categories: new Map() });
  check('private games are keyed to each private chat/user', Object.keys(db.get('colorGames', {})).length === 5);

  const games = db.get('colorGames', {});
  games.expired = { correct: 0, at: Date.now() - 121000 };
  db.set('colorGames', games);
  const sweepSock = makeSock();
  const sweepCtx = ctx(sweepSock, 'color', { sender: A });
  await get('color').execute(sweepSock, sweepCtx, args(sweepCtx), { commands, categories: new Map() });
  check('expired color games are pruned', !db.get('colorGames', {}).expired);
  db.set('colorGames', {});
}

// ═══════════ تحويل مستخدم جديد ═══════════
console.log('\\n💸 .تحويل');
{
  const { getEco, saveEco } = await import('../core/economy.js');
  const sender = '201888888888@s.whatsapp.net';
  const receiver = '201999999999@s.whatsapp.net';
  const senderEco = getEco(sender);
  senderEco.coins = 300;
  saveEco(sender, senderEco);
  delete db.data.economy[receiver];

  const sock = makeSock();
  const m = ctx(sock, 'تحويل 100', {
    sender,
    message: { extendedTextMessage: { contextInfo: { mentionedJid: [receiver] } } },
  });
  await get('تحويل').execute(sock, m, args(m), { commands, categories: new Map() });
  check('تحويل أول مرة لا ينهار ويحفظ حساب الطرفين',
    db.get('economy', {})[sender]?.coins === 200 && db.get('economy', {})[receiver]?.coins === 200);

  delete db.data.economy[sender];
  delete db.data.economy[receiver];
  db.set('economy', db.get('economy', {}));
}

// ═══════════ dailyquest history cleanup ═══════════
console.log('\\n📅 dailyquest cleanup');
{
  const { todayKey, pruneQuestHistory } = await import('../commands/games/dailyquest.js');
  const today = todayKey();
  const [y, mo, d] = today.split('-').map(Number);
  const ageKey = (age) => {
    const noonUtc = new Date(Date.UTC(y, mo - 1, d - age, 12));
    return noonUtc.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  };
  const history = { [ageKey(15)]: true, [ageKey(14)]: true, [today]: true };
  const pruned = pruneQuestHistory(history, today);
  check('يزيل تاريخًا أقدم من 14 يومًا', !pruned[ageKey(15)]);
  check('يحافظ على سجل 14 يومًا واليوم', !!pruned[ageKey(14)] && !!pruned[today]);
}

// ═══════════ .td ═══════════
console.log('\n🔥  .td');
{
  db.set('td', {});
  await run('td truth');
  const first = db.get('td', {})[GROUP]?.truth;
  await run('td dare');
  const s = db.get('td', {})[GROUP];
  check('⭐ الحقيقة بتفضل محفوظة بعد ما لعبت جرأة', !!s?.truth && !!s?.dare);
}

// ═══════════ Economy ═══════════
console.log('\n💰  addCoins');
{
  const { addCoins, getEco, levelFromXp } = await import('../core/economy.js');
  const k = '__gametest__';
  const e0 = getEco(k);
  e0.coins = 100; e0.xp = 0;
  const { saveEco } = await import('../core/economy.js');
  saveEco(k, e0);
  const d = addCoins(k, 30);
  check('⭐ addCoins رجّع 30 مش 130 (المبلغ مش الرصيد)', d === 30, `→ رجّع ${d}`);

  const e1 = getEco(k);
  e1.xp = 100;
  saveEco(k, e1);
  check('⭐ المستوى بيتحسب من الخبرة (كان دايماً 1)', levelFromXp(100) === 2);

  delete db.data.economy[k];
  db.set('economy', db.get('economy', {}));
}

console.log(`\n${'─'.repeat(46)}`);
console.log(`✅ نجح: ${pass}   ❌ فشل: ${fail}`);
process.exit(fail ? 1 : 0);
