import { MB } from '@rexxhayanasi/elaina-baileys';
import { config } from '../../config.js';
import {
  sendText,
  sendQuickReplies,
  sendInteractive,
  sendCarousel,
  sendPoll,
  sendRich,
} from '../../core/send.js';

// قواعد واتساب: الأنواع ممنوع تختلط، السريع لحد 10، وغيره لحد 3
const NON_QUICK_SUPPORTED_ON_ANDROID_ONLY = ['single_select', 'send_location', 'address_message', 'cta_reminder', 'cta_cancel_reminder'];

export default {
  name: 'buttons',
  aliases: ['ازرار', 'الأزرار', 'btn'],
  description: 'استعراض حي لكل أنواع أزرار المكتبة — جرّبهم واحد واحد',
  usage: '.buttons [reply|links|list|carousel|poll|rich|check]',
  async execute(sock, m, args) {
    const sub = (args[0] ?? '').toLowerCase();

    // رد اختيار من القائمة (من تجربة .buttons list)
    if (sub.startsWith('pick-')) {
      return m.reply(`✅ القائمة شغالة! اختيارك: رقم *${sub.split('-')[1]}*`);
    }

    // رد ضغطة زر سريع (من تجربة .buttons reply)
    if (/^pressed-\d+$/.test(sub)) {
      return m.reply(`✅ الزر اشتغل! دست على: *زر رقم ${sub.split('-')[1]}*`);
    }

    switch (sub) {
      // 1️⃣ الأزرار السريعة — الحد الأقصى 10
      case 'reply': {
        return sendQuickReplies(sock, m.jid, {
          title: '⚡ أزرار سريعة — Quick Reply',
          text: 'دي أكبر كمية مسموحة: *10 أزرار* في رسالة واحدة.\nدوس أي زر وهيديك رقمه.',
          buttons: Array.from({ length: 10 }, (_, i) => ({
            label: `زر رقم ${i + 1}`,
            id: `.buttons pressed-${i + 1}`,
          })),
        });
      }

      // 2️⃣ أزرار الروابط والنسخ والمكالمة — لحد 3 لأنها نوع مختلف
      case 'links': {
        const b = new MB.Button(sock)
          .setTitle('🔗 أزرار الروابط')
          .setBody('ثلاثة أنواع مختلفة في رسالة واحدة (الحد الأقصى للنوع ده):\n• *URL* — بيفتح لينك\n• *Copy* — بينسخ كود\n• *Call* — زر مكالمة')
          .setFooter(`${config.botName} ${config.botEmoji}`)
          .addUrl('🌐 افتح جوجل', 'https://google.com')
          .addCopy('📋 انسخ الكود', 'NOVA-2026')
          .addCall('📞 اتصل بينا', '+201000000000');
        return b.send(m.jid);
      }

      // 3️⃣ القائمة المنسدلة — أندرويد بس
      case 'list': {
        return sendInteractive(sock, m.jid, {
          title: '📋 قائمة منسدلة — Single Select',
          text: '⚠️ النوع ده بيظهر على *أندرويد بس* — واتساب ويب وآيفون مفيهمش الكود بتاعه.\nاختار أي صف وقولي وصلت ولا لأ.',
          sections: [
            {
              title: '🎮 قسم تجريبي',
              rows: [
                { title: 'الخيار الأول', description: 'دوس عليه وابعتهولي', id: '.buttons pick-1' },
                { title: 'الخيار الثاني', description: 'التاني من القائمة', id: '.buttons pick-2' },
                { title: 'الخيار الثالث', description: 'التالت من القائمة', id: '.buttons pick-3' },
              ],
            },
          ],
          selectTitle: '📂 افتح القائمة',
        });
      }

      // 4️⃣ الكاروسيل — كروت بتتقلب فيها
      case 'carousel': {
        return sendCarousel(sock, m.jid, {
          body: '🎠 *كاروسيل* — قلّب الكروت بإصبعك! كل كارت لازم يكون فيه صورة.',
          cards: [
            {
              image: 'https://picsum.photos/seed/nova1/600/400',
              body: '*الكارت الأول* ✨\nكارت بصورة وزر سريع.',
              buttons: [{ label: 'اختار الكارت الأول', id: '.buttons pressed-1' }],
            },
            {
              image: 'https://picsum.photos/seed/nova2/600/400',
              body: '*الكارت التاني* 🔥\nكارت بزر لينك خارجي.',
              buttons: [{ label: '🌐 زر لينك', url: 'https://github.com' }],
            },
            {
              image: 'https://picsum.photos/seed/nova3/600/400',
              body: '*الكارت التالت* 💪\nوكارت بزر نسخ.',
              buttons: [{ label: '📋 انسخ', url: 'copy:NOVA' }],
            },
          ],
        }).catch(() => m.reply('⚠️ الكاروسيل محتاج اتصال نشط بصيغة معينة — شوف التيرمنال للتفاصيل'));
      }

      // 5️⃣ استطلاع رأي
      case 'poll': {
        return sendPoll(sock, m.jid, {
          name: '📊 إيه رأيك في أزرار البوت؟',
          values: ['شغالة ممتاز ✅', 'حلوة جدًا 🔥', 'محتاجة شغل 😅'],
          selectableCount: 1,
        });
      }

      // 6️⃣ كارت غني بشكل Meta AI
      case 'rich': {
        return sendRich(sock, m.jid, {
          title: '🤖 NOVA AI Rich',
          footer: 'كارت تجريبي بستايل الذكاء الاصطناعي',
          text: 'ده *كارت غني* فيه نص وكود وجدول واقتراحات — نفس الشكل اللي Meta AI بيرد بيه.',
          code: { language: 'javascript', value: "console.log('ASTRO BOT ⚡ شغال');" },
          table: [
            ['الميزة', 'الحالة'],
            ['أزرار سريعة', '✅ شغالة'],
            ['روابط ونسخ', '✅ شغالة'],
            ['كاروسيل', '✅ شغال'],
            ['AIRich', '🧪 تجريبي'],
          ],
          suggestions: ['عايز كمان', 'جميل جدًا 🔥', 'شرح أكتر'],
        });
      }

      // 7️⃣ فحص دعم الأنواع من كود المكتبة نفسها
      case 'check': {
        const all = [
          'quick_reply', 'cta_url', 'cta_call', 'cta_copy', 'cta_catalog',
          'catalog_message', 'order_status', 'payment_request', 'api_signup',
          'cta_app', 'form_message', 'single_select', 'send_location',
          'address_message', 'cta_reminder', 'cta_cancel_reminder',
        ];
        const res = MB.checkNativeFlowButtons(all.map((n) => ({ name: n })));
        const unsupported = new Set(res.unsupported ?? []);
        const androidOnly = new Set(NON_QUICK_SUPPORTED_ON_ANDROID_ONLY);
        const everywhere = all.filter((n) => !unsupported.has(n) && !androidOnly.has(n));
        const android = all.filter((n) => !unsupported.has(n) && androidOnly.has(n));
        return m.reply([
          '🔍 *فحص دعم الأزرار* (من كود واتساب ويب الرسمي داخل المكتبة)',
          '',
          `✅ بظهر على كل الأجهزة (${everywhere.length}):`,
          `   ${everywhere.join(' • ')}`,
          '',
          `🤖 أندرويد بس (${android.length}):`,
          `   ${android.join(' • ') || 'مفيش'}`,
          '',
          `❌ مش مدعوم خالص (${unsupported.size}):`,
          `   ${[...unsupported].join(' • ') || 'مفيش'}`,
          '',
          '📌 القاعدة الذهبية: الأزرار السريعة لحد 10، وغيرها لحد 3، ومينفعش تخلط الأنواع.',
        ].join('\n'));
      }

      // 🏠 الصفحة الرئيسية — أزرار سريعة بس (مفيش خلط أنواع)
      default: {
        return sendQuickReplies(sock, m.jid, {
          title: `🧪 معرض أزرار ${config.botName} ${config.botEmoji}`,
          text: [
            'اختار نوع من التجارب وجرّبه بنفسك 👇',
            '',
            '⚡ *reply* — 10 أزرار سريعة (الحد الأقصى)',
            '🔗 *links* — لينك + نسخ + مكالمة',
            '📋 *list* — قائمة منسدلة (أندرويد بس)',
            '🎠 *carousel* — كروت بتتقلب',
            '📊 *poll* — استطلاع رأي',
            '🤖 *rich* — كارت بشكل Meta AI',
            '🔍 *check* — فحص دعم كل الأنواع',
          ].join('\n'),
          buttons: [
            { label: '⚡ سريعة', id: '.buttons reply' },
            { label: '🔗 روابط', id: '.buttons links' },
            { label: '📋 قائمة', id: '.buttons list' },
            { label: '🎠 كاروسيل', id: '.buttons carousel' },
            { label: '📊 استطلاع', id: '.buttons poll' },
            { label: '🤖 Rich', id: '.buttons rich' },
            { label: '🔍 فحص الدعم', id: '.buttons check' },
          ],
        });
      }
    }
  },
};
