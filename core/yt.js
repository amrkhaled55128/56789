import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import api from './api.js';
import { fetchMedia, toMp4 } from './fetchmedia.js';

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
  const isWin = process.platform === 'win32';
  const name = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const downloadFile = isWin ? 'yt-dlp.exe' : 'yt-dlp_linux';
  const dir = path.join(HERE, '..', 'node_modules', 'youtube-dl-exec', 'bin');
  const dest = path.join(dir, name);
  const temp = `${dest}.download`;
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${downloadFile}`;

  await fs.mkdir(dir, { recursive: true });
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1_000_000 || bytes.length > 100 * 1024 * 1024) {
    throw new Error(`حجم binary غير متوقع: ${bytes.length}`);
  }
  // التحقق من صحة الملف التنفيذي
  const isElf = bytes[0] === 0x7f && bytes.subarray(1, 4).toString() === 'ELF';
  const isExe = bytes.subarray(0, 2).toString() === 'MZ';
  const isScript = bytes.subarray(0, 2).toString() === '#!' || bytes.subarray(0, 2).toString() === 'PK';

  if (!isWin && !isElf && !isScript) {
    throw new Error('الرد ليس ملف تنفيذي صالح للينكس');
  }
  if (isWin && !isExe) {
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
    // 1) فحص وجود yt-dlp في النظام مباشرة (Nixpacks / Linux / PATH)
    if (await executable('yt-dlp')) {
      binPath = 'yt-dlp';
      return binPath;
    }

    let candidate = null;
    try {
      candidate = youtubedl.binaryPath ? await youtubedl.binaryPath() : null;
    } catch {
      candidate = null;
    }

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
 * ينزّل من يوتيوب/فيسبوك/تيك توك ويرجّع Buffer
 * @param {string} url
 * @param {'audio'|'video'} kind
 */
export async function downloadYoutube(url, kind = 'audio', { height = 720, timeout = 120000 } = {}) {
  const bin = await ytdlBin();
  if (bin) {
    try {
      return await withTempDir(async (dir) => {
        const args = [
          '--proxy', '',
          '--no-warnings',
          '--no-playlist',
          '--no-progress',
          '--no-check-certificate',
          '-o', path.join(dir, 'media.%(ext)s'),
        ];
        let fDir = null;
        if (ffmpegPath) {
          try {
            if (await fs.access(ffmpegPath).then(() => true).catch(() => false)) {
              fDir = path.dirname(ffmpegPath);
            }
          } catch {}
        }
        if (fDir) {
          args.push('--ffmpeg-location', fDir);
        }
        if (kind === 'audio') {
          args.push('-x', '--audio-format', 'mp3', '--audio-quality', '128K', '-f', 'bestaudio/ba/b');
        } else {
          // 🎬 واتساب موبايل بيشترط كوديك H.264 AVC1 وصوت AAC مع yuv420p لتشغيل الفيديو
          args.push(
            '-f', `bv*[vcodec^=avc][height<=${height}]+ba[acodec^=mp4a]/bv*[vcodec^=avc]+ba/b[vcodec^=avc][height<=${height}]/bv*[height<=${height}]+ba/b`,
            '--merge-output-format', 'mp4',
            '--recode-video', 'mp4',
            '--postprocessor-args', 'ffmpeg_video:-pix_fmt yuv420p -movflags +faststart'
          );
        }
        args.push(url);

        const { stderr } = await run(bin, args, { timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
        const files = await fs.readdir(dir);
        const found = files.find((f) => !f.endsWith('.part'));
        if (!found) throw new Error(`yt-dlp ماخلّيش ملف: ${String(stderr).slice(-120)}`);
        const rawBuf = await fs.readFile(path.join(dir, found));
        if (kind === 'video' && !found.endsWith('.mp4')) {
          return await toMp4(rawBuf, { height }).catch(() => rawBuf);
        }
        return rawBuf;
      });
    } catch (err) {
      console.error('⚠️ yt-dlp فشل:', String(err.stderr ?? err.message).slice(0, 100));
    }
  }

  throw new Error(bin
    ? 'تعذر التحميل عبر المحرك المحلي؛ يرجى التحقق من الرابط'
    : 'محرك التحميل غير متاح حالياً');
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
