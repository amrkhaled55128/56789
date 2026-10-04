import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} from '@rexxhayanasi/elaina-baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';
import { loadCommands } from './loader.js';
import { handleUpsert, startCooldownSweep } from './handler.js';
import { getSettings, startProtectionSweep } from './protection.js';
import { resolveKey } from './identity.js';
import { startScheduler } from './proactive.js';
import { migrateOldData } from './memory.js';
import { setBotIdentity, clearCanonicalCache } from './identity.js';
import { startMaintenance } from './maintenance.js';
import { setGroupsProvider, setApiStatus } from './stats.js';
import { db } from './db.js';
import api, { setOwnerNotifier, onApiStatus } from './api.js';

const logger = pino({ level: 'silent' });
const __dirname = dirname(fileURLToPath(import.meta.url));
// ☁️ على Railway: التخزين كله جوّه الـ volume الواحد /app/session
const SESSION_DIR = join(__dirname, '..', 'session');
// ملف الـ QR: جوّه الـ volume على السحابة، ومجلد data محليًا
const QR_FILE = join(__dirname, '..', process.env.RAILWAY_ENVIRONMENT ? 'session' : 'data', 'qr.txt');

// 🔄 حالة إعادة الاتصال — backoff + منع تداخل المحاولات
let reconnecting = false;
let reconnectAttempts = 0;
// دوال الإيقاف عشان ما نعملش intervals مكرّرة على كل reconnect
let stopScheduler = null;
let stopMaint = null;
let stopSweep = null;

