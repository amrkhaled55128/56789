import { MB } from '@rexxhayanasi/elaina-baileys';
import { config } from '../config.js';

// 🗂️ نظام التصفّح الهرمي للقائمة — 3 مستويات بأزرار + رجوع دائم
//
// ⚠️ كان في 8 أقسام بس و commands فيها مجلدات كاملة (fun / music /
// protection) مش ظاهرة خالص — 20+ أمر موجود وشغال بس المستخدم ميقدرش يلاقيه.
// كل قسم هنا لازم يكون ليه فولدر مقابل في commands/.
export const SECTIONS = [
  { id: 'ai', label: 'الذكاء', emoji: '🤖', desc: 'اسأل، صور، فيديو، وصف أي صورة' },
  { id: 'games', label: 'الألعاب', emoji: '🎮', desc: 'تحديات، كويز، إكس أو، مسابقات' },
  { id: 'economy', label: 'الاقتصاد', emoji: '💰', desc: 'رصيدك، بنك، متجر، تحويل' },
  { id: 'download', label: 'التحميل', emoji: '📥', desc: 'يوتيوب، فيسبوك، تيك توك، أغاني' },
  { id: 'tools', label: 'الأدوات', emoji: '🛠️', desc: 'ترجمة، ملصقات، تذكيرات، فحص' },
  { id: 'protection', label: 'الحماية', emoji: '🚫', desc: 'حظر، كتم، إنذارات، بلاك ليست' },
  { id: 'group', label: 'الجروبات', emoji: '🛡️', desc: 'إعدادات وإدارة المجموعات' },
  { id: 'music', label: 'الموسيقى والمحتوى', emoji: '🎧', desc: 'شازام، مانجا، روايات، عزل صوت' },
  { id: 'fun', label: 'فرفشة وهزار', emoji: '😂', desc: 'نكت مصرية، الشيشة، مزاج رايق' },
  { id: 'general', label: 'عام', emoji: '📌', desc: 'القائمة، كارت، تعليمات، حالة البوت' },
  { id: 'owner', label: 'المالك', emoji: '👑', desc: 'أوامر وإحصائيات المالك' },
];

