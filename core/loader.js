import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ARABIC_ALIASES, normalizeArabic } from './arabic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = join(__dirname, '..', 'commands');

// كل أمر = ملف .js جوه فولدر القسم بتاعه، بيعمل export default
// الملف لازم يكون فيه: name + execute() — الباقي اختياري
export async function loadCommands() {
  const commands = new Map();   // الاسم والبدائل → الأمر
  const categories = new Map(); // الفئة → قائمة الأوامر
  const collisions = [];
  const errors = [];

  const folders = readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of folders) {
    if (!categories.has(folder)) categories.set(folder, []);
    const catDir = join(COMMANDS_DIR, folder);

    for (const file of readdirSync(catDir)) {
      if (!file.endsWith('.js')) continue;
      const path = join(catDir, file);
      try {
        const mod = await import(pathToFileURL(path).href);
        const cmd = mod.default ?? mod;
        if (!cmd || typeof cmd !== 'object' || !cmd.name || typeof cmd.execute !== 'function') {
          throw new Error('لازم export default فيه name و execute()');
        }
        cmd.category = folder;
        cmd.file = path;
        register(commands, categories, cmd, collisions);
      } catch (err) {
        errors.push(`${folder}/${file} → ${err.message}`);
      }
    }
  }

  return { commands, categories, errors, collisions };
}

function register(commands, categories, cmd, collisions) {
  // 🧠 الصيغ العربية: من القاموس + من aliases + تطبيع عربي (تطبيع كل الاسم)
  const arabicFromDict = ARABIC_ALIASES[cmd.name] ?? [];
  const names = [cmd.name, ...(cmd.aliases ?? []), ...arabicFromDict];

  // إضافة النسخة العربية المُطبَّعة من كل اسم (عشان "الاغنيه" = "اغنية")
  const all = [...names];
  for (const n of names) {
    const norm = normalizeArabic(n);
    if (norm && norm !== n) all.push(norm);
  }

  cmd.allNames = all;
  for (const name of all) {
    const key = name.toLowerCase();
    const existing = commands.get(key);
    if (existing && existing !== cmd) {
      collisions.push({ alias: key, winner: existing.name, shadowed: cmd.name });
      continue; // نحافظ على السلوك السابق لكن ما نخفيش التعارض عن الفحوص.
    }
    if (!existing) commands.set(key, cmd);
  }
  categories.get(cmd.category).push(cmd);
}
