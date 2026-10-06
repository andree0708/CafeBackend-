const { Router } = require('express');
const { body, param } = require('express-validator');
const {
  getProductionVariables,
  upsertProductionVariables,
} = require('../controllers/productionVariables.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = Router();

router.use(authenticate);

// GET /api/batches/:batchId/variables
router.get(
  '/:batchId/variables',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getProductionVariables
);

// POST /api/batches/:batchId/variables
router.post(
  '/:batchId/variables',
  [
    param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),
    body('avgTemperature').optional().isFloat().withMessage('Temperature must be a number.'),
    body('avgRainfall').optional().isFloat({ min: 0 }).withMessage('Rainfall must be a non-negative number.'),
    body('avgHumidity').optional().isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0 and 100.'),
    body('soilPH').optional().isFloat({ min: 0, max: 14 }).withMessage('Soil pH must be between 0 and 14.'),
    body('soilOrganicMatter').optional().isFloat({ min: 0 }).withMessage('Organic matter must be a non-negative number.'),
    body('dryingDays').optional().isInt({ min: 1 }).withMessage('Drying days must be a positive integer.'),
    body('storageMoisture').optional().isFloat({ min: 0, max: 100 }).withMessage('Storage moisture must be between 0 and 100.'),
  ],
  validate,
  upsertProductionVariables
);

module.exports = router;
