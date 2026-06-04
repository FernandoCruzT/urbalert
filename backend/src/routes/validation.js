const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { queue, review, stats } = require('../controllers/validation.controller');

const router = Router();

router.use(authMiddleware);
router.use(requireRole('superadmin'));

router.get('/queue',              queue);
router.get('/stats',              stats);
router.post('/:reportId/review',  review);

module.exports = router;
