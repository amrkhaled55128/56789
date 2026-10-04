import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import api from './api.js';
import { fetchMedia } from './fetchmedia.js';

// 📍 مسار المجلد — المسار فيه مسافة ("New folder") فبنستخدم fileURLToPath
// بدل import.meta.url مباشرة (التاني بيسيب %20 في المسار)
const HERE = path.dirname(fileURLToPath(import.meta.url));

// 🎬 محمّل يوتيوب حقيقي
//
// المشكلة: API بتاع engez بيرجّع لينك savenow.to، والدومينات دي بقت
// صفحات إعلانات (domain parking) — فبيطلع HTML مش ملف، وواتساب بيرفض.
// ytdl-core بيقفل من يوتيوب (الاستخراج بالـ signature).
// الحل: yt-dlp (باينري مستقل) أول حاجة، وبعده API كاحتياط، وأخيراً
//Media URLLoader مع حل التحويلات.
//
// ملاحظة: الباينري بيتنزل وقت npm install (postinstall) — لو مش موجود
// (build من غير سكربتات) بنتخطىsource وندخل على الـAPI بدري.

let binPath = null;
let binChecked = false;
let binPromise = null;

// تنزيل provisioning يعمل مرة واحدة، بحد أقصى 180 ثانية و100MB.
async function downloadBinary() {
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const dir = path.join(HERE, '..', 'node_modules', 'youtube-dl-exec', 'bin');
  const dest = path.join(dir, name);
  const temp = `${dest}.download`;
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${name}`;

  await fs.mkdir(dir, { recursive: true });
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1_000_000 || bytes.length > 100 * 1024 * 1024) {
    throw new Error(`حجم binary غير متوقع: ${bytes.length}`);
  }
  // HTML error page أو rate limit ممكن يرجع 200؛ لا نحفظه كملف تنفيذي.
  if (process.platform !== 'win32' && !(bytes[0] === 0x7f && bytes.subarray(1, 4).toString() === 'ELF')) {
    throw new Error('الرد ليس Linux ELF binary');
  }
  if (process.platform === 'win32' && bytes.subarray(0, 2).toString() !== 'MZ') {
    throw new Error('الرد ليس Windows executable');
  }
  await fs.writeFile(temp, bytes);
  await fs.chmod(temp, 0o755).catch(() => {});
  await fs.rename(temp, dest);
  return dest;
}

async function executable(pathname) {
  if (!pathname || !(await fs.access(pathname).then(() => true).catch(() => false))) return false;
  try {
    const { stdout } = await run(pathname, ['--version'], { timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true });
    return /^\d{4}\.\d{2}\.\d{2}/.test(stdout.trim());
  } catch {
    return false;
  }
}

async function ytdlBin() {
  if (binChecked) return binPath;
  if (binPromise) return binPromise;
  binPromise = (async () => {
    let candidate = null;
    try {
      candidate = youtubedl.binaryPath ? await youtubedl.binaryPath() : null;
    } catch {
      candidate = null;
    }

    // binaryPath() بيرجّع المسار حتى لو postinstall اتخطّى التنزيل.
    if (await executable(candidate)) {
      binPath = candidate;
      return binPath;
    }

    const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const bundled = path.join(HERE, '..', 'node_modules', 'youtube-dl-exec', 'bin', name);
    if (await executable(bundled)) {
      binPath = bundled;
      return binPath;
    }

    try {
      console.log('⬇️ yt-dlp مش موجود — تنزيله مرة واحدة…');
      candidate = await downloadBinary();
      if (!(await executable(candidate))) throw new Error('yt-dlp --version فشل');
      binPath = candidate;
      console.log('✅ yt-dlp جاهز');
    } catch (err) {
      binPath = null;
      console.error('⚠️ yt-dlp غير متاح:', err.message?.slice(0, 80));
    }
    return binPath;
  })().finally(() => {
    binChecked = true;
    binPromise = null;
  });
  return binPromise;
}

export async function ytdlAvailable() {
  return !!(await ytdlBin());
}

const run = promisify(execFile);

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'astro-dl-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * ينزّل من يوتيوب ويرجّع Buffer
 * @param {string} url
 * @param {'audio'|'video'} kind
 */
export async function downloadYoutube(url, kind = 'audio', { height = 720, timeout = 180000 } = {}) {
  const bin = await ytdlBin();
  if (bin) {
    try {
      return await withTempDir(async (dir) => {
        const args = [
          '--no-warnings', '--no-playlist', '--no-call-home', '--no-progress',
          '--no-check-certificate', '--newline',
          '-f', kind === 'audio' ? 'bestaudio/best' : `bestvideo[height<=${height}][ext=mp4]+bestaudio/best[height<=${height}]/best[height<=${height}]/best`,
          '-o', path.join(dir, 'media.%(ext)s'),
          url,
        ];
        if (kind === 'audio') {
          args.unshift('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '128K');
        }
        if (ffmpegPath) args.unshift('--ffmpeg-location', path.dirname(ffmpegPath));

        const { stderr } = await run(bin, args, { timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
        const files = await fs.readdir(dir);
        const found = files.find((f) => !f.endsWith('.part'));
        if (!found) throw new Error(`yt-dlp ماخلّيش ملف: ${String(stderr).slice(-120)}`);
        return await fs.readFile(path.join(dir, found));
      });
    } catch (err) {
      console.error('⚠️ yt-dlp فشل:', String(err.stderr ?? err.message).slice(0, 100));
    }
  }

  // الـAPI الحالي يرجّع SaveNow HTML/إعلانات بدل ملف. لا نعيده كـ fallback
  // لأن المستخدم ينتظر طويلاً ثم يستلم خطأ مؤكد. نعلن الفشل بسرعة وبوضوح.
  throw new Error(bin
    ? 'yt-dlp فشل في الفيديو ده؛ مصدر التحميل الاحتياطي غير متاح حالياً'
    : 'yt-dlp غير متاح على الخادم ومصدر التحميل الاحتياطي غير صالح حالياً');
}

/**
 * بيانات الفيديو (العنوان/المدة/الصورة) — من الـAPI لاكتشاف النتايج
 */
export async function youtubeMeta(url) {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true, noWarnings: true, noCallHome: true, noPlaylist: true,
    });
    return {
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      author: info.uploader ?? info.channel,
    };
  } catch {
    return null;
  }
}
