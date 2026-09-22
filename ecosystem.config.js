module.exports = {
  apps: [
    {
      name: 'wbs-platform',
      script: 'app.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 2222,
        HOST: 'https://wbs.itfuturz.in',
        LIVE_DOMAIN: 'wbs.itfuturz.in',
        FRONTEND_URL: 'https://wbs.itfuturz.in',
        WEBHOOK_URL: 'https://wbs.itfuturz.in/webhook'
      }
    }
  ]
};
