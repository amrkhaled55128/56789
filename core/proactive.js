import { dueJobs, removeJob, dailyRunKey, markDailyRun, cairoHour, cairoWeekday } from './scheduler.js';
import { getSettings } from './protection.js';
import { levelFromXp } from './economy.js';
import { db } from './db.js';
import { sleep } from '../lib/utils.js';

// 📣 محرك الاستباقية — استرو بيبتدر بنفسه:
// تذكيرات • صباح الخير • التحدي اليومي • متابعة الغايبين • صدارة الجمعة

const MORNING_MESSAGES = [
  '🌅 صباح الخير يا جماعة! عساكم من عواده، يومكم يبدأ بقهوة وضمّة أمل ☕💪',
  '☀️ صباح الفل! اللي صاحي من ساعتين واللي لسه في السرير — النهاردة يوم جديد وفرص جديدة ✨',
  '🌞 صباح الخير يا أبطال! فطاروا كويس وخدوا يومكم بإيدكم — والقهوة على حسابي المعنوي ☕😄',
];

let running = false; // كولداون: يمنع تداخل الـ tick لو مهمة اتاخدت أكتر من 30 ثانية

// ⚠️ الدالة كانت `async` فالـreturn كان Promise مش دالة — وconnection.js كان
// بيحفظ الـPromise في `stopScheduler` وبعدين `stopScheduler?.()` بيرمي
// TypeError وقت إعادة الاتصال (كان ظاهر في لوج Railway).
// الحل: دالة عادية ترجّع دالة الإيقاف مباشرة.
export function startScheduler(sock) {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDueReminders(sock);
      await runDailyTasks(sock);
    } catch (err) {
      console.error('⚠️ خطأ في المجدول:', err.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 30000);
  timer.unref?.();
  tick(); // أول تشغيل
  return () => clearInterval(timer); // دالة إيقاف — الـ reconnect بيستخدمها عشان مفيش intervals مكرّرة
}

// ⏰ التذكيرات المستحقة
async function runDueReminders(sock) {
  const due = dueJobs();
  for (const job of due) {
    try {
      if (job.type === 'reminder') {
        const who = job.meta?.who;
        await sock.sendMessage(job.chatJid, {
          text: `⏰ *تذكير يا ${job.meta?.whoName ?? ''}* ⏰\n\n📝 ${job.meta?.text}\n\n✅ ده التذكير اللي طلبته — ماحدش بينسى عند استرو 😄`,
          mentions: who ? [who] : undefined,
        });
      }
      // ✅ نجح الإرسال — دلوقتي فقط نحذف التذكير
      removeJob(job.id);
    } catch (err) {
      // ⚠️ كان بيحذف قبل الإرسال، فأي فشل شبكة كان بيبتلع التذكير نهائياً
      // من غير رسالة خطأ. دلوقتي التذكير بيفضل وبيتجرّب تاني بعد 30 ثانية.
      console.error('⚠️ فشل تنفيذ تذكير (هيتجرّب تاني):', err.message?.slice(0, 60));
    }
  }
}

// 📅 المهام اليومية (مرة واحدة في اليوم بتوقيت القاهرة)
//
// ⚠️ كان `dailyRunKey` بيسجّل "اتعملت" قبل ما الشغل يبان — فأي فشل في
// الـ fetch أو الإرسال كان بيخلي التحية والتحدي يتخطّوا نهاردا كله.
// دلوقتي: بنفحص، ننفذ، ولو نجح نسجّل. فشل = إعادة محاولة بعد 30 ثانية.
const lastFetchErrorLog = { morning: 0, absent: 0, weekly: 0 };
const FETCH_LOG_COOLDOWN = 10 * 60 * 1000;

function logFetchFailure(key, label, err) {
  const now = Date.now();
  if (now - lastFetchErrorLog[key] < FETCH_LOG_COOLDOWN) return;
  lastFetchErrorLog[key] = now;
  console.warn(`⚠️ ${label}: فشل جلب الجروبات؛ هنجرب تاني (${err?.message ?? 'خطأ غير معروف'})`);
}

