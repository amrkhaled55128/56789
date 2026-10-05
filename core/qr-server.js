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

const __dirname = dirname(fileURLToPath(import.meta.url));
// ☁️ على Railway ملف الـ QR جوّه الـ volume — ومُصدَّر عشان connection.js
// تكتب فيه على نفس المسار بالظبط (كان محسوب مرتين في ملفين لوحدهم)
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
  img { background:#fff; border-radius:16px; padding:12px; display:block; margin:10px auto; }
  #qrbox { text-align:center; display:none; }
  small { color:#8696a0; }
</style>
</head>
<body>
<h1>⚡ NOVA DASHBOARD</h1>
<div class="grid" id="cards"></div>
<div class="wide"><h3>👥 الناس اللي في ذاكرة استرو</h3><div id="people"></div></div>
<div class="wide"><h3>💬 الجروبات</h3><div id="groups"></div></div>
<div class="wide"><h3>🧾 آخر الأوامر</h3><div id="lastcmds"></div></div>
<div class="wide" id="qrbox"><h3>📲 ربط جهاز جديد</h3>
  <img id="qr" alt="QR">
  <div id="status"></div>
  <small>افتح واتساب → الأجهزة المرتبطة → ربط جهاز — وامسح من الكمبيوتر</small>
</div>
<small style="display:block;text-align:center;margin-top:16px">البيانات بتتجدد تلقائيًا كل 5 ثواني • الصفحة دي محلية على جهازك بس</small>
<script>
const TOKEN = new URLSearchParams(location.search).get('token') ?? '';
// 🔒 escape HTML — الأسماء والجروبات جايين من واتساب (أي حد يقدر يسمّي نفسه
// "<img onerror=...>") فمنحقنهمش خام في innerHTML
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtUptime = (ms) => { const s = Math.floor(ms/1000); const h = Math.floor(s/3600), m = Math.floor(s%3600/60); return h ? h + ' ساعة ' + m + ' دقيقة' : m + ' دقيقة ' + (s%60) + ' ثانية'; };
async function tick() {
  try {
    const r = await fetch('/stats?token=' + TOKEN);
    const d = await r.json();
    document.getElementById('cards').innerHTML = [
      ['حالة البوت', d.connected ? '🟢 متصل' : '🟡 مستني المسح'],
      ['مدة التشغيل', fmtUptime(d.uptime)],
      ['الرسايل', d.messages],
      ['الأوامر', d.commands],
      ['ردود الذكاء', d.aiReplies],
      ['صوتيات', d.voices],
      ['ملصقات', d.stickers],
      ['تحميلات', d.downloads],
      ['حالة API', d.apiStatus === 'ok' ? '🟢 شغال' : '🔴 وضع آمن'],
      ['في الذاكرة', (d.people ?? []).length + ' شخص'],
    ].map(([l, n]) => '<div class="card"><div class="num">' + n + '</div><div class="lbl">' + l + '</div></div>').join('');

    document.getElementById('people').innerHTML = (d.people ?? []).map(p =>
      '<div class="row"><span>' + esc(p.name) + '</span><span>💭 ' + p.memories + ' ذكرى • قبل ' + p.ago + '</span></div>'
    ).join('') || '<div class="row">لسه مفيش أحد</div>';

    document.getElementById('groups').innerHTML = (d.groups ?? []).map(g =>
      '<div class="row"><span>' + esc(g.subject) + '</span><span>' + g.size + ' عضو</span></div>'
    ).join('') || '<div class="row">البوت مش في جروبات</div>';

    document.getElementById('lastcmds').innerHTML = (d.lastCommands ?? []).map(c =>
      '<div class="row"><span>' + esc(c) + '</span></div>'
    ).join('') || '<div class="row">لسه مفيش أوامر</div>';

    const qrbox = document.getElementById('qrbox');
    if (!d.connected) {
      qrbox.style.display = 'block';
      document.getElementById('qr').src = '/qr.png?t=' + Date.now() + '&token=' + TOKEN;
      document.getElementById('status').textContent = '⏳ بانتظار المسح — الكود بيتجدد لوحده';
    } else {
      qrbox.style.display = 'none';
    }
  } catch {}
}
setInterval(tick, 5000);
tick();
</script>
</body>
</html>`;

// ⚠️ محليًا على 127.0.0.1 — وعلى السحابة محمي بكلمة سر (DASH_TOKEN)
export function startQrServer(port = 3000) {
  const isCloud = !!process.env.RAILWAY_ENVIRONMENT;
  // 🔐 على السحابة مفيش وضع بدون حماية: لو DASH_TOKEN فاضي بنولّد توكن
  // عشوائي ونطبعه في اللوج — السيرفر بيسمع على 0.0.0.0 وذاكرة الناس مش
  // حاجة تتحط مفتوحة على النت.
  let authToken = config.dashToken || '';
  if (!authToken && isCloud) {
    authToken = randomBytes(16).toString('hex');
    console.log(`🔐 DASH_TOKEN مش متحدد — ولّدت توكن مؤقت للداشبورد:\n   ?token=${authToken}`);
  }

  const server = http.createServer(async (req, res) => {
    try {
      // 🔐 حماية بالتوكن (السحابة، أو لو المالك حدد توكن محليًا)
      if (authToken) {
        const url = new URL(req.url, 'http://x');
        if (url.searchParams.get('token') !== authToken) {
          res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<body style="background:#0b141a;color:#e9edef;font-family:sans-serif;text-align:center;padding-top:40vh">🔐 الداشبورد محمي — ضيف <code>?token=xxxx</code></body>');
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
        // 🔗 حالة الاتصال الحقيقية من stats (setConnected مربوطة بـ connection.update)
        // — ومطمنين من ملف الـ QR لو البوت لسه ماقالش حالته. قبلكان ملف QR فاضي
        // كان معناه «متصل» حتى وهو متسجل خروج!
        const connected = typeof snap.connected === 'boolean' ? snap.connected : !readQr();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ...snap, people, connected }));
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
  // ☁️ على Railway: بيسمع على كل الواجهات بالمنفذ بتاعهم
  const host = isCloud ? '0.0.0.0' : '127.0.0.1';
  server.on('error', (err) => {
    // ⚠️ من غير handler: حدث 'error' من غير مستمع بيعمل throw → index.js كان
    // بيبتلعه → البوت بيفضل شغّال بس مفيش HTTP listener، وRailway شايفه شغّال
    // والسيرفر مش بيرد على حد.
    console.error('❌ سيرفر الداشبورد فشل:', err.message);
  });
  server.listen(port, host, () => {
    console.log(`🌐 لوحة التحكم: http://localhost:${port}`);
  });
  return server;
}
