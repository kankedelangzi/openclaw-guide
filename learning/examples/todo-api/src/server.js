// 服务器入口
require('dotenv').config();
const app = require('./app');
const config = require('./config');
const { connectDB } = require('./config/db');

async function startServer() {
  try {
    await connectDB();
    
    app.listen(config.port, () => {
      console.log('');
      console.log('🚀 ═══════════════════════════════════════');
      console.log(`   待办事项 API 启动成功！`);
      console.log(`   环境: ${config.nodeEnv}`);
      console.log(`   端口: ${config.port}`);
      console.log('🚀 ═══════════════════════════════════════');
      console.log('');
      console.log('📌 API 使用示例:');
      console.log('');
      console.log('# 1. 注册');
      console.log(`curl -X POST http://localhost:${config.port}/api/auth/register \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"username":"dayu","email":"dayu@example.com","password":"123456"}'`);
      console.log('');
      console.log('# 2. 登录获取 Token');
      console.log(`curl -X POST http://localhost:${config.port}/api/auth/login \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"username":"dayu","password":"123456"}'`);
      console.log('');
      console.log('# 3. 创建待办（使用 Token）');
      console.log(`curl -X POST http://localhost:${config.port}/api/todos \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN" \\`);
      console.log(`  -d '{"title":"学习 Node.js","priority":"high","category":"学习"}'`);
      console.log('');
      console.log('# 4. 获取待办列表');
      console.log(`curl http://localhost:${config.port}/api/todos \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);
      console.log('');
      console.log('# 5. 筛选待办（按分类、优先级、状态）');
      console.log(`curl "http://localhost:${config.port}/api/todos?category=学习&priority=high&completed=false" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);
      console.log('');
    });
  } catch (err) {
    console.error('❌ 启动服务器失败:', err);
    process.exit(1);
  }
}

startServer();
