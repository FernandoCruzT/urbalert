const { Router } = require('express');
const { register, login, me, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerification } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth');

const router = Router();

router.post('/register',         register);
router.post('/login',            login);
router.get('/me',                authMiddleware, me);
router.patch('/change-password', authMiddleware, changePassword);
router.post('/forgot-password',       forgotPassword);
router.post('/reset-password',        resetPassword);
router.post('/verify-email',          verifyEmail);
router.post('/resend-verification',   resendVerification);

module.exports = router;
