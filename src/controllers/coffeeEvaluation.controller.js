const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * Verifies the batch exists and belongs to the authenticated user (or user is ADMIN).
 */
const verifyBatchOwnership = async (batchId, userId, role) => {
  const batch = await prisma.batch.findUnique({
    where: { id: Number(batchId) },
    include: { farm: { include: { producer: { select: { userId: true } } } } },
  });
  if (!batch) throw createError('Batch not found.', 404);
  if (role !== 'ADMIN' && batch.farm.producer.userId !== userId) {
    throw createError('You do not have permission to access this batch.', 403);
  }
  return batch;
};

/**
 * GET /api/batches/:batchId/evaluation
 * Returns the cupping evaluation for a batch.
 */
const getEvaluation = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role);

    const evaluation = await prisma.coffeeEvaluation.findUnique({
      where: { batchId: Number(req.params.batchId) },
    });

    if (!evaluation) {
      return res.status(200).json({
        success: true,
        message: 'No cupping evaluation registered for this batch yet.',
        data: { evaluation: null },
      });
    }

    res.status(200).json({ success: true, data: { evaluation } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/batches/:batchId/evaluation
 * Creates or updates (upsert) the cupping evaluation for a batch.
 * Automatically calculates the total score from individual attributes.
 */
const upsertEvaluation = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role);

    const batchId = Number(req.params.batchId);
    const {
      fragranceScore, flavorScore, aftertasteScore, acidityScore,
      bodyScore, balanceScore, uniformityScore, cleanCupScore,
      sweetnessScore, overallScore, defects,
      evaluatorName, evaluationDate, notes,
    } = req.body;

    // SCA total score = sum of 10 attributes (max 100) minus defect penalties
    const scores = [
      fragranceScore, flavorScore, aftertasteScore, acidityScore,
      bodyScore, balanceScore, uniformityScore, cleanCupScore,
      sweetnessScore, overallScore,
    ].filter((s) => s !== undefined && s !== null).map(Number);

    const totalScore = scores.length === 10
      ? Math.round(scores.reduce((a, b) => a + b, 0) * 100) / 100
      : null;

    const data = {
      fragranceScore:  fragranceScore  != null ? Number(fragranceScore)  : undefined,
      flavorScore:     flavorScore     != null ? Number(flavorScore)     : undefined,
      aftertasteScore: aftertasteScore != null ? Number(aftertasteScore) : undefined,
      acidityScore:    acidityScore    != null ? Number(acidityScore)    : undefined,
      bodyScore:       bodyScore       != null ? Number(bodyScore)       : undefined,
      balanceScore:    balanceScore    != null ? Number(balanceScore)    : undefined,
      uniformityScore: uniformityScore != null ? Number(uniformityScore) : undefined,
      cleanCupScore:   cleanCupScore   != null ? Number(cleanCupScore)   : undefined,
      sweetnessScore:  sweetnessScore  != null ? Number(sweetnessScore)  : undefined,
      overallScore:    overallScore    != null ? Number(overallScore)    : undefined,
      totalScore:      totalScore      != null ? totalScore              : undefined,
      defects:         defects         != null ? Number(defects)         : undefined,
      evaluatorName:   evaluatorName   || undefined,
      evaluationDate:  evaluationDate  ? new Date(evaluationDate)        : undefined,
      notes:           notes           || undefined,
    };

    // Remove undefined keys so upsert doesn't overwrite existing values
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    const evaluation = await prisma.coffeeEvaluation.upsert({
      where: { batchId },
      update: data,
      create: { ...data, batchId },
    });

    res.status(200).json({
      success: true,
      message: 'Cupping evaluation saved successfully.',
      data: { evaluation },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/batches/:batchId/evaluation
 * Deletes the cupping evaluation for a batch.
 */
const deleteEvaluation = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role);

    const batchId = Number(req.params.batchId);

    const existing = await prisma.coffeeEvaluation.findUnique({ where: { batchId } });
    if (!existing) return next(createError('No cupping evaluation found for this batch.', 404));

    await prisma.coffeeEvaluation.delete({ where: { batchId } });

    res.status(200).json({ success: true, message: 'Cupping evaluation deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEvaluation, upsertEvaluation, deleteEvaluation };
