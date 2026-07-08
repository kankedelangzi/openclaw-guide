// 服务器入口
require('dotenv').config();
const app = require('./app');
const config = require('./config');
const { connectDB } = require('./config/db');

async function startServer() {
  try {
    // 连接数据库
    await connectDB();
    
    // 启动服务器
    app.listen(config.port, () => {
      console.log('');
      console.log('🚀 ═══════════════════════════════════════');
      console.log(`   Express 进阶 API 启动成功！`);
      console.log(`   环境: ${config.nodeEnv}`);
      console.log(`   端口: ${config.port}`);
      console.log('🚀 ═══════════════════════════════════════');
      console.log('');
      console.log('📌 API 使用示例:');
      console.log('');
      console.log('# 1. 注册用户');
      console.log(`curl -X POST http://localhost:${config.port}/api/auth/register \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"username":"dayu","email":"dayu@example.com","password":"123456"}'`);
      console.log('');
      console.log('# 2. 登录');
      console.log(`curl -X POST http://localhost:${config.port}/api/auth/login \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"username":"dayu","password":"123456"}'`);
      console.log('');
      console.log('# 3. 获取当前用户（需要 Token）');
      console.log(`curl http://localhost:${config.port}/api/auth/me \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE"`);
      console.log('');
    });
  } catch (err) {
    console.error('❌ 启动服务器失败:', err);
    process.exit(1);
  }
}

startServer();
