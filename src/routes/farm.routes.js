const { Router } = require('express')
const { body, param } = require('express-validator')
const { getAllFarms, getFarmById, createFarm, updateFarm, deleteFarm } = require('../controllers/farm.controller')
const { createBatch } = require('../controllers/batch.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

// GET /api/farms
router.get('/', getAllFarms)

// GET /api/farms/:id
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.')],
  validate,
  getFarmById
)

// POST /api/farms
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Farm name is required.')
      .isLength({ min: 2, max: 100 }).withMessage('Farm name must be between 2 and 100 characters.'),

    body('location')
      .trim()
      .notEmpty().withMessage('Location is required.')
      .isLength({ min: 3, max: 150 }).withMessage('Location must be between 3 and 150 characters.'),

    body('municipality')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 2, max: 80 }).withMessage('Municipality must be between 2 and 80 characters.')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/).withMessage('Municipality must contain only letters.'),

    body('department')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 2, max: 80 }).withMessage('Department must be between 2 and 80 characters.')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/).withMessage('Department must contain only letters.'),

    body('hectares')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0.1, max: 100000 }).withMessage('Hectares must be between 0.1 and 100,000.'),

    body('altitude')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 6000 }).withMessage('Altitude must be between 0 and 6,000 meters.'),
  ],
  validate,
  createFarm
)

// PUT /api/farms/:id
router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.'),

    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Farm name cannot be empty.')
      .isLength({ min: 2, max: 100 }).withMessage('Farm name must be between 2 and 100 characters.'),

    body('location')
      .optional()
      .trim()
      .notEmpty().withMessage('Location cannot be empty.')
      .isLength({ min: 3, max: 150 }).withMessage('Location must be between 3 and 150 characters.'),

    body('municipality')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 2, max: 80 }).withMessage('Municipality must be between 2 and 80 characters.'),

    body('department')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 2, max: 80 }).withMessage('Department must be between 2 and 80 characters.'),

    body('hectares')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0.1, max: 100000 }).withMessage('Hectares must be between 0.1 and 100,000.'),

    body('altitude')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 6000 }).withMessage('Altitude must be between 0 and 6,000 meters.'),
  ],
  validate,
  updateFarm
)

// POST /api/farms/:farmId/batches
router.post(
  '/:farmId/batches',
  [
    param('farmId').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.'),
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
    body('processingMethod').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
    body('variety').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
    body('weight').optional({ checkFalsy: true }).isFloat({ min: 0.1, max: 100000 }),
    body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  ],
  validate,
  createBatch
)

// DELETE /api/farms/:id
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.')],
  validate,
  deleteFarm
)

module.exports = router
