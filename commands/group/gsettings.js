import { sendQuickReplies, sendText } from '../../core/send.js';
import { getSettings, updateSetting, isAdmin } from '../../core/protection.js';

// ⚙️ .gsettings — لوحة إعدادات الجروب بالأزرار (للأدمن بس)
const FEATURES = [
  { key: 'antilink', label: '🔗 مانع اللينكات' },
  { key: 'antispam', label: '🚫 مانع السبام' },
  { key: 'antibot', label: '🤖 فلترة البوتات' },
  { key: 'antibad', label: '🤬 مانع السباب' },
  { key: 'antiflood', label: '🔁 منع التكرار' },
  { key: 'capslock', label: '🔠 منع الكابيتال' },
  { key: 'nsfw', label: '🌶️ فحص الصور NSFW' },
  { key: 'welcome', label: '👋 الترحيب بالأعضاء' },
  { key: 'antidelete', label: '👻 مضاد الحذف' },
  { key: 'followUp', label: '💔 متابعة الغايبين' },
];

export default {
  name: 'gsettings',
  aliases: ['اعدادات', 'الاعدادات'],
  description: 'لوحة إعدادات الجروب والحماية — للأدمن فقط',
  usage: '.gsettings  أو  .gsettings antilink',
  async execute(sock, m, args) {
    if (!(await isAdmin(sock, m.jid, m.sender))) {
      return m.reply('🔐 الأمر ده للأدمن بس');
    }

    const key = (args[0] ?? '').toLowerCase();
    if (FEATURES.some((f) => f.key === key)) {
      const s = getSettings(m.jid);
      const updated = updateSetting(m.jid, key, !s[key]);
      return sendText(sock, m.jid, `${updated[key] ? '✅ اشتغل' : '❌ اتقفل'}: *${key}*`);
    }

    const s = getSettings(m.jid);
    const lines = FEATURES.map((f) => `${s[f.key] ? '✅' : '❌'} ${f.label}`).join('\n');
    return sendQuickReplies(sock, m.jid, {
      title: '⚙️ إعدادات الجروب',
      text: lines + '\n\nدوس على أي حماية لتشغيلها أو قفلها 👇',
      buttons: FEATURES.map((f) => ({
        label: `${s[f.key] ? '🔓' : '🔒'} ${f.label}`,
        id: `.gsettings ${f.key}`,
      })),
    });
  },
};