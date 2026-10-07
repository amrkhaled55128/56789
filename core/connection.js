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
import { setGroupsProvider, setApiStatus, setConnected } from './stats.js';
import { db } from './db.js';
import { QR_FILE } from './qr-server.js';
import api, { setOwnerNotifier, onApiStatus } from './api.js';
import {
  restoreSessionFromDb,
  scheduleSessionSync,
  syncSessionToDb,
  clearSessionFromDb,
} from './postgres.js';

const logger = pino({ level: 'silent' });
const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, '..', 'session');

let reconnecting = false;
let reconnectAttempts = 0;
let logoutRestarts = 0;
let stopScheduler = null;
let stopMaint = null;
let stopSweep = null;

function saveQr(qr) {
  fs.mkdirSync(dirname(QR_FILE), { recursive: true });
  fs.writeFileSync(QR_FILE, qr);
}

export async function startBot() {
  await restoreSessionFromDb(SESSION_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  migrateOldData();

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    console.warn('⚠️ مقدرتش أجيب أحدث إصدار واتساب — هستخدم الإصدار المدمج');
  }

  const { commands, categories, errors, collisions, shadowedCount } = await loadCommands();
  if (errors.length) {
    console.warn('⚠️ أوامر اتحملت غلط:');
    errors.forEach((e) => console.warn('   •', e));
  }
  if (collisions.length) {
    console.warn('⚠️ أسماء أوامر متعارضة (الأول كسب):');
    collisions.forEach((c) => console.warn(`   • '${c.alias}' → '${c.winner}' غطّى '${c.shadowed}'`));
  }
  if (shadowedCount) {
    console.warn(`⚠️ ${shadowedCount} أمر كل أسمائه متاخدة — مش هيظهر في المنيو ولا ينفذ`);
  }
  const totalCommands = [...categories.values()].reduce((sum, cmds) => sum + cmds.length, 0);
  console.log(`📦 تم تحميل ${totalCommands} أمر في ${categories.size} قسم${errors.length ? ` (وفشل تحميل ${errors.length})` : ''}`);

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

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    scheduleSessionSync(SESSION_DIR, 2000);
  });
  sock.ev.on('connection.update', (update) => onConnectionUpdate(sock, update));
  sock.ev.on('messages.upsert', (upsert) => handleUpsert(sock, { commands, categories }, upsert));

  setBotIdentity(sock);
  stopMaint?.();
  stopMaint = startMaintenance();
  startCooldownSweep();
  stopSweep?.();
  stopSweep = startProtectionSweep();

  onApiStatus((status, openCount) => setApiStatus(status, openCount));

  sock.ev.on('lid-mapping.update', ({ lid, pn }) => {
    if (!lid || !pn) return;
    const aliases = db.get('identities', {});
    aliases[String(lid)] = String(pn).includes('@') ? String(pn) : `${String(pn).split(':')[0]}@s.whatsapp.net`;
    const target = aliases[String(lid)];
    aliases[target] = target;
    db.set('identities', aliases);
    clearCanonicalCache();
  });

  let cachedGroups = [];
  let lastGroupFetch = 0;
  setGroupsProvider(async () => {
    if (!sock?.user) return [];
    const now = Date.now();
    if (now - lastGroupFetch < 60000 && cachedGroups.length) return cachedGroups;
    try {
      const groups = await Promise.race([
        sock.groupFetchAllParticipating(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
      ]);
      cachedGroups = Object.values(groups || {}).map((g) => ({ subject: g.subject, size: g.participants?.length ?? 0 }));
      lastGroupFetch = now;
      return cachedGroups;
    } catch {
      return cachedGroups;
    }
  });

  stopScheduler?.();
  stopScheduler = startScheduler(sock);

  const raidMap = new Map();
  sock.ev.on('group-participants.update', async (event) => {
    try {
      const { id, participants, action } = event ?? {};
      if (action !== 'add' || !Array.isArray(participants) || !participants.length) return;
      const now = Date.now();
      const joins = (raidMap.get(id) ?? []).filter((t) => now - t < 60000);
      joins.push(now);
      raidMap.set(id, joins);
      if (joins.length >= 5) {
        raidMap.set(id, []);
        await sock.groupSettingUpdate(id, 'announcement');
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

  const ownerNum = config.owners?.[0];
  if (ownerNum) {
    const ownerJid = `${String(ownerNum).replace(/\D/g, '')}@s.whatsapp.net`;
    setOwnerNotifier((text) => {
      sock.sendMessage(ownerJid, { text }).catch(() => {});
    });
  }

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

  if (qr) {
    saveQr(qr);
    console.log('\n📲 افتح واتساب → الأجهزة المرتبطة → ربط جهاز، وامسح الكود ده:\n');
    qrcode.generate(qr, { small: true });
  }

  if (connection === 'open') {
    saveQr('');
    setConnected(true);
    resetReconnectBackoff();
    logoutRestarts = 0;
    const number = sock.user?.id?.split(':')[0] ?? '';
    console.log(`\n✅ ${config.botName} ${config.botEmoji} شغال! (مرتبط بـ ${number})`);
    console.log(`🧩 البادئة: ${config.prefix} — جرّب اكتب ${config.prefix}menu في أي شات\n`);
    syncSessionToDb(SESSION_DIR).catch(() => {});
  }

  if (connection === 'close') {
    setConnected(false);
    const code = lastDisconnect?.error?.output?.statusCode;
    if (code === DisconnectReason.loggedOut) {
      console.log('❌ الجلسة اتسجلت خروج — بنمسح بيانات المصادقة وبنولّد QR جديد');
      clearAuthFiles();
      clearSessionFromDb().catch(() => {});
      logoutRestarts++;
      if (logoutRestarts <= 5) {
        setTimeout(() => {
          startBot().catch((err) => console.error('❌ فشل الإقلاع بعد الـ logout:', err.message));
        }, 2000);
      } else {
        console.error('⛔ الـ logout اتكرر 5 مرات — بنوقف الإقلاع التلقائي، راجع اللوج');
      }
      return;
    }

    if (reconnecting) {
      console.log('⏳ في إعادة اتصال جارية بالفعل — مستني');
      return;
    }
    reconnecting = true;

    const delay = Math.min(30000, 3000 * 2 ** Math.min(reconnectAttempts, 4));
    reconnectAttempts++;
    const reason = DISCONNECT_REASONS[code] ?? 'سبب غير معروف';
    console.log(`🔄 قطع اتصال #${reconnectAttempts} (كود ${code} — ${reason}) — إعادة المحاولة بعد ${delay / 1000} ثانية...`);

    setTimeout(() => {
      startBot()
        .catch((err) => console.error('❌ فشل إعادة الاتصال:', err.message))
        .finally(() => {
          reconnecting = false;
        });
    }, delay);
  }
}

const DISCONNECT_REASONS = {
  [DisconnectReason.connectionClosed]: 'الاتصال اتقفل',
  [DisconnectReason.connectionLost]: 'الاتصال ضاع',
  [DisconnectReason.connectionReplaced]: 'جلسة جديدة فتحت في مكان تاني',
  [DisconnectReason.timedOut]: 'المهلة خلصت',
  [DisconnectReason.restartRequired]: 'محتاج إعادة تشغيل',
  [DisconnectReason.multilogin]: 'تسجيل دخول متعدد',
};

function clearAuthFiles() {
  try {
    if (!fs.existsSync(SESSION_DIR)) return;
    for (const name of fs.readdirSync(SESSION_DIR)) {
      if (name === 'creds.json' || name === 'creds.json.bak' || name.startsWith('app-state')) {
        fs.rmSync(join(SESSION_DIR, name), { force: true });
      }
    }
    for (const sub of ['lid-mapping', 'device-list', 'pre-key']) {
      const dir = join(SESSION_DIR, sub);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('⚠️ فشل تنظيف ملفات المصادقة:', err.message);
  }
}

function resetReconnectBackoff() {
  reconnectAttempts = 0;
}
