const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');
const { generateBatchAnalysis } = require('../services/groq.service');

const analysisInclude = {
  farm: { include: { producer: { select: { userId: true } } } },
  productionVariables: true,
  coffeeEvaluation: true,
  aiPrediction: true,
  marketFits: { orderBy: { fitScore: 'desc' } },
};

const assertCanAccess = (batch, user) => {
  if (user.role !== 'ADMIN' && batch.farm.producer.userId !== user.id) {
    throw createError('You do not have permission to access this batch.', 403);
  }
};

// POST /api/batches/:batchId/ai-analysis
const requestAiAnalysis = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);
    const batch = await prisma.batch.findUnique({ where: { id: batchId }, include: analysisInclude });
    if (!batch) return next(createError('Batch not found.', 404));
    assertCanAccess(batch, req.user);

    const prediction = batch.aiPrediction;
    if (!prediction || prediction.status !== 'DONE') {
      return next(createError('Request a model prediction for this batch first.', 409));
    }

    let topFactors = [];
    try {
      topFactors = JSON.parse(prediction.topFactors || '[]');
    } catch (_) {
      topFactors = [];
    }

    const { analysis, model } = await generateBatchAnalysis({
      batch,
      prediction: {
        predictedScore: prediction.predictedScore,
        qualityCategory: prediction.qualityCategory,
        confidenceLevel: prediction.confidenceLevel,
        modelVersion: prediction.modelVersion,
        topFactors,
      },
      marketFits: batch.marketFits,
      evaluation: batch.coffeeEvaluation,
      variables: batch.productionVariables,
    });

    res.status(200).json({
      success: true,
      data: { analysis, model, generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestAiAnalysis,
};
