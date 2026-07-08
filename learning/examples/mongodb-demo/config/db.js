// MongoDB 连接配置
// 使用 Docker 启动 MongoDB 后，运行: docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:latest

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:password123@localhost:27017/mydb';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB 连接成功');
  } catch (err) {
    console.error('❌ MongoDB 连接失败:', err.message);
    process.exit(1);
  }
}

// 连接断开事件
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB 连接断开');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 错误:', err);
});

module.exports = { connectDB, mongoose };
