import http from 'node:http';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fullSnapshot } from './stats.js';
import { db } from './db.js';
import { config } from '../config.js';
import {
  isDbConnected,
  isDbConfigured,
  exportSessionDump,
  importSessionDump,
} from './postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, '..', 'session');
// ☁️ على المنصات السحابية ملف الـ QR جوّه مجلد data أو session
export const QR_FILE = join(
  __dirname,
  '..',
  process.env.RAILWAY_ENVIRONMENT ? 'session' : 'data',
  'qr.txt',
);

function readQr() {
  try {
    return fs.readFileSync(QR_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

// نسخة نصية احتياطية تظهر جوا الصفحة لو الصورة ما اترسمتش
function asciiQr(text) {
  let out = '';
  qrcodeTerminal.generate(text, { small: true }, (s) => { out = s; });
  return out;
}

// 📊 NOVA DASHBOARD + صفحة الـ QR في سيرفر واحد محلي
const PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>ASTRO BOT ⚡ — لوحة التحكم</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { background:#0b141a; color:#e9edef; font-family:'Segoe UI',Tahoma,sans-serif; margin:0; padding:24px; }
  h1 { text-align:center; margin:6px 0 20px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; max-width:960px; margin:0 auto; }
  .card { background:#1f2c34; border-radius:14px; padding:16px; text-align:center; }
  .card .num { font-size:28px; font-weight:bold; color:#00a884; }
  .card .lbl { color:#8696a0; font-size:13px; margin-top:4px; }
  .wide { max-width:960px; margin:14px auto 0; background:#1f2c34; border-radius:14px; padding:16px; }
  .wide h3 { margin:0 0 10px; color:#00a884; }
  .row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #2a3942; font-size:14px; }
  .row:last-child { border-bottom:none; }
  .ok { color:#00a884; } .bad { color:#f15c6d; }
  img { background:#fff; border-radius:16px; padding:12px; display:block; margin:10px auto; min-width:260px; min-height:260px; }
  #qrbox { text-align:center; }
  #status { font-weight:600; color:#00a884; margin:8px 0; }
  small { color:#8696a0; }
</style>
</head>
<body>
<h1>⚡ NOVA DASHBOARD</h1>
<div class="wide" id="qrbox">
  <h3>📲 ربط جهاز جديد بالواتساب</h3>
  <img id="qr" src="/qr.png" alt="كود QR">
  <div id="status">⏳ جارٍ تجهيز كود الربط...</div>
  <small>افتح واتساب على هاتفك → الأجهزة المرتبطة → ربط جهاز — وامسح الكود</small>
</div>
<div class="grid" id="cards">
  <div class="card"><div class="num" id="c-status">🟡 جارٍ الفحص</div><div class="lbl">حالة البوت</div></div>
  <div class="card"><div class="num" id="c-uptime">0 ثانية</div><div class="lbl">مدة التشغيل</div></div>
  <div class="card"><div class="num" id="c-msgs">0</div><div class="lbl">الرسايل</div></div>
  <div class="card"><div class="num" id="c-cmds">0</div><div class="lbl">الأوامر</div></div>
  <div class="card"><div class="num" id="c-db">🐘 فحص</div><div class="lbl">قاعدة البيانات</div></div>
  <div class="card"><div class="num" id="c-api">🟢 شغال</div><div class="lbl">حالة API</div></div>
  <div class="card"><div class="num" id="c-mem">0</div><div class="lbl">في الذاكرة</div></div>
</div>
<div class="wide" style="text-align:center;padding:12px;">
  <a href="/api/session/export" download="nova-session-backup.json" style="color:#00a884;text-decoration:none;font-weight:bold;font-size:13px;background:#111b21;padding:8px 16px;border-radius:8px;display:inline-block;border:1px solid #2a3942;">💾 تحميل نسخة احتياطية من الجلسة</a>
</div>
<div class="wide"><h3>👥 الناس اللي في ذاكرة استرو</h3><div id="people"><div class="row">جارٍ التحميل...</div></div></div>
<div class="wide"><h3>💬 الجروبات</h3><div id="groups"><div class="row">جارٍ التحميل...</div></div></div>
<div class="wide"><h3>🧾 آخر الأوامر</h3><div id="lastcmds"><div class="row">لسه مفيش أوامر</div></div></div>
<small style="display:block;text-align:center;margin-top:16px">البيانات بتتجدد تلقائيًا كل 3 ثواني • لوحة تحكم سريعة</small>
<script>
const TOKEN = new URLSearchParams(location.search).get('token') ?? '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtUptime = (ms) => { const s = Math.floor(ms/1000); const h = Math.floor(s/3600), m = Math.floor(s%3600/60); return h ? h + ' ساعة ' + m + ' دقيقة' : m + ' دقيقة ' + (s%60) + ' ثانية'; };

const qrImg = document.getElementById('qr');
qrImg.onerror = () => {
  document.getElementById('status').textContent = '⏳ جاري توليد كود الـ QR...';
};
qrImg.onload = () => {
  document.getElementById('status').textContent = '📲 امسح الكود الآن لربط الواتساب';
};

async function tick() {
  try {
    const r = await fetch('/stats?token=' + TOKEN, { signal: AbortSignal.timeout(2500) });
    const d = await r.json();

    document.getElementById('c-status').textContent = d.connected ? '🟢 متصل' : '🟡 بانتظار المسح';
    document.getElementById('c-uptime').textContent = fmtUptime(d.uptime || 0);
    document.getElementById('c-msgs').textContent = d.messages || 0;
    document.getElementById('c-cmds').textContent = d.commands || 0;
    document.getElementById('c-db').textContent = d.database?.connected ? '🐘 متصلة' : (d.database?.configured ? '🟡 سحابية' : '📁 محلي');
    document.getElementById('c-api').textContent = d.apiStatus === 'ok' ? '🟢 شغال' : '🔴 وضع آمن';
    document.getElementById('c-mem').textContent = (d.people ?? []).length + ' شخص';

    document.getElementById('people').innerHTML = (d.people ?? []).map(p =>
      '<div class="row"><span>' + esc(p.name) + '</span><span>💭 ' + p.memories + ' ذكرى • قبل ' + p.ago + '</span></div>'
    ).join('') || '<div class="row">لسه مفيش أحد في الذاكرة</div>';

    document.getElementById('groups').innerHTML = (d.groups ?? []).map(g =>
      '<div class="row"><span>' + esc(g.subject) + '</span><span>' + g.size + ' عضو</span></div>'
    ).join('') || '<div class="row">البوت مش متصل بجروبات حالياً</div>';

    document.getElementById('lastcmds').innerHTML = (d.lastCommands ?? []).map(c =>
      '<div class="row"><span>' + esc(c) + '</span></div>'
    ).join('') || '<div class="row">لسه مفيش أوامر متسجلة</div>';

    const qrbox = document.getElementById('qrbox');
    if (!d.connected) {
      qrbox.style.display = 'block';
      qrImg.src = '/qr.png?t=' + Date.now();
    } else {
      qrbox.style.display = 'none';
    }
  } catch (err) {
    console.warn('Dashboard fetch retry:', err.message);
  }
}
setInterval(tick, 3000);
tick();
</script>
</body>
</html>`;

// ⚠️ استماع على 0.0.0.0 للسماح بالوصول عبر السحابة والبروكسي (Cranl / Railway / Docker)
export function startQrServer(port = 3000) {
  const isCloud = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.CRANL || process.env.NODE_ENV === 'production' || !!process.env.PORT;
  let authToken = config.dashToken || '';
  if (!authToken && isCloud) {
    authToken = randomBytes(16).toString('hex');
    console.log(`🔐 DASH_TOKEN مش متحدد — ولّدت توكن اختياري للداشبورد:\n   ?token=${authToken}`);
  }

  const server = http.createServer(async (req, res) => {
    try {
      // 🩺 فحص الصحة للسحابة والكونتينر
      if (req.url === '/health' || req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: config.botName }));
        return;
      }

      // 🔐 حماية الإحصائيات الحساسة بكلمة سر لو تم تحديد DASH_TOKEN
      if (config.dashToken && req.url.startsWith('/stats')) {
        const url = new URL(req.url, 'http://x');
        if (url.searchParams.get('token') !== config.dashToken) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
      }

      // صورة QR — بتتولد محليًا كـ PNG
      if (req.url.startsWith('/qr.png')) {
        const qr = readQr();
        if (!qr) {
          res.writeHead(404);
          res.end();
          return;
        }
        const buf = await QRCode.toBuffer(qr, { width: 420, margin: 2 });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        res.end(buf);
        return;
      }

      // بيانات JSON للـ QR + النسخة النصية الاحتياطية
      if (req.url.startsWith('/qr')) {
        const qr = readQr();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ qr, ascii: qr ? asciiQr(qr) : '' }));
        return;
      }

      // 💾 تصدير نسخة احتياطية من الجلسة
      if (req.url === '/api/session/export') {
        const dump = await exportSessionDump(SESSION_DIR);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="nova-session-backup.json"',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(dump, null, 2));
        return;
      }

      // 📥 استيراد نسخة احتياطية للجلسة
      if (req.url === '/api/session/import' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            const count = await importSessionDump(SESSION_DIR, parsed);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, count }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // 📊 بيانات الداشبورد الحية
      if (req.url.startsWith('/stats')) {
        const snap = await fullSnapshot();
        const users = db.get('users', {});
        const people = Object.entries(users).map(([k, p]) => {
          const ago = p.lastSeen ? Math.round((Date.now() - p.lastSeen) / 3600000) : null;
          return {
            name: p.name ?? k.split('@')[0],
            memories: (p.memories ?? []).length,
            ago: ago === null ? '—' : ago < 1 ? 'دقايق' : ago + ' ساعة',
          };
        });
        const connected = typeof snap.connected === 'boolean' ? snap.connected : !readQr();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({
          ...snap,
          people,
          connected,
          database: {
            connected: isDbConnected(),
            configured: isDbConfigured(),
          },
        }));
        return;
      }

      // 📊 صفحة الداشبورد (بتحتوي كمان قسم الـ QR)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(PAGE);
    } catch (err) {
      console.error('❌ خطأ في الداشبورد:', err.message);
      res.writeHead(500);
      res.end('error');
    }
  });

  const host = '0.0.0.0';
  server.on('error', (err) => {
    console.error('❌ سيرفر الداشبورد فشل:', err.message);
  });
  server.listen(port, host, () => {
    console.log(`🌐 لوحة التحكم: http://0.0.0.0:${port}`);
  });
  return server;
}
