const { Router } = require('express');
const { body, param } = require('express-validator');
const { getAllFarms, getFarmById, createFarm, updateFarm, deleteFarm } = require('../controllers/farm.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = Router();

// All farm routes require authentication
router.use(authenticate);

// GET /api/farms
router.get('/', getAllFarms);

// GET /api/farms/:id
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.')],
  validate,
  getFarmById
);

// POST /api/farms
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Farm name is required.'),
    body('location').trim().notEmpty().withMessage('Location is required.'),
    body('municipality').optional().trim().notEmpty(),
    body('department').optional().trim().notEmpty(),
    body('hectares').optional().isFloat({ gt: 0 }).withMessage('Hectares must be a positive number.'),
    body('altitude').optional().isFloat({ gt: 0 }).withMessage('Altitude must be a positive number.'),
  ],
  validate,
  createFarm
);

// PUT /api/farms/:id
router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.'),
    body('name').optional().trim().notEmpty().withMessage('Farm name cannot be empty.'),
    body('location').optional().trim().notEmpty().withMessage('Location cannot be empty.'),
    body('hectares').optional().isFloat({ gt: 0 }).withMessage('Hectares must be a positive number.'),
    body('altitude').optional().isFloat({ gt: 0 }).withMessage('Altitude must be a positive number.'),
  ],
  validate,
  updateFarm
);

// DELETE /api/farms/:id
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Farm id must be a positive integer.')],
  validate,
  deleteFarm
);

module.exports = router;
