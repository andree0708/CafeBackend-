const { Router } = require('express');
const { body, param } = require('express-validator');
const {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} = require('../controllers/batch.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = Router();

router.use(authenticate);

// GET /api/batches
router.get('/', getAllBatches);

// GET /api/batches/:id
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getBatchById
);

// POST /api/farms/:farmId/batches
router.post(
  '/farms/:farmId/batches',
  [
    param('farmId').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.'),
    body('code').trim().notEmpty().withMessage('Batch code is required.'),
    body('harvestDate').isISO8601().withMessage('Harvest date must be a valid ISO 8601 date.'),
    body('processingMethod').optional().trim().notEmpty(),
    body('variety').optional().trim().notEmpty(),
    body('weight').optional().isFloat({ gt: 0 }).withMessage('Weight must be a positive number.'),
    body('notes').optional().trim(),
  ],
  validate,
  createBatch
);

// PUT /api/batches/:id
router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),
    body('code').optional().trim().notEmpty().withMessage('Batch code cannot be empty.'),
    body('harvestDate').optional().isISO8601().withMessage('Harvest date must be a valid ISO 8601 date.'),
    body('weight').optional().isFloat({ gt: 0 }).withMessage('Weight must be a positive number.'),
  ],
  validate,
  updateBatch
);

// DELETE /api/batches/:id
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  deleteBatch
);

module.exports = router;
