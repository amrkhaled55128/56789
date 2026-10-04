/** اختبارات fetchMedia محلية على localhost فقط: redirect، meta refresh، ورفض HTML. */
import http from 'node:http';
import { fetchMedia } from '../core/fetchmedia.js';

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) pass++; else fail++;
}

const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(2000)]);
const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.alloc(2000)]);
const server = http.createServer((req, res) => {
  if (req.url === '/redirect') { res.writeHead(302, { location: '/audio.mp3' }); return res.end(); }
  if (req.url === '/meta') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<meta http-equiv="refresh" content="0; url=/audio.mp3">');
  }
  if (req.url === '/audio.mp3') { res.writeHead(200, { 'content-type': 'audio/mpeg' }); return res.end(mp3); }
  if (req.url === '/video.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(mp4); }
  if (req.url === '/html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>not a media file</html>'); }
  res.writeHead(404); res.end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
try {
  const a = await fetchMedia(`${base}/redirect`, { expect: 'audio' });
  check('يتبع HTTP redirect ويرجع audio buffer', a.kind === 'audio' && a.buffer.length === mp3.length);
  const b = await fetchMedia(`${base}/meta`, { expect: 'audio' });
  check('يتبع meta-refresh داخل HTML', b.kind === 'audio');
  const c = await fetchMedia(`${base}/video.mp4`, { expect: 'video' });
  check('يقرأ MP4 مباشر', c.kind === 'video');
  let rejected = false;
  try { await fetchMedia(`${base}/html`, { expect: 'audio' }); } catch (err) { rejected = /صفحة ويب/.test(err.message); }
  check('يرفض HTML بدل ما يمرره كملف', rejected);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log(`\n✅ ${pass} | ❌ ${fail}`);
process.exit(fail ? 1 : 0);