// صفحة الويب بتقرا الكود من الملف ده عشان تعرض أحدث QR دايمًا
function saveQr(qr) {
  fs.mkdirSync(dirname(QR_FILE), { recursive: true });
  fs.writeFileSync(QR_FILE, qr);
}

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  // 🧠 ترحيل الذاكرة القديمة للهويات الجديدة (مرة واحدة)
  migrateOldData();

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    console.warn('⚠️ مقدرتش أجيب أحدث إصدار واتساب — هستخدم الإصدار المدمج');
  }

  const { commands, categories, errors } = await loadCommands();
  if (errors.length) {
    console.warn('⚠️ أوامر اتحملت غلط:');
    errors.forEach((e) => console.warn('   •', e));
  }
  const totalCommands = [...categories.values()].reduce((sum, cmds) => sum + cmds.length, 0);
  console.log(`📦 تم تحميل ${totalCommands} أمر في ${categories.size} قسم`);

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.windows('Chrome'),
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => onConnectionUpdate(sock, update));
  sock.ev.on('messages.upsert', (upsert) => handleUpsert(sock, { commands, categories }, upsert));

  // 🆔 هوية البوت نفسه — عشان متتخلطش بذاكرة الناس + 🧹 الصيانة الدورية
  setBotIdentity(sock);
  stopMaint = startMaintenance();
  startCooldownSweep();
  stopSweep = startProtectionSweep();

  // 📊 حالة الـ API على الداشبورد — كان بيقول "شغال" دايمًا
  onApiStatus((status, openCount) => setApiStatus(status, openCount));

  // 🔄 مزامنة LID ← رقم التليفون تلقائيًا (التعرف بيشتغل مع أي شخص جديد)
  sock.ev.on('lid-mapping.update', ({ lid, pn }) => {
    if (!lid || !pn) return;
    const aliases = db.get('identities', {});
    aliases[String(lid)] = String(pn).includes('@') ? String(pn) : `${String(pn).split(':')[0]}@s.whatsapp.net`;
    const target = aliases[String(lid)];
    aliases[target] = target;
    db.set('identities', aliases);
    clearCanonicalCache(); // 🆔 خريطة الهويات اتحدثت — الكاش القديم ميصلحش
  });

  // 📊 الداشبورد: قايمة الجروبات الحية
  setGroupsProvider(async () => {
    const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
    return Object.values(groups).map((g) => ({ subject: g.subject, size: g.participants?.length ?? 0 }));
  });

  // 📣 المجدول: تذكيرات + صباح الخير + التحدي اليومي + متابعة الغايبين + صدارة الجمعة
  // ⛔ بنوقف المجدول القديم الأول — من غير كده كل إعادة اتصال بتسيب
  // interval شغّال جديد وبيشتغلوا كلهم على نفس الـ DB
  stopScheduler?.();
  stopScheduler = startScheduler(sock);

  // 🚨 كشف Raid: دخلوا 5+ أعضاء في دقيقة → قفل تلقائي للجروب + تنبيه المالك
  const raidMap = new Map();
  sock.ev.on('group-participants.update', async (event) => {
    // ⚠️ كان بيفكك الـ event في برميتار الدالة من غير try/catch — أي error هنا
    // كان unhandled rejection. كمان بيموت أول ما participants تبقى مش array.
    try {
      const { id, participants, action } = event ?? {};
      if (action !== 'add' || !Array.isArray(participants) || !participants.length) return;
      const now = Date.now();
      const joins = (raidMap.get(id) ?? []).filter((t) => now - t < 60000);
      joins.push(now);
      raidMap.set(id, joins);
      if (joins.length >= 5) {
        raidMap.set(id, []);
        await sock.groupSettingUpdate(id, 'announcement'); // قفل الجروب (أدمن بس يكتب)
        await sock.sendMessage(id, { text: '🚨 اتحشر ضغط دخول! الجروب اتقفل مؤقتًا لحمايته — الأدمن يفتحه من إعدادات واتساب' });
        const ownerNum = config.owners?.[0];
        if (ownerNum) {
          await sock.sendMessage(`${ownerNum}@s.whatsapp.net`, {
            text: `🚨 Raid محتمل في جروب (${id.slice(0, 15)}...): دخلوا ${joins.length} أعضاء في دقيقة — الجروب اتقفل تلقائيًا`,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('⚠️ كشف Raid فشل:', err.message?.slice(0, 60));
    }
  });

  // 🔔 تنبيه المالك بأخطاء الـ API الحرجة (لو رقمه متسجل)
  const ownerNum = config.owners?.[0];
  if (ownerNum) {
    const ownerJid = `${String(ownerNum).replace(/\D/g, '')}@s.whatsapp.net`;
    setOwnerNotifier((text) => {
      sock.sendMessage(ownerJid, { text }).catch(() => {});
    });
  }

  // 👋 الترحيب/الوداع + إزالة المحظور عند دخوله مجددًا
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      if (!Array.isArray(participants) || !participants.length) return;
      const s = getSettings(id);
      const meta = await sock.groupMetadata(id).catch(() => null);
      const groupName = String(meta?.subject ?? 'الجروب');

      for (const p of participants) {
        const jid = typeof p === 'string' ? p : (p?.id ?? p?.jid);
        if (!jid) continue;

        if (action === 'add' && s.banned) {
          const canonical = resolveKey(jid) ?? jid;
          const digits = String(jid).split(':')[0].split('@')[0];
          const banned = s.banned[canonical] ?? s.banned[jid] ??
            Object.keys(s.banned).find((k) => k.split('@')[0] === digits);
          if (banned) {
            await sock.groupParticipantsUpdate(id, [jid], 'remove').catch((err) => {
              console.warn('⚠️ تعذرت إزالة عضو محظور:', err.message?.slice(0, 70));
            });
            await sock.sendMessage(id, {
              text: `🚫 تمت إزالة @${digits} من القائمة السوداء. (ملاحظة: واتساب لا يمنع إعادة الدعوة نهائيًا)`,
              mentions: [jid],
            }).catch(() => {});
            continue;
          }
        }

        let template = null;
        if (action === 'add' && s.welcome) template = s.welcomeText;
        if (action === 'remove' && s.goodbyeText) template = s.goodbyeText;
        if (typeof template !== 'string' || !template) continue;
        const text = template
          .replaceAll('{user}', '@' + String(jid).split('@')[0])
          .replaceAll('{group}', groupName);
        await sock.sendMessage(id, { text, mentions: [jid] });
      }
    } catch (err) {
      console.error('⚠️ خطأ في ترحيب/إدارة الأعضاء:', err.message);
    }
  });
}

