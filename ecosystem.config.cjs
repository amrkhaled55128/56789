// إعدادات تشغيل NOVA BOT تحت PM2 — إعادة تشغيل تلقائية وسجلات مؤرخة
module.exports = {
  apps: [
    {
      name: 'nova-bot',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      max_memory_restart: '500M',
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
