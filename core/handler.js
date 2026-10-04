import { config } from '../config.js';
import { sendText } from './send.js';
import { maybeAutoReply } from './autoreply.js';
import { checkMessage, getSettings } from './protection.js';
import { db } from './db.js';
import { isOwner } from '../lib/utils.js';
import { resolveKey, canonicalKey } from './identity.js';
import { awardXp, checkBadges } from './economy.js';
import { bump, recordCommandError } from './stats.js';

const cooldowns = new Map();
const botStartTime = Date.now();

// 🧹 الكولداون كان بيكبر بلا حد: مفتاح لكل (مستخدم × أمر) = 63 أمر × كل حد
// شافه البوت. على نشر طويل ده آلاف المدخلات بتتخزّن للأبد. بنمسح اللي عدّى
// عليه ساعة كل 10 دقايق.
const COOLDOWN_TTL = 3600000;
let cooldownSweep = null;
export function startCooldownSweep() {
  if (cooldownSweep) return;
  cooldownSweep = setInterval(() => {
    const now = Date.now();
    for (const [k, t] of cooldowns) {
      if (now - t > COOLDOWN_TTL) cooldowns.delete(k);
    }
  }, 600000);
  cooldownSweep.unref?.();
}

// فك الرسائل الملفوفة (ephemeral / viewOnce ...) لحد الرسالة الحقيقية
function unwrapMessage(message) {
  let node = message;
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'editedMessage',
  ];
  for (let i = 0; i < 5 && node; i++) {
    const wrapper = wrappers.find((w) => node[w]);
    if (!wrapper) break;
    node = node[wrapper].message;
  }
  return node;
}

// استخراج نص الرسالة — وكمان ردود الأزرار والقوائم بتوصل هنا
function extractBody(message) {
  if (!message) return '';
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;

  // رد على زر سريع أو اختيار من القائمة (native flow)
  const params = message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (params) {
    try {
      return JSON.parse(params).id ?? '';
    } catch {
      return '';
    }
  }

  // ردود القوائم والأزرار القديمة
  return (
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    message.buttonsResponseMessage?.selectedButtonId ||
    ''
  );
}

export async function handleUpsert(sock, ctx, { messages, type }) {
  if (type !== 'notify') return;

  // ⚠️ من غير ده: لو Baileys بعت event من غير messages، الـ for بيعمل TypeError
  // بره الـ try → unhandled rejection بيقتل المعالج كله
  for (const msg of messages ?? []) {
    try {
      if (!msg?.message) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.key.fromMe && !config.respondToSelf) continue;

      // 👻 مضاد الحذف: حد حذف رسالة نصية في جروب مفعّل → نعرض الأصل من ذاكرتنا
      const pm = msg.message.protocolMessage;
      if (pm?.type === 0 && pm.key) {
        try {
          const chatId = pm.key.remoteJid ?? msg.key.remoteJid;
          if (chatId?.endsWith('@g.us') && getSettings(chatId).antidelete) {
            await announceDeleted(sock, chatId, pm.key);
          }
        } catch (err) {
          console.error('⚠️ anti-delete فشل:', err.message?.slice(0, 60));
        }
        continue; // رسالة بروتوكول — مفيش محتوى نعالجه
      }

      const message = unwrapMessage(msg.message);
      const body = extractBody(message);

      // 🎙️ الرسايل الصوتية مفيهاش نص — بنسيبها تعدي عشان نوفا يسمعها ويحاورها
      const isVoiceNote = !!message?.audioMessage;
      if (!body && !isVoiceNote) continue;

      const m = buildContext(sock, msg, message, body);
      bump('messages');

      // 😴 لو البوت مقفول في الشات ده (عدا المالك)
      if (db.get('botOff', {})[m.jid] && !isOwner(m, config)) continue;

      // 🛡️ حماية الجروبات — لو الرسالة اتحذفت متعالجهاش
      if (m.isGroup && (await checkMessage(sock, m))) continue;

      await routeCommand(sock, m, ctx);
      // 🧠 الرد الذكي التلقائي — للأوامر اللي مش بأوامر (خاص / منشن / رد / كلمة سحرية)
      if (!m.body.startsWith(config.prefix)) {
        await maybeAutoReply(sock, m);
      }
    } catch (err) {
      console.error('❌ خطأ في معالجة رسالة:', err);
    }
  }
}

// 👻 مضاد الحذف — كان فيه خطأين:
// 1) `.find()` بترجّع أول رسالة مستخدم في النافذة (الأقدم) مش المحذوفة →
//    البوت كان بيعلن رسالة من ساعتين. الصح: آخر رسالة.
// 2) البروفايلات مخزّنة بـ LID لا بأرقام التليفون، فالبحث بالرقم كان بيرجّع
//    undefined والميزة كانت شغالة على الفاضي.
async function announceDeleted(sock, chatId, deletedKey) {
  // لا نستنتج محتوى الرسالة من سجل المستخدم: السجل ليس مربوطًا بـchatId/messageId
  // وقد يحتوي نصًا خاصًا أو نصًا أقدم. إشعار عام فقط إلى أن يتوفر تطابق دقيق.
  const author = deletedKey.participant ?? deletedKey.remoteJid ?? '';
  if (!author) return;
  const digits = String(author).split(':')[0].split('@')[0];
  await sendText(sock, chatId, `👻 رسالة من @${digits} اتحذفت.`, {
    mentions: [author],
  });
}

