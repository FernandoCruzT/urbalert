const { Router } = require('express');
const { register, login, me, changePassword } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');

const router = Router();

router.post('/register',         register);
router.post('/login',            login);
router.get('/me',                authMiddleware, me);
router.patch('/change-password', authMiddleware, changePassword);

module.exports = router;
