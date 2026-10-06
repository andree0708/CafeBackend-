const { Router } = require('express')
const { body, param } = require('express-validator')
const {
  getProductionVariables,
  upsertProductionVariables,
} = require('../controllers/productionVariables.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

// GET /api/batches/:batchId/variables
router.get(
  '/:batchId/variables',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getProductionVariables
)

// POST /api/batches/:batchId/variables
router.post(
  '/:batchId/variables',
  [
    param('batchId')
      .isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),

    // Climate
    body('avgTemperature')
      .optional({ checkFalsy: true })
      .isFloat({ min: -10, max: 50 }).withMessage('Temperature must be between -10°C and 50°C.'),

    body('avgRainfall')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 10000 }).withMessage('Rainfall must be between 0 and 10,000 mm.'),

    body('avgHumidity')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0% and 100%.'),

    // Soil
    body('soilPH')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 14 }).withMessage('Soil pH must be between 0 and 14.'),

    body('soilOrganicMatter')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 }).withMessage('Organic matter must be between 0% and 100%.'),

    body('soilNitrogen')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 }).withMessage('Soil nitrogen must be between 0 and 100.'),

    // Crop management
    body('fertilizationFrequency')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Fertilization frequency must not exceed 50 characters.'),

    body('pestControlType')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(['organic', 'chemical', 'integrated', 'none'])
      .withMessage('Pest control type must be: organic, chemical, integrated or none.'),

    body('irrigationType')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(['drip', 'sprinkler', 'rainfed', 'flood', 'other'])
      .withMessage('Irrigation type must be: drip, sprinkler, rainfed, flood or other.'),

    // Post-harvest
    body('dryingMethod')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(['sun', 'mechanical', 'raised_bed', 'greenhouse', 'other'])
      .withMessage('Drying method must be: sun, mechanical, raised_bed, greenhouse or other.'),

    body('dryingDays')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 365 }).withMessage('Drying days must be between 1 and 365.'),

    body('storageMoisture')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 }).withMessage('Storage moisture must be between 0% and 100%.'),
  ],
  validate,
  upsertProductionVariables
)

module.exports = router
