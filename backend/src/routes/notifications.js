const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth');
const { list, markRead, unreadCount } = require('../controllers/notifications.controller');

const router = Router();

router.use(authMiddleware);

// unread-count antes de /:id para evitar que Express lo absorba
router.get('/unread-count', unreadCount);
router.get('/',             list);
router.patch('/:id/read',   markRead);

module.exports = router;
