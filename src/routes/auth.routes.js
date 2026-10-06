const { Router } = require('express')
const { body } = require('express-validator')
const { register, login, getMe, changePassword } = require('../controllers/auth.controller')
const { authenticate } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')

const router = Router()

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email')
      .trim()
      .isEmail().withMessage('A valid email is required.')
      .normalizeEmail()
      .isLength({ max: 100 }).withMessage('Email must not exceed 100 characters.'),

    body('password')
      .isLength({ min: 8, max: 64 }).withMessage('Password must be between 8 and 64 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.')
      .not().matches(/\s/).withMessage('Password must not contain spaces.'),

    body('firstName')
      .trim()
      .notEmpty().withMessage('First name is required.')
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters.')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/).withMessage('First name must contain only letters.'),

    body('lastName')
      .trim()
      .notEmpty().withMessage('Last name is required.')
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
  register
)

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail().withMessage('A valid email is required.')
      .normalizeEmail()
      .isLength({ max: 100 }).withMessage('Email must not exceed 100 characters.'),

    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ max: 64 }).withMessage('Password must not exceed 64 characters.'),
  ],
  validate,
  login
)

// GET /api/auth/me  (protected)
router.get('/me', authenticate, getMe)

// PATCH /api/auth/change-password  (protected)
router.patch(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required.')
      .isLength({ max: 64 }).withMessage('Password must not exceed 64 characters.'),

    body('newPassword')
      .isLength({ min: 8, max: 64 }).withMessage('New password must be between 8 and 64 characters.')
      .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter.')
      .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter.')
      .matches(/[0-9]/).withMessage('New password must contain at least one number.')
      .not().matches(/\s/).withMessage('New password must not contain spaces.')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from the current password.')
        }
        return true
      }),
  ],
  validate,
  changePassword
)

module.exports = router
