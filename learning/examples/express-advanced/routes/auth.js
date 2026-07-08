// 认证路由
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// POST /api/auth/register - 注册
router.post('/register', authController.register);

// POST /api/auth/login - 登录
router.post('/login', authController.login);

// GET /api/auth/me - 获取当前用户（需要认证）
router.get('/me', auth, authController.getMe);

module.exports = router;