async function runDailyTasks(sock) {
  const hour = cairoHour();

  // 🌅 صباح الخير + التحدي — الصبح
  if (hour >= 8 && dailyRunKey('morning')) {
    let groups;
    try {
      groups = await sock.groupFetchAllParticipating();
      lastFetchErrorLog.morning = 0;
    } catch (err) {
      logFetchFailure('morning', 'morning', err);
      return; // لا نحفظ dailyRunKey؛ المحاولة التالية تعيد التنفيذ
    }
    const keys = Object.keys(groups ?? {});
    if (keys.length) {
      for (const jid of keys) {
        const s = getSettings(jid);
        if (!s.morning && !s.questAuto) continue;

        if (s.morning) {
          const msg = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
          await sock.sendMessage(jid, { text: `${msg}\n\n👥 ${groups[jid].subject}` }).catch(() => {});
          await sleep(1500);
        }
        if (s.questAuto) {
          const { todayQuest } = await import('../commands/games/dailyquest.js').catch(() => ({}));
          if (todayQuest) {
            const q = todayQuest();
            await sock.sendMessage(jid, {
              text: `📅 *تحدي النهاردة* 🎯\n\n${q.q}\n\n🏆 ${q.coins} عملة — أول ما تخلّصه: \`.dailyquest done ردك\``,
            }).catch(() => {});
            await sleep(1500);
          }
        }
      }
      markDailyRun('morning'); // ✅ نجح — متكررش النهاردة
    } else {
      // الـAPI نجح فعلاً لكن البوت مش في جروبات. نسجلها لتجنب warning كل 30 ثانية.
      markDailyRun('morning');
    }
  }

  // 💔 متابعة الغايبين — بالليل
  if (hour >= 18 && dailyRunKey('absent')) {
    const users = db.get('users', {});
    const now = Date.now();
    let groups;
    try {
      groups = await sock.groupFetchAllParticipating();
      lastFetchErrorLog.absent = 0;
    } catch (err) {
      logFetchFailure('absent', 'absent', err);
      return;
    }
    groups ??= {};
    const sent = new Set();

    for (const [key, p] of Object.entries(users)) {
      if (!p.lastChat || !p.name || !p.lastSeen) continue;
      const awayDays = (now - p.lastSeen) / 86400000;
      if (awayDays < 3 || awayDays > 7 || sent.has(key)) continue;

      const s = getSettings(p.lastChat);
      if (!s.followUp || !groups[p.lastChat]) continue;

      const who = p.lastChat.endsWith('@g.us') ? 'يا جماعة ' : '';
      await sock.sendMessage(p.lastChat, {
        text: `💔 ${who}*${p.name}* غايب عننا ${Math.round(awayDays)} أيام.. وحشتنا كلامه 😢\nتعالى يا ${p.name} أحنا مستنيينك! 🫶`,
        mentions: [key],
      }).catch(() => {});
      sent.add(key);
      await sleep(1500);
    }
    markDailyRun('absent');
  }

  // 🏆 صدارة الجمعة — الجمعة 8 مساءً
  if (cairoWeekday() === 'Friday' && hour >= 20 && dailyRunKey('weekly')) {
    const eco = db.get('economy', {});
    const users = db.get('users', {});
    // ⚠️ كان بيقرا v.level مباشرة — وده دايمًا 1 (مفيش سطر بيعمله حساب)
    const levelOf = (v) => v?.level ?? levelFromXp(v?.xp ?? 0);
    const top = Object.entries(eco)
      .sort((a, b) => levelOf(b[1]) - levelOf(a[1]) || (b[1]?.xp ?? 0) - (a[1]?.xp ?? 0))
      .slice(0, 5);
    if (!top.length) return;

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const nameOf = (k) => users[k]?.name ?? k.split('@')[0];
    const lines = top.map(
      ([k, v], i) => `${medals[i]} ${nameOf(k)} — مستوى ${levelOf(v)} • ${v?.coins ?? 0} عملة`,
    );

    let groups;
    try {
      groups = await sock.groupFetchAllParticipating();
      lastFetchErrorLog.weekly = 0;
    } catch (err) {
      logFetchFailure('weekly', 'weekly', err);
      return;
    }
    groups ??= {};
    for (const jid of Object.keys(groups)) {
      if (!getSettings(jid).morning) continue;
      await sock.sendMessage(jid, {
        text: `🏆 *صدارة الأسبوع* 🎉\n\n${lines.join('\n')}\n\nالجمعة الجاية ممكن تكون انت الأولى 💪`,
      }).catch(() => {});
      await sleep(1500);
    }
    markDailyRun('weekly');
  }
}
