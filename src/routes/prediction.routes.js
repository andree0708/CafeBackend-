const { Router } = require('express')
const { param } = require('express-validator')
const {
  getPrediction,
  requestPrediction,
  getPredictionHistory,
  getMarketFits,
} = require('../controllers/prediction.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

const batchIdParam = param('batchId')
  .isInt({ gt: 0 })
  .withMessage('Batch id must be a positive integer.')

// GET  /api/batches/:batchId/prediction
router.get('/:batchId/prediction', [batchIdParam], validate, getPrediction)

// POST /api/batches/:batchId/prediction
router.post('/:batchId/prediction', [batchIdParam], validate, requestPrediction)

// GET  /api/batches/:batchId/prediction/history
router.get('/:batchId/prediction/history', [batchIdParam], validate, getPredictionHistory)

// GET  /api/batches/:batchId/markets
router.get('/:batchId/markets', [batchIdParam], validate, getMarketFits)

module.exports = router
