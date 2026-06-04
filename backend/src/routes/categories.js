const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth');
const { getCategories } = require('../controllers/categories.controller');

const router = Router();

router.get('/', authMiddleware, getCategories);

module.exports = router;
