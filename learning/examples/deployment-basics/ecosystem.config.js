# PM2 配置文件示例
# 使用: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'todo-api',
      script: 'src/server.js',
      cwd: './examples/todo-api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'mongodb://admin:password123@localhost:27017/tododb'
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'mongodb://admin:password123@mongodb:27017/tododb'
      },
      
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // 进程超时
      kill_timeout: 5000,
      
      // 停止等待时间
      wait_ready: true,
      
      // 监听端口就绪
      listen_timeout: 3000
    }
  ]
};
