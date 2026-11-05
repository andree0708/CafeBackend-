const { Router } = require('express');
const { body, param } = require('express-validator');
const {
  getEvaluation,
  upsertEvaluation,
  deleteEvaluation,
} = require('../controllers/coffeeEvaluation.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = Router();

router.use(authenticate);

// Reusable score validator: SCA scores go from 6.00 to 10.00
const scaScore = (field, label) =>
  body(field)
    .optional({ nullable: true })
    .isFloat({ min: 6, max: 10 })
    .withMessage(`${label} must be between 6.00 and 10.00 (SCA scale).`);

// GET /api/batches/:batchId/evaluation
router.get(
  '/:batchId/evaluation',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  getEvaluation
);

// POST /api/batches/:batchId/evaluation
router.post(
  '/:batchId/evaluation',
  [
    param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.'),

    scaScore('fragranceScore',  'Fragrance/Aroma'),
    scaScore('flavorScore',     'Flavor'),
    scaScore('aftertasteScore', 'Aftertaste'),
    scaScore('acidityScore',    'Acidity'),
    scaScore('bodyScore',       'Body'),
    scaScore('balanceScore',    'Balance'),
    scaScore('uniformityScore', 'Uniformity'),
    scaScore('cleanCupScore',   'Clean Cup'),
    scaScore('sweetnessScore',  'Sweetness'),
    scaScore('overallScore',    'Overall'),

    body('defects')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 100 })
      .withMessage('Defects must be an integer between 0 and 100.'),

    body('evaluatorName')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Evaluator name must be between 2 and 100 characters.'),

    body('evaluationDate')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('Evaluation date must be a valid ISO 8601 date.')
      .custom((v) => {
        if (new Date(v) > new Date()) throw new Error('Evaluation date cannot be in the future.');
        return true;
      }),

    body('notes')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must not exceed 1,000 characters.'),
  ],
  validate,
  upsertEvaluation
);

// DELETE /api/batches/:batchId/evaluation
router.delete(
  '/:batchId/evaluation',
  [param('batchId').isInt({ gt: 0 }).withMessage('Batch id must be a positive integer.')],
  validate,
  deleteEvaluation
);

module.exports = router;
