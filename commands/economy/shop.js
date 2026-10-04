import { sendQuickReplies } from '../../core/send.js';
import { getEco, addCoins, saveEco, spend } from '../../core/economy.js';
import { db } from '../../core/db.js';
import { resolveKey } from '../../core/identity.js';

// 🏪 .shop — متجر نوفا: اشتري ألقاب ومميزات بعملاتك
const ITEMS = [
  { id: 'title', name: '🏷️ لقب مخصص', price: 200, desc: 'لقب يظهر في كارتك — .shop buy title لقبك' },
  { id: 'golden', name: '🏅 لقب ذهبي', price: 400, desc: 'وسام ذهبي دايمًا جنب اسمك في الكارت' },
  { id: 'clearwarn', name: '🧹 مسح إنذارات', price: 250, desc: 'يمسح إنذاراتك في الجروب الحالي' },
  { id: 'hint', name: '💡 تلميح إضافي', price: 100, desc: 'تلميح مجاني في ألعاب التخمين' },
];

export default {
  name: 'shop',
  aliases: ['متجر', 'المتجر'],
  description: 'متجر نوفا — اشتري ألقاب ومميزات بعملاتك',
  usage: '.shop  أو  .shop buy title لقبك',
  async execute(sock, m, args) {
    const key = m.identityKey ?? m.sender;
    const eco = getEco(key);
    const sub = (args[0] ?? '').toLowerCase();

    // شراء
    if (sub === 'buy') {
      const itemId = (args[1] ?? '').toLowerCase();
      const item = ITEMS.find((x) => x.id === itemId);
      if (!item) return m.reply('❌ مفيش منتج بالاسم ده — شوف `.shop`');

      if (eco.coins < item.price) {
        return m.reply(`🪙 رصيدك *${eco.coins}* مش كفاية — المنتج بـ *${item.price}*\nاكسب من: \`.daily\` والألعاب 🎮`);
      }

      // ⚠️ الكوبون كان بيتحسب بـ eco الميتLoaded فوق — والقيمة اللي بنصرفها
      // لازم تتأكد من المخزن نفسه، مش من نسخة قديمة في الذاكرة
      if (itemId === 'title') {
        const title = args.slice(2).join(' ').trim();
        if (!title || title.length > 20) return m.reply('اكتب اللقب بعد الأمر: `.shop buy title لقبك` (20 حرف كحد أقصى)');
        eco.title = title;
      } else if (itemId === 'golden') {
        if (eco.golden) return m.reply('🏅 عندك اللقب الذهبي خلاص!');
        eco.golden = true;
      } else if (itemId === 'hint') {
        eco.hints = (eco.hints ?? 0) + 3;
      }

      let warningSettings = null;
      let warningKey = null;
      if (itemId === 'clearwarn') {
        const gs = db.get('groupSettings', {});
        const s = gs[m.jid];
        // نفس منطق الإنذارات: alias واحد مع fallback للمفاتيح القديمة.
        const digits = String(m.sender).split(':')[0].split('@')[0];
        warningKey = s?.warnings?.[key] !== undefined
          ? key
          : Object.keys(s?.warnings ?? {}).find((k) => k.split('@')[0] === digits);
        if (warningKey === undefined) {
          return m.reply('😂 مفيش عندك إنذارات في الجروب ده أصلاً — رصيدك محفوظ!');
        }
        warningSettings = s;
      }

      // عملية متزامنة: تحقق من الرصيد ثم طبّق الخصم والفعل واحفظ مرة واحدة.
      // لا نستخدم spend هنا ثم نعيد حفظ نسخة eco قديمة؛ ده كان ممكن يرجع الرصيد.
      if ((eco.coins ?? 0) < item.price) {
        return m.reply('🪙 ماعندكش رصيد كافي — العب شوية الأول 🎮');
      }
      eco.coins -= item.price;
      if (itemId === 'clearwarn') {
        delete warningSettings.warnings[warningKey];
        db.set('groupSettings', db.get('groupSettings', {}));
      }
      saveEco(key, eco);
      return m.reply(
        `✅ اشتريت *${item.name}* بـ ${item.price} عملة!\n💰 رصيدك: *${getEco(key).coins}*\n\nاستمتع بيها يا وحش 💪`,
      );
    }

    // القائمة
    const lines = ITEMS.map((x) => `${x.name} — *${x.price}* عملة\n   ${x.desc}`).join('\n\n');
    return sendQuickReplies(sock, m.jid, {
      title: `🏪 متجر نوفا — رصيدك: ${eco.coins} عملة`,
      text: lines + '\n\nللشراء: `.shop buy <اسم المنتج>` أو دوس الزر 👇',
      buttons: [
        { label: '🏷️ اشتري لقب مخصص', id: '.shop buy title لقبك هنا' },
        { label: '🏅 اشتري الذهبي', id: '.shop buy golden' },
        { label: '🧹 امسح إنذاراتي', id: '.shop buy clearwarn' },
        { label: '💡 اشتري تلميحات', id: '.shop buy hint' },
      ],
    });
  },
};
