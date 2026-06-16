const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth');
const { list, markRead, markAllRead, unreadCount } = require('../controllers/notifications.controller');

const router = Router();

router.use(authMiddleware);

// rutas estáticas antes de /:id para que Express no las absorba como parámetro
router.get('/unread-count',  unreadCount);
router.patch('/read-all',    markAllRead);
router.get('/',              list);
router.patch('/:id/read',    markRead);

module.exports = router;
