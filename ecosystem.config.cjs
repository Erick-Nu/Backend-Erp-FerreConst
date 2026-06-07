module.exports = {
  apps: [
    {
      name: 'send-proforma',
      script: 'src/agents/sendProforma/task/sendProformaTask.ts',
      interpreter: 'tsx',
      watch: false,
      kill_timeout: 10000,
      max_restarts: 5,
      min_uptime: 10000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'stock-alert',
      script: 'src/agents/stockAlert/task/stockAlertTask.ts',
      interpreter: 'tsx',
      watch: false,
      kill_timeout: 10000,
      max_restarts: 5,
      min_uptime: 10000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
