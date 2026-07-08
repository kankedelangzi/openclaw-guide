// 用户路由
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// 所有路由都需要认证
router.use(auth);

// GET /api/users - 获取所有用户
router.get('/', userController.getAllUsers);

// GET /api/users/:id - 获取单个用户
router.get('/:id', userController.getUser);

// PUT /api/users/:id - 更新用户
router.put('/:id', userController.updateUser);

// DELETE /api/users/:id - 删除用户
router.delete('/:id', userController.deleteUser);

module.exports = router;
