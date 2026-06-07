module.exports = {
  apps: [
    {
      name: 'ferreconst-api',
      script: 'dist/server.js',
      cwd: '/home/esnt/Backend-Erp-FerreConst',
      watch: false,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'send-proforma',
      script: 'dist/agents/sendProforma/task/sendProformaTask.js',
      cwd: '/home/esnt/Backend-Erp-FerreConst',
      watch: false,
      kill_timeout: 10000,
      max_restarts: 5,
      min_uptime: 10000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'stock-alert',
      script: 'dist/agents/stockAlert/task/stockAlertTask.js',
      cwd: '/home/esnt/Backend-Erp-FerreConst',
      watch: false,
      kill_timeout: 10000,
      max_restarts: 5,
      min_uptime: 10000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
