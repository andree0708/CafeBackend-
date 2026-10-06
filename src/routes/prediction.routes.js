const { Router } = require('express')
const { param } = require('express-validator')
const { getPrediction, requestPrediction } = require('../controllers/prediction.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

// GET  /api/batches/:batchId/prediction
router.get(
  '/:batchId/prediction',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getPrediction
)

// POST /api/batches/:batchId/prediction
router.post(
  '/:batchId/prediction',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  requestPrediction
)

module.exports = router
