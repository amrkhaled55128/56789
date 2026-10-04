// 🧩 النسخة الجاهزة لأي أمر جديد
// انسخ الملف ده لفولدر القسم المناسب جوه commands/ وسمّيه باسم الأمر
// مثال: commands/games/rps.js

export default {
  name: 'example',
  aliases: ['مثال'],        // اختياري: أسماء بديلة
  description: 'وصف الأمر — يظهر في المنيو',
  usage: '.example [شي]',   // اختياري: طريقة الاستخدام
  async execute(sock, m, args, ctx) {
    // m.reply()  → رد على الرسالة
    // m.sender   → اللي بعت
    // m.jid      → الشات الحالي
    // args       → كلام بعد الأمر: .example hello → ['hello']
    await m.reply('مرحبًا! 👋');
  },
};
