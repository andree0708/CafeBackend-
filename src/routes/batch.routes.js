const { Router } = require('express')
const { body, param } = require('express-validator')
const {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} = require('../controllers/batch.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

const PROCESSING_METHODS = ['washed', 'natural', 'honey', 'anaerobic', 'wet-hulled', 'other']
const VARIETIES = ['caturra', 'castillo', 'colombia', 'geisha', 'tabi', 'bourbon', 'typica', 'other']

// GET /api/batches
router.get('/', getAllBatches)

// GET /api/batches/:id
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getBatchById
)

// POST /api/farms/:farmId/batches
router.post(
  '/farms/:farmId/batches',
  [
    param('farmId')
      .isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.'),

    body('code')
      .trim()
      .notEmpty().withMessage('Batch code is required.')
      .isLength({ min: 3, max: 30 }).withMessage('Batch code must be between 3 and 30 characters.')
      .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Batch code must contain only letters, numbers, hyphens or underscores.'),

    body('harvestDate')
      .isISO8601().withMessage('Harvest date must be a valid ISO 8601 date (YYYY-MM-DD).')
      .custom((value) => {
        const date = new Date(value)
        const now = new Date()
        const tenYearsAgo = new Date()
        tenYearsAgo.setFullYear(now.getFullYear() - 10)
        if (date > now) throw new Error('Harvest date cannot be in the future.')
        if (date < tenYearsAgo) throw new Error('Harvest date cannot be more than 10 years ago.')
        return true
      }),

    body('processingMethod')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Processing method must not exceed 50 characters.'),

    body('variety')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Variety must not exceed 50 characters.'),

    body('weight')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0.1, max: 100000 }).withMessage('Weight must be between 0.1 and 100,000 kg.'),

    body('notes')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters.'),
  ],
  validate,
  createBatch
)

// PUT /api/batches/:id
router.put(
  '/:id',
  [
    param('id')
      .isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),

    body('code')
      .optional()
      .trim()
      .notEmpty().withMessage('Batch code cannot be empty.')
      .isLength({ min: 3, max: 30 }).withMessage('Batch code must be between 3 and 30 characters.')
      .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Batch code must contain only letters, numbers, hyphens or underscores.'),

    body('harvestDate')
      .optional()
      .isISO8601().withMessage('Harvest date must be a valid ISO 8601 date.')
      .custom((value) => {
        if (!value) return true
        const date = new Date(value)
        if (date > new Date()) throw new Error('Harvest date cannot be in the future.')
        return true
      }),

    body('processingMethod')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Processing method must not exceed 50 characters.'),

    body('variety')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Variety must not exceed 50 characters.'),

    body('weight')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0.1, max: 100000 }).withMessage('Weight must be between 0.1 and 100,000 kg.'),

    body('notes')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters.'),
  ],
  validate,
  updateBatch
)

// DELETE /api/batches/:id
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  deleteBatch
)

module.exports = router