// أوامر محتاجة نص — بتعرض الصيغة + زر نسخ بدل ما تفشل
const NEEDS_TEXT = /<|\[|اسم|نص|الرابط|لينك|رقم|فارغ|https?:|http:/i;

export function needsArgs(cmd) {
  const u = (cmd.usage ?? '').trim();
  // لو الـ usage هو الأمر لوحده (من غير معاملات) → مش محتاج نص
  if (!u) return false;
  const bare = `${config.prefix}${cmd.name}`.trim();
  if (u === bare) return false;
  // لو فيه حاجة بعد الأمر (سواء نص أو فاصل) → محتاج نص
  const rest = u.startsWith(bare) ? u.slice(bare.length).trim() : u;
  if (!rest) return false;
  return NEEDS_TEXT.test(rest) || rest.length > 0;
}

function footer() {
  return `${config.botName} ${config.botEmoji}`;
}

// 🔙 زر الرجوع الثابت
const BACK = { label: '🔙 رجوع', id: '.menu' };

// ⚠️ مهم جدًا: لازم نمرّ على MB.Button مش sendMessage مباشرة.
// sendMessage مش بيسلّم (serialize) الـ interactiveMessage صح، وكمان بيضيع
// عقدة biz/native_flow اللي بيقول لواتساب إن الأزرار تفاعلية — من غيرها
// الرسالة بتوصل لكن الأزرار بتظهر ميتة أو مش بتظهر أصلاً.
async function send(sock, jid, { title, text, buttons, sections, selectTitle }) {
  const list = [...buttons];
  if (list.length > 10) list.length = 10; // حد واتساب 10 أزرار

  try {
    const b = new MB.Button(sock);
    b.setTitle(String(title ?? '').slice(0, 60))
      .setBody(String(text ?? '').slice(0, 1200))
      .setFooter(footer());

    // قائمة منسدلة (single_select) — لازم تتعمل الأول عشان تبقى في البايان
    if (sections?.length) {
      b.addSelection(selectTitle ?? 'اختار');
      for (const s of sections) {
        b.makeSection(s.title, s.highlight_label ?? '');
        for (const r of s.rows) b.makeRow(r.header ?? r.title, r.title, r.description ?? '', r.id);
      }
    }

    for (const btn of list) {
      const label = String(btn.label).slice(0, 40);
      // 📋 زر نسخ حقيقي في واتساب — بينسخ الصيغة لما تدوس عليه
      if (typeof btn.id === 'string' && btn.id.startsWith('copy:')) {
        b.addCopy(label, btn.id.slice(5));
      } else {
        b.addReply(label, btn.id);
      }
    }

    await b.send(jid);
  } catch (err) {
    console.error('⚠️ الأزرار فشلت، هرجّع نص:', err.message?.slice(0, 80));
    let fallback = `╭─「 ${title} 」\n\n${text}\n`;
    for (const btn of list) fallback += `\n▸ ${btn.id.replace('copy:', '')}`;
    for (const s of sections ?? []) {
      fallback += `\n\n◆ ${s.title}`;
      for (const r of s.rows) fallback += `\n  • ${r.id}`;
    }
    fallback += '\n╰───────────';
    await sock.sendMessage(jid, { text: fallback });
  }
}

// ═══ المستوى 1: اختيار القسم ═══
// ═══ المستوى 1: اختيار القسم ═══
//
// ⚠️ واتساب بيقبل 10 أزرار بالظبط في الرسالة. عندنا 11 قسم + تعليمات +
// المطور = 13. الحل: 8 أقسام كبيرة كأزرار، والباقي في قائمة منسدلة
// "المزيد" — عشان مفيش قسم يضيع من غير ما حد ياخد باله.
const PRIMARY = 7; // 7 أقسام + تعليمات + المطور = 9 أزرار + 1 قائمة = 10 (حد واتساب)

export async function mainMenu(sock, jid, extra = '') {
  const main = SECTIONS.slice(0, PRIMARY).map((s) => ({
    label: `${s.emoji} ${s.label}`,
    id: `.menu ${s.id}`,
  }));
  const rest = SECTIONS.slice(PRIMARY).map((s) => ({
    title: `${s.emoji} ${s.label}`,
    description: s.desc,
    id: `.menu ${s.id}`,
  }));

  return send(sock, jid, {
    title: '⚡ اختر القسم اللي عايزه',
    text: [
      extra,
      'اختار القسم اللي عايزه من تحت 👇',
      '',
      '💡 كل الأوامر تنفع بالعربي — اكتب `.القائمه` أو `.اغنية` زي ما تحب',
    ].filter(Boolean).join('\n\n'),
    buttons: [
      ...main,
      { label: '📖 تعليمات', id: '.about' },
      { label: '👨‍💻 المطور', id: '.owner' },
    ],
    sections: rest.length ? [{ title: '📂 باقي الأقسام', rows: rest }] : null,
    selectTitle: '📂 كل الأقسام',
  });
}

// ═══ المستوى 2: أوامر القسم ═══
export async function sectionMenu(sock, jid, sectionId, ctx) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return mainMenu(sock, jid);

  const cmds = ctx.categories.get(sectionId) ?? [];
  if (!cmds.length) {
    return send(sock, jid, {
      title: `${section.emoji} ${section.label}`,
      text: `${section.desc}\n\n⏳ مفيش أوامر في القسم ده لسه`,
      buttons: [BACK],
    });
  }

  // الأوامر اللي محتاجة نص → أزرار "الصيغة" (لأXI xeteraza "الصيغة")
  const simple = cmds.filter((c) => !needsArgs(c));
  const complex = cmds.filter((c) => needsArgs(c));

  const buttons = simple.map((c) => ({ label: `${c.name}`, id: `${config.prefix}${c.name}` }));

  // لو فيه أوامر محتاجة نص، نعمل ليها قسم "صيغ" في القائمة المنسدلة
  const sections = [];
  if (complex.length) {
    sections.push({
      title: '📋 أوامر محتاجة كلام (اضغط تشوف الصيغة)',
      rows: complex.map((c) => ({
        title: c.name,
        description: (c.usage ?? '').slice(0, 50),
        id: `.usage ${c.name}`,
      })),
    });
  }

  return send(sock, jid, {
    title: `${section.emoji} ${section.label} — ${cmds.length} أمر`,
    text: [
      `${section.desc}`,
      '',
      simple.length ? 'اضغط أي أمر يشتغل فورًا 👇' : '',
      complex.length ? `📋 فيه ${complex.length} أمر محتاج كلام — اختار من القائمة المنسدلة` : '',
    ].filter(Boolean).join('\n'),
    buttons: [...buttons.slice(0, 8), BACK],
    sections: sections.length ? sections : null,
    selectTitle: '📋 صيغ الأوامر',
  });
}

// ═══ المستوى 3: شرح أمر + زر نسخ الصيغة ═══
export async function usageScreen(sock, jid, cmd, ctx) {
  const example = (cmd.usage ?? `${config.prefix}${cmd.name}`).replace(/</g, '').replace(/>/g, ' ');

  return send(sock, jid, {
    title: `📋 ${cmd.name}`,
    text: [
      `📌 ${cmd.description ?? ''}`,
      '',
      `✍️ *اكتب الأمر كده:*`,
      `   ${config.prefix}${example}`,
      '',
      '💡 اضغط الزرار تحت وألصقه في الشات 📋',
    ].join('\n'),
    buttons: [
      { label: `📋 انسخ الصيغة`, id: `copy:${config.prefix}${example}` },
      { label: `⚡ جربه دلوقتي`, id: `${config.prefix}${cmd.name}` },
      BACK,
    ],
  });
}
