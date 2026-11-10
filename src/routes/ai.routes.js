const { Router } = require('express');
const { getStatus } = require('../controllers/ai.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

// GET /api/ai/status
router.get('/status', getStatus);

module.exports = router;
