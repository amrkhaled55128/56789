/**
 * 🔍 فاحص النصوص العربية — بيرفض الحروف اللي بتسرق من لغات تانية.
 *
 * ليه مهم: كذا مرة النص العربي اتلخبط وحطّ كتل صينية/روسية جواه جملة
 * (في كومنتات وكروت بتظهر للمستخدم). الفحص ده بيمنعها قبل النشر.
 *
 * التشغيل: node _test/lint.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ملاحظة: مسار المجلد فيه مسافة ("New folder") فبنستخدم fileURLToPath
// بدل import.meta.url مباشرة — التاني بيسيب %20 في المسار
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'data', 'session', 'backups', '.zcode', 'dist']);

// الحروف اللي المفروض ما تظهرش في كود عربي: صيني/ياباني/كوري + سيريلي + latin مدموج
const SUSPECT = [
  // محرف التلف U+FFFD — بيطلع لما أداة الكتابة تبوّظ النص.
  // طلع فعلي في وصف قسم المنيو (core/menu.js) وكان الفاحص قال "كله نضيف".
  { name: 'محرف تلف (U+FFFD)', re: /\uFFFD/g },
  { name: 'صيني/ياباني/كوري', re: /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g },
  { name: 'سيريلي (روسي)', re: /[\u0400-\u04ff]/g },
  {
    // لاتيني ملزوق بعربي (زي "Combining" أو "duct")
    // نستثني تسلسلات الهروب \n \t \r و HTML entities بتاعة &nbsp;
    name: 'لاتيني مدموج في عربي',
    re: /(?<!\\)[A-Za-z]{2,}(?=[؀-ۿ]) | (?<=[؀-ۿ])[A-Za-z]{2,}(?![A-Za-z0-9_;()\/.-])/g,
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (['.js', '.mjs', '.json', '.md'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const { name, re } of SUSPECT) {
      const hits = line.match(re);
      if (hits) {
        problems.push({ file: file.replace(ROOT, ''), line: i + 1, name, hits: [...new Set(hits)], text: line.trim().slice(0, 90) });
      }
    }
  });
}

if (!problems.length) {
  console.log('✅ مفيش حروف غريبة في أي ملف عربي');
} else {
  console.log(`❌ ${problems.length} سطر فيه نص ملخبط:\n`);
  for (const p of problems) {
    console.log(`  ${p.file}:${p.line}  [${p.name}]  ${p.hits.join(' ')}`);
    console.log(`     ${p.text}`);
  }
}
process.exit(problems.length ? 1 : 0);