function onConnectionUpdate(sock, { connection, lastDisconnect, qr }) {
  // 🔢 ربط بكود الهاتف (لو مفعّل في الإعدادات)
  if (qr && config.pairingPhone && !sock.authState?.creds?.registered) {
    const phone = String(config.pairingPhone).replace(/\D/g, '');
    sock.requestPairingCode(phone)
      .then((code) => {
        const pretty = code?.match(/.{1,4}/g)?.join('-') ?? code;
        console.log(`\n🔢 كود الربط: ${pretty}`);
        console.log('اكتبه في: واتساب → الأجهزة المرتبطة → ربط ببكود الهاتف\n');
      })
      .catch((err) => console.error('❌ فشل توليد كود الربط:', err));
    return;
  }

  // 📷 ربط برمز QR
  if (qr) {
    saveQr(qr);
    console.log('\n📲 افتح واتساب → الأجهزة المرتبطة → ربط جهاز، وامسح الكود ده:\n');
    qrcode.generate(qr, { small: true });
  }

  if (connection === 'open') {
    saveQr('');
    resetReconnectBackoff();
    const number = sock.user?.id?.split(':')[0] ?? '';
    console.log(`\n✅ ${config.botName} ${config.botEmoji} شغال! (مرتبط بـ ${number})`);
    console.log(`🧩 البادئة: ${config.prefix} — جرّب اكتب ${config.prefix}menu في أي شات\n`);
  }

  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    if (code === DisconnectReason.loggedOut) {
      console.log('❌ الجلسة اتسجلت خروج — بنمسح بيانات المصادقة بس');
      // ⚠️ كان بيمسح SESSION_DIR كله — وده على Railway فيه data/db.json
      // (لأن DATA_DIR = session/data) يعني كل ذاكرة الناس والاقتصاد
      // والتذكيرات اتمسحت مع ملفات الدخول. دلوقتي بنمسح المصادقة بس.
      clearAuthFiles();
      return;
    }

    // ⛔ إعادة اتصال واحدة بس في نفس الوقت
    if (reconnecting) {
      console.log('⏳ في إعادة اتصال جارية بالفعل — مستني');
      return;
    }
    reconnecting = true;

    // 📈 backoff: 3ث → 6ث → 12ث → 30ث (الحد الأقصى). قبل كده كان بيحاول
    // كل 3 ثواني للأبد لو الشبكة تعبانة = إعادة تحميل كل الأوامر + intervals
    // جديدة في كل مرة.
    const delay = Math.min(30000, 3000 * 2 ** Math.min(reconnectAttempts, 4));
    reconnectAttempts++;
    console.log(`🔄 الاتصال قطع (كود ${code}) — إعادة الاتصال بعد ${delay / 1000} ثانية...`);

    setTimeout(() => {
      startBot()
        .catch((err) => console.error('❌ فشل إعادة الاتصال:', err))
        .finally(() => {
          reconnecting = false;
        });
    }, delay);
  }
}

// 🧹 مسح ملفات المصادقة فقط — سيب مجلد data (الذاكرة/الاقتصاد) زي ما هو
function clearAuthFiles() {
  try {
    if (!fs.existsSync(SESSION_DIR)) return;
    for (const name of fs.readdirSync(SESSION_DIR)) {
      // ملفات المصادقة بس: creds + مفاتيح الإشارات
      if (name === 'creds.json' || name === 'creds.json.bak' || name.startsWith('app-state')) {
        fs.rmSync(join(SESSION_DIR, name), { force: true });
      }
    }
    // ملفات الـ lid/device-list موجودة في مجلد فرعي جوه session
    for (const sub of ['lid-mapping', 'device-list', 'pre-key']) {
      const dir = join(SESSION_DIR, sub);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('⚠️ فشل تنظيف ملفات المصادقة:', err.message);
  }
}

// نتفادى إعادة تحميل الأوامر مرتين لو اتصلح الاتصال بسرعة
function resetReconnectBackoff() {
  if (reconnecting) reconnectAttempts = 0;
}
