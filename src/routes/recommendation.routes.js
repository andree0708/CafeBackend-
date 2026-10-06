const { Router } = require('express')
const { body, param } = require('express-validator')
const { getRecommendations, addRecommendation, deleteRecommendation } = require('../controllers/recommendation.controller')
const { authenticate, authorize } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

// GET  /api/batches/:batchId/recommendations
router.get(
  '/:batchId/recommendations',
  [param('batchId').isInt({ gt: 0 })],
  validate,
  getRecommendations
)

// POST /api/batches/:batchId/recommendations  (admin only)
router.post(
  '/:batchId/recommendations',
  authorize('ADMIN'),
  [
    param('batchId').isInt({ gt: 0 }),
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('description').trim().notEmpty().withMessage('Description is required.'),
    body('category').isIn(['commercialization', 'processing', 'agronomic'])
      .withMessage('Category must be: commercialization, processing or agronomic.'),
    body('priority').optional().isIn(['low', 'medium', 'high']),
  ],
  validate,
  addRecommendation
)

// DELETE /api/batches/:batchId/recommendations/:id  (admin only)
router.delete(
  '/:batchId/recommendations/:id',
  authorize('ADMIN'),
  [
    param('batchId').isInt({ gt: 0 }),
    param('id').isInt({ gt: 0 }),
  ],
  validate,
  deleteRecommendation
)

module.exports = router
