const { Router } = require('express')
const { body, param } = require('express-validator')
const {
  getRecommendations,
  addRecommendation,
  deleteRecommendation,
} = require('../controllers/recommendation.controller')
const { authenticate, authorize } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

// GET /api/batches/:batchId/recommendations
router.get(
  '/:batchId/recommendations',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getRecommendations
)

// POST /api/batches/:batchId/recommendations  (admin only)
router.post(
  '/:batchId/recommendations',
  authorize('ADMIN'),
  [
    param('batchId')
      .isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),

    body('title')
      .trim()
      .notEmpty().withMessage('Title is required.')
      .isLength({ min: 5, max: 120 }).withMessage('Title must be between 5 and 120 characters.'),

    body('description')
      .trim()
      .notEmpty().withMessage('Description is required.')
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1,000 characters.'),

    body('category')
      .trim()
      .isIn(['commercialization', 'processing', 'agronomic'])
      .withMessage('Category must be: commercialization, processing or agronomic.'),

    body('priority')
      .optional()
      .trim()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Priority must be: low, medium or high.'),
  ],
  validate,
  addRecommendation
)

// DELETE /api/batches/:batchId/recommendations/:id  (admin only)
router.delete(
  '/:batchId/recommendations/:id',
  authorize('ADMIN'),
  [
    param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),
    param('id').isInt({ gt: 0 }).withMessage('Recommendation id must be a positive integer.'),
  ],
  validate,
  deleteRecommendation
)

module.exports = router
