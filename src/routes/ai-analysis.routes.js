const { Router } = require('express')
const { param } = require('express-validator')
const { requestAiAnalysis } = require('../controllers/ai-analysis.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

const batchIdParam = param('batchId')
  .isInt({ gt: 0 })
  .withMessage('Batch id must be a positive integer.')

// POST /api/batches/:batchId/ai-analysis
router.post('/:batchId/ai-analysis', [batchIdParam], validate, requestAiAnalysis)

module.exports = router
