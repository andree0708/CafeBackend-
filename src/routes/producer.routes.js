const { Router } = require('express');
const { body, param } = require('express-validator');
const { getAllProducers, getProducerById, updateProducer } = require('../controllers/producer.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = Router();

// All producer routes require authentication
router.use(authenticate);

// GET /api/producers
router.get('/', getAllProducers);

// GET /api/producers/:id
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Producer id must be a positive integer.')],
  validate,
  getProducerById
);

// PATCH /api/producers/:id
router.patch(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).withMessage('Producer id must be a positive integer.'),
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty.'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty.'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number.'),
  ],
  validate,
  updateProducer
);

module.exports = router;
