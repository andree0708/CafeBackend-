const { Router } = require('express')
const { body, param } = require('express-validator')
const { getAllFarms, getFarmById, createFarm, updateFarm, deleteFarm } = require('../controllers/farm.controller')
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

// DELETE /api/farms/:id
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.')],
  validate,
  deleteFarm
)

module.exports = router
