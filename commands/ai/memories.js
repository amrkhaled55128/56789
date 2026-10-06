import { sendQuickReplies, sendText } from '../../core/send.js';
import { getProfile, deleteMemory, clearMemories } from '../../core/memory.js';

// 📋 .ذاكرتي — استعراض أو حذف ما يتذكره استرو عنك
export default {
  name: 'ذاكرتي',
  aliases: ['ذكرياتي', 'فاكر_ايه', 'معلوماتي', 'memories'],
  description: 'عرض كل ما يتذكره استرو عنك مع إمكانية حذف أي ذكرى',
  usage: '.ذاكرتي  أو  .ذاكرتي مسح <رقم>  أو  .ذاكرتي مسح_الكل',
  async execute(sock, m, args, ctx) {
    const key = m.identityKey ?? m.sender;
    const profile = getProfile(key);
    const memories = profile.memories ?? [];
    const sub = (args[0] ?? '').toLowerCase();

    // 🗑️ مسح الكل
    if (sub === 'مسح_الكل' || sub === 'تصفير' || sub === 'clear') {
      const count = clearMemories(key);
      return sendQuickReplies(sock, m.jid, {
        title: '🧹 تصفير الذاكرة',
        text: count > 0
          ? `تم مسح جميع ذكرياتك (${count} ذكرى) بنجاح 🧼\nدماغي بقت صفحة بيضا معاك، تقدر تحفظ جديد من الأول.`
          : 'الذاكرة فاضية بالفعل يا غالي، مفيش أي ذكريات لمسحها!',
        buttons: [
          { label: '➕ احفظ ذكرى جديدة', id: '.فكر ' },
        ],
      });
    }

    // 🗑️ مسح ذكرى واحدة بالرقم
    if (sub === 'مسح' || sub === 'حذف' || sub === 'del' || sub === 'remove') {
      const idx = Number(args[1]) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= memories.length) {
        return m.reply(`❌ رقم الذكرى غير صحيح — اكتب \`.ذاكرتي\` لتشوف الأرقام من (1 إلى ${memories.length || 1})`);
      }

      const deleted = deleteMemory(key, idx);
      if (!deleted) return m.reply('❌ مقدرتش أمسح الذكرى دي، حاول تاني.');

      return sendQuickReplies(sock, m.jid, {
        title: '🗑️ حذف ذكرى',
        text: `تم مسح الذكرى بنجاح 🧼\n\n📝 *المحذوفة:* "${deleted.text}"`,
        buttons: [
          { label: '📋 باقي ذكرياتك', id: '.ذاكرتي' },
          { label: '➕ إضافة ذكرى', id: '.فكر ' },
        ],
      });
    }

    // 🔒 الخصوصية في الجروبات — منع كشف البيانات الشخصية أمام الجميع
    if (m.isGroup) {
      return sendQuickReplies(sock, m.jid, {
        title: '🔒 خصوصية ذكرياتك',
        text: `أنا فاكر عنك *${memories.length}* ذكرى يا *${profile.name ?? m.pushName}* 🧠\n\nعشان خصوصيتك ومعلوماتك متتعرضش قدام الكل في الجروب، اكتب \`.ذاكرتي\` في الشات الخاص بيني وبينك وشوفها بالتفصيل!`,
        buttons: [
          { label: '🧠 حفظ ذكرى جديدة', id: '.فكر ' },
        ],
      });
    }

    // 📋 العرض الكامل في الخاص
    if (!memories.length) {
      return sendQuickReplies(sock, m.jid, {
        title: '🧠 ذاكرتك عند استرو',
        text: `يا *${profile.name ?? m.pushName}*، لسه مفيش ذكريات مسجلة عندي ليك.\n\nاكتب: \`.فكر <معلومة عنك>\` وهحفظها على طول!`,
        buttons: [
          { label: '➕ احفظ أول ذكرى', id: '.فكر ' },
          { label: '🤖 تحدث مع استرو', id: '.ai' },
        ],
      });
    }

    const fmtDate = (t) =>
      new Date(t).toLocaleDateString('ar-EG', {
        timeZone: 'Africa/Cairo',
        day: 'numeric',
        month: 'short',
      });

    const rows = memories
      .map((mem, i) => `${i + 1}. ${mem.pin ? '📌' : '💭'} *${mem.text}*\n   🗓️ _${fmtDate(mem.at)}_${mem.hits ? ` • تكرار: ${mem.hits}` : ''}`)
      .join('\n\n');

    const factsList = (profile.facts ?? []).length
      ? `\n\n📌 *حقائق عنك:* ${profile.facts.join(' • ')}`
      : '';

    return sendQuickReplies(sock, m.jid, {
      title: `🧠 ذاكرة ${profile.name ?? m.pushName} (${memories.length})`,
      text: `${rows}${factsList}\n\n🗑️ *لحذف ذكرى:* \`.ذاكرتي مسح <رقم>\``,
      buttons: [
        { label: '➕ إضافة ذكرى', id: '.فكر ' },
        { label: '🗑️ مسح الكل', id: '.ذاكرتي مسح_الكل' },
      ],
    });
  },
};
