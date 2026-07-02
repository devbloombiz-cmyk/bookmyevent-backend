module.exports = {
  apps: [
    {
      name: "bookmyevent-backend",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      kill_timeout: 4000,
      wait_ready: true,
      listen_timeout: 15000,
      autorestart: true,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
