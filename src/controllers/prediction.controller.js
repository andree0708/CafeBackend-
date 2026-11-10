const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');
const { predict } = require('../services/ai.service');
const { classify } = require('../services/quality.service');
const { buildMarketFits, generateRecommendations } = require('../services/recommendation.service');
const {
  buildAiPayload,
  buildFallbackPrediction,
  pickVariables,
  serializePrediction,
  serializePredictionRun,
} = require('../services/prediction.service');

const predictionInclude = {
  farm: { include: { producer: { select: { userId: true } } } },
  productionVariables: true,
  coffeeEvaluation: true,
  aiPrediction: true,
  marketFits: { orderBy: { fitScore: 'desc' } },
  predictionRuns: { orderBy: { createdAt: 'desc' }, take: 10 },
};

const findBatch = (batchId) =>
  prisma.batch.findUnique({ where: { id: batchId }, include: predictionInclude });

const assertCanAccess = (batch, user) => {
  if (user.role !== 'ADMIN' && batch.farm.producer.userId !== user.id) {
    throw createError('You do not have permission to access this prediction.', 403);
  }
};

const normalizeResult = (result) => {
  const predictedScore = Math.round(Number(result.predictedScore) * 10) / 10;
  return {
    predictedScore,
    qualityCategory: result.qualityCategory || classify(predictedScore),
    confidenceLevel: Number(result.confidenceLevel ?? 0.7),
    confidenceMethod: result.confidenceMethod || 'tree_dispersion',
    modelVersion: result.modelVersion || 'unknown',
    explanationMethod: result.explanationMethod || null,
    topFactors: Array.isArray(result.topFactors) ? result.topFactors : [],
    usedFallback: Boolean(result.usedFallback),
    fallbackReason: result.fallbackReason || null,
  };
};

const getPrediction = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);
    const batch = await findBatch(batchId);
    if (!batch) return next(createError('Batch not found.', 404));
    assertCanAccess(batch, req.user);

    if (!batch.aiPrediction) {
      return res.status(200).json({
        success: true,
        message: 'No prediction has been requested for this batch yet.',
        data: { prediction: null, marketFits: [], history: [] },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        prediction: serializePrediction(batch.aiPrediction),
        marketFits: batch.marketFits,
        history: batch.predictionRuns.map(serializePredictionRun),
      },
    });
  } catch (error) {
    next(error);
  }
};

const requestPrediction = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);
    const batch = await findBatch(batchId);
    if (!batch) return next(createError('Batch not found.', 404));
    assertCanAccess(batch, req.user);

    await prisma.aIPrediction.upsert({
      where: { batchId },
      update: { status: 'PROCESSING', errorMessage: null },
      create: { batchId, status: 'PROCESSING' },
    });

    const variables = batch.productionVariables || {};
    const payload = buildAiPayload({ batch, variables });

    let result;
    try {
      result = await predict(payload);
    } catch (error) {
      if (process.env.AI_FALLBACK_ENABLED === 'false') {
        await prisma.aIPrediction.update({
          where: { batchId },
          data: { status: 'ERROR', errorMessage: error.message },
        });
        return next(createError(`AI service unavailable: ${error.message}`, 503));
      }
      console.warn('[AI] service unavailable, using deterministic fallback:', error.message);
      result = buildFallbackPrediction({
        batch,
        variables,
        reason: error.message,
      });
    }

    const normalized = normalizeResult(result);
    const inputFeatures = {
      ...pickVariables(variables),
      variety: batch.variety,
      processingMethod: batch.processingMethod,
      altitude: batch.farm?.altitude,
    };

    const prediction = await prisma.aIPrediction.update({
      where: { batchId },
      data: {
        status: 'DONE',
        predictedScore: normalized.predictedScore,
        qualityCategory: normalized.qualityCategory,
        confidenceLevel: normalized.confidenceLevel,
        modelVersion: normalized.modelVersion,
        explanationMethod: normalized.explanationMethod,
        topFactors: JSON.stringify(normalized.topFactors),
        usedFallback: normalized.usedFallback,
        fallbackReason: normalized.fallbackReason,
        inputFeatures: JSON.stringify(inputFeatures),
        rawOutput: JSON.stringify(result),
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await prisma.predictionRun.create({
      data: {
        batchId,
        predictedScore: normalized.predictedScore,
        qualityCategory: normalized.qualityCategory,
        confidenceLevel: normalized.confidenceLevel,
        modelVersion: normalized.modelVersion,
        explanationMethod: normalized.explanationMethod,
        usedFallback: normalized.usedFallback,
        topFactors: JSON.stringify(normalized.topFactors),
        inputFeatures: JSON.stringify(inputFeatures),
        rawOutput: JSON.stringify(result),
      },
    });

    const marketFits = buildMarketFits({
      prediction: normalized,
      batch,
      variables,
      evaluation: batch.coffeeEvaluation,
    });

    await prisma.marketFit.deleteMany({ where: { batchId } });
    await prisma.marketFit.createMany({
      data: marketFits.map((fit) => ({
        batchId,
        market: fit.market,
        fitScore: fit.fitScore,
        opportunityLevel: fit.opportunityLevel,
        rationale: fit.rationale,
      })),
    });

    const recData = generateRecommendations({
      prediction: normalized,
      batch,
      variables,
      evaluation: batch.coffeeEvaluation,
      marketFits,
    });

    await prisma.recommendation.deleteMany({ where: { batchId } });
    await prisma.recommendation.createMany({
      data: recData.map((recommendation) => ({ ...recommendation, batchId })),
    });

    res.status(200).json({
      success: true,
      message: normalized.usedFallback
        ? 'Prediction completed with the fallback model.'
        : 'Prediction completed successfully.',
      data: {
        prediction: serializePrediction(prediction),
        recommendations: recData,
        marketFits,
      },
    });
  } catch (error) {
    try {
      await prisma.aIPrediction.updateMany({
        where: { batchId: Number(req.params.batchId), status: 'PROCESSING' },
        data: { status: 'ERROR', errorMessage: error.message },
      });
    } catch (_) {
      /* best-effort */
    }
    next(error);
  }
};

const getPredictionHistory = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);
    const batch = await findBatch(batchId);
    if (!batch) return next(createError('Batch not found.', 404));
    assertCanAccess(batch, req.user);

    res.status(200).json({
      success: true,
      data: { history: batch.predictionRuns.map(serializePredictionRun) },
    });
  } catch (error) {
    next(error);
  }
};

const getMarketFits = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);
    const batch = await findBatch(batchId);
    if (!batch) return next(createError('Batch not found.', 404));
    assertCanAccess(batch, req.user);

    res.status(200).json({
      success: true,
      data: { marketFits: batch.marketFits },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrediction,
  requestPrediction,
  getPredictionHistory,
  getMarketFits,
};
