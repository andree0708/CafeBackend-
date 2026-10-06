const { Router } = require('express')
const { body, param } = require('express-validator')
const { getAllProducers, getProducerById, updateProducer } = require('../controllers/producer.controller')
const { authenticate, authorize } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

router.use(authenticate)

// GET /api/producers
router.get('/', getAllProducers)

// GET /api/producers/:id
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Producer id must be a positive integer.')],
  validate,
  getProducerById
)

// PATCH /api/producers/:id
router.patch(
  '/:id',
  [
    param('id')
      .isInt({ gt: 0 }).withMessage('Producer id must be a positive integer.'),

    body('firstName')
      .optional()
      .trim()
      .notEmpty().withMessage('First name cannot be empty.')
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters.')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/).withMessage('First name must contain only letters.'),

    body('lastName')
      .optional()
      .trim()
      .notEmpty().withMessage('Last name cannot be empty.')
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters.')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/).withMessage('Last name must contain only letters.'),

    body('phone')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 20 }).withMessage('Phone must not exceed 20 characters.')
      .matches(/^\+?[0-9\s\-().]{7,20}$/).withMessage('Invalid phone number format.'),

    body('document')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 5, max: 20 }).withMessage('Document must be between 5 and 20 characters.')
      .matches(/^[a-zA-Z0-9\-]+$/).withMessage('Document must contain only alphanumeric characters.'),
  ],
  validate,
  updateProducer
)

module.exports = router