function buildContext(sock, msg, message, body) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.fromMe
    ? jid
    : msg.key.participant || jid; // ← التصليح: participant بيرجع "" في الخاص، فـ || بدل ؟?

  // 🆔 الهوية الموحدة (LID مفضّل) — عشان الذاكرة ماتنساش حد
  // حسب توثيق المكتبة: الخاص → remoteJidAlt | الجروب → participantAlt (رقم التليفون الحقيقي)
  const senderAlt = msg.key.remoteJidAlt ?? msg.key.participantAlt ?? null;
  const identityKey = resolveKey(msg.key.participant, senderAlt, jid) ?? sender ?? jid;

  const args = body.startsWith(config.prefix)
    ? body.slice(config.prefix.length).trim().split(/\s+/).filter(Boolean)
    : [];

  // 🆔 المفتاح الكانوني — بيتحسب مرة واحدة لكل رسالة (lazy) وبدون ما يعطّل أي حاجة:
  // identityKey فوق فضل زي ما هو (نفس السلوك القديم)، و`m.canonical` بيجيب المفتاح
  // الثابت لصاحبنا (رقمه الدولي). لو فشل بيترجع null والمستدعي يستخدم identityKey.
  let canonPromise = null;
  const getCanonical = () => {
    canonPromise ??= canonicalKey(sock, sender || senderAlt || jid).catch(() => null);
    return canonPromise;
  };

  return {
    sock,
    msg,
    message,
    body,
    jid,
    sender,
    senderAlt,
    identityKey,
    get canonical() {
      return getCanonical();
    },
    isGroup: jid.endsWith('@g.us'),
    pushName: msg.pushName || 'صديقي',
    args,
    get command() {
      return args[0]?.toLowerCase() ?? '';
    },
    reply: (text, extra = {}) => sendText(sock, jid, text, { quoted: msg, ...extra }),
  };
}

async function routeCommand(sock, m, ctx) {
  if (!m.body.startsWith(config.prefix)) return;

  const name = m.command;
  if (!name) return;

  const cmd = ctx.commands.get(name);
  if (!cmd) {
    // 🤔 اقتراح أقرب أمر لو كتب غلط
    const suggestion = suggestCommand(name, [...new Set(ctx.commands.keys())]);
    if (suggestion) {
      await m.reply(`🤔 مفيش أمر \`${config.prefix}${name}\` — قصدتك \`${config.prefix}${suggestion}\`؟`);
    }
    return;
  }

  // كولداون بسيط لكل مستخدم ضد السبام
  const key = `${m.sender}:${cmd.name}`;
  const now = Date.now();
  if (now - (cooldowns.get(key) ?? 0) < config.cooldown) return;
  cooldowns.set(key, now);

  try {
    await cmd.execute(sock, m, m.args.slice(1), {
      ...ctx,
      startTime: botStartTime,
    });
    // ⚡ خبرة + 📊 عداد الداشبورد
    bump('commands', `${config.prefix}${cmd.name} — ${m.pushName}`);
    await grantReward(sock, m, cmd);
  } catch (err) {
    console.error(`❌ خطأ في الأمر ${cmd.name}:`, err);
    recordCommandError(cmd.name);
    await m.reply(`⚠️ حصل خطأ أثناء تنفيذ الأمر:\n${err?.message ?? err}`).catch(() => {});
  }
}

// ⚡ قيمة الخبرة لكل أمر — مش كلها 2 زي الأول.
// الأوامر الغالية (ذكاء/توليد/تحميل) بتدي أكتر، والحماية بتدي أقل
// عشان محدش يfarm بيالإعدادات.
const XP_VALUES = {
  ai: 6, simsimi: 3, image: 8, video: 10, smart: 6,
  song: 5, yt: 5, tiktok: 4, manga: 4, novel: 4, describe: 5,
  translate: 4, lyrics: 3, pin: 3, gif: 2, sticker: 3,
  rps: 3, xo: 3, quiz: 6, guess: 4, hang: 5, math: 4,
  race: 5, guesswho: 4, td: 3, duel: 8, dailyquest: 5,
  coinflip: 3, color: 4, emoji: 4, mind: 5,
  daily: 4, slot: 2, roll: 2, shop: 2, bank: 2,
  ban: 2, unban: 2, mute: 2, warn: 2, kick: 3, blacklist: 3,
  antilink: 2, antiflood: 2, tagall: 2, promote: 2, demote: 2,
  menu: 1, help: 1, usage: 1, about: 1, how: 1, owner: 1, mystats: 1,
};
const DEFAULT_XP = 2;

async function grantReward(sock, m, cmd) {
  const key = m.identityKey ?? m.sender;
  const xp = XP_VALUES[cmd.name] ?? DEFAULT_XP;
  const levelUp = awardXp(key, xp);
  if (!levelUp) return;

  // 🎉 إعلان الترقية
  const badges = checkBadges(key);
  const bits = [`🎉 *${m.pushName}* ارتقيت لـ *مستوى ${levelUp.to}*!`];
  bits.push(`⚡ شغال: ${xp} XP`);
  for (const b of badges) bits.push(`${b.emoji} وسام جديد: *${b.label}*`);

  await sock
    .sendMessage(m.jid, {
      text: bits.join('\n'),
      mentions: [m.sender],
    })
    .catch(() => {});
}

// أقرب اسم أمر — مسافة تعديل بسيطة (حروف ناقصة/زيادة/مختلفة)
function suggestCommand(typed, names) {
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  let best = null;
  let bestDist = Infinity;
  for (const n of names) {
    const d = dist(typed, n);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return bestDist <= 2 ? best : null;
}
