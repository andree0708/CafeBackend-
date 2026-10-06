const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * Simulates the ML model scoring logic based on production variables.
 * This stub will be replaced by a real call to the Python AI service.
 *
 * Score range: 0 – 100 (SCA scale)
 * Category thresholds:
 *   >= 85 → SPECIALTY
 *   >= 75 → PREMIUM
 *   >= 60 → COMMERCIAL
 *    < 60 → LOW_GRADE
 */
const runMockModel = (variables) => {
  let score = 70; // baseline

  if (variables) {
    // Climate factors
    if (variables.avgTemperature >= 17 && variables.avgTemperature <= 23) score += 3;
    if (variables.avgRainfall >= 1500 && variables.avgRainfall <= 2500) score += 2;
    if (variables.avgHumidity >= 70 && variables.avgHumidity <= 85) score += 2;

    // Soil factors
    if (variables.soilPH >= 5.5 && variables.soilPH <= 6.5) score += 4;
    if (variables.soilOrganicMatter && variables.soilOrganicMatter > 3) score += 3;

    // Post-harvest factors
    if (variables.dryingMethod === 'raised bed') score += 4;
    if (variables.dryingMethod === 'sun') score += 2;
    if (variables.storageMoisture && variables.storageMoisture <= 11) score += 3;
    if (variables.pestControlType === 'organic') score += 2;
  }

  // Add small random variance (±3 points) to simulate model uncertainty
  score += Math.random() * 6 - 3;
  score = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

  let qualityCategory;
  if (score >= 85) qualityCategory = 'SPECIALTY';
  else if (score >= 75) qualityCategory = 'PREMIUM';
  else if (score >= 60) qualityCategory = 'COMMERCIAL';
  else qualityCategory = 'LOW_GRADE';

  const confidence = variables ? 0.78 + Math.random() * 0.15 : 0.45;

  return {
    predictedScore: score,
    qualityCategory,
    confidenceLevel: Math.round(confidence * 100) / 100,
  };
};

/**
 * Generates rule-based recommendations based on prediction results and variables.
 */
const generateRecommendations = (prediction, variables) => {
  const recs = [];

  if (prediction.qualityCategory === 'SPECIALTY') {
    recs.push({
      title: 'Target specialty coffee buyers',
      description:
        'Your batch qualifies as specialty coffee (score ≥ 85). Consider direct trade channels, specialty roasters, or auction platforms like Cup of Excellence.',
      category: 'commercialization',
      priority: 'high',
    });
  }

  if (prediction.qualityCategory === 'PREMIUM') {
    recs.push({
      title: 'Explore premium export markets',
      description:
        'Score between 75–84 qualifies as premium. Consider export certifications (Fair Trade, Rainforest Alliance) to increase market value.',
      category: 'commercialization',
      priority: 'high',
    });
  }

  if (prediction.qualityCategory === 'COMMERCIAL' || prediction.qualityCategory === 'LOW_GRADE') {
    recs.push({
      title: 'Review post-harvest process',
      description:
        'Lower scores often relate to post-harvest issues. Evaluate drying method, storage moisture levels, and processing technique.',
      category: 'processing',
      priority: 'high',
    });
  }

  if (variables?.soilPH && (variables.soilPH < 5.5 || variables.soilPH > 6.5)) {
    recs.push({
      title: 'Correct soil pH',
      description: `Optimal coffee pH is 5.5–6.5. Your current pH is ${variables.soilPH}. Apply lime to raise pH or sulfur to lower it.`,
      category: 'agronomic',
      priority: 'medium',
    });
  }

  if (variables?.storageMoisture && variables.storageMoisture > 12) {
    recs.push({
      title: 'Reduce storage moisture',
      description: `Storage moisture of ${variables.storageMoisture}% exceeds the safe threshold of 12%. High moisture leads to mold and quality loss.`,
      category: 'processing',
      priority: 'high',
    });
  }

  if (variables?.avgTemperature && (variables.avgTemperature < 17 || variables.avgTemperature > 23)) {
    recs.push({
      title: 'Evaluate crop altitude or shade management',
      description:
        'Optimal coffee growing temperature is 17–23°C. Consider shade trees or evaluate altitude suitability for your variety.',
      category: 'agronomic',
      priority: 'medium',
    });
  }

  // Always add a general traceability recommendation
  recs.push({
    title: 'Document full traceability',
    description:
      'Keep detailed records of all production variables per batch. Buyers in specialty markets value complete and verifiable traceability.',
    category: 'commercialization',
    priority: 'low',
  });

  return recs;
};

/**
 * GET /api/batches/:batchId/prediction
 * Returns the current prediction for a batch.
 */
const getPrediction = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        farm: { include: { producer: { select: { userId: true } } } },
        aiPrediction: true,
      },
    });

    if (!batch) return next(createError('Batch not found.', 404));

    if (req.user.role !== 'ADMIN' && batch.farm.producer.userId !== req.user.id) {
      return next(createError('You do not have permission to view this prediction.', 403));
    }

    if (!batch.aiPrediction) {
      return res.status(200).json({
        success: true,
        message: 'No prediction has been requested for this batch yet.',
        data: { prediction: null },
      });
    }

    res.status(200).json({ success: true, data: { prediction: batch.aiPrediction } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/batches/:batchId/prediction
 * Triggers a quality prediction for the batch.
 * Currently uses a mock model. Replace runMockModel() with an HTTP call
 * to the Python AI service when it is ready.
 */
const requestPrediction = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId);

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        farm: { include: { producer: { select: { userId: true } } } },
        productionVariables: true,
        aiPrediction: true,
      },
    });

    if (!batch) return next(createError('Batch not found.', 404));

    if (req.user.role !== 'ADMIN' && batch.farm.producer.userId !== req.user.id) {
      return next(createError('You do not have permission to request a prediction for this batch.', 403));
    }

    // If a prediction already exists and is DONE, return it (idempotent)
    if (batch.aiPrediction?.status === 'DONE') {
      return res.status(200).json({
        success: true,
        message: 'Prediction already completed for this batch.',
        data: { prediction: batch.aiPrediction },
      });
    }

    // Mark as PROCESSING
    await prisma.aIPrediction.upsert({
      where: { batchId },
      update: { status: 'PROCESSING', errorMessage: null },
      create: { batchId, status: 'PROCESSING' },
    });

    // ── Run model (stub) ──────────────────────────────────────────────────────
    // TODO: Replace this block with an HTTP POST to the Python AI service:
    //   const aiResponse = await fetch(process.env.AI_SERVICE_URL + '/predict', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ batchId, variables: batch.productionVariables }),
    //   });
    //   const result = await aiResponse.json();
    const result = runMockModel(batch.productionVariables);
    // ─────────────────────────────────────────────────────────────────────────

    // Save prediction result
    const prediction = await prisma.aIPrediction.update({
      where: { batchId },
      data: {
        status: 'DONE',
        predictedScore: result.predictedScore,
        qualityCategory: result.qualityCategory,
        confidenceLevel: result.confidenceLevel,
        modelVersion: 'stub-v1.0',
        inputFeatures: batch.productionVariables ?? {},
        completedAt: new Date(),
      },
    });

    // Generate and save recommendations
    const recData = generateRecommendations(result, batch.productionVariables);
    await prisma.recommendation.deleteMany({ where: { batchId } }); // fresh set
    await prisma.recommendation.createMany({
      data: recData.map((r) => ({ ...r, batchId })),
    });

    res.status(200).json({
      success: true,
      message: 'Prediction completed successfully.',
      data: {
        prediction,
        recommendations: recData,
      },
    });
  } catch (error) {
    // Mark as ERROR if something fails mid-process
    try {
      await prisma.aIPrediction.updateMany({
        where: { batchId: Number(req.params.batchId), status: 'PROCESSING' },
        data: { status: 'ERROR', errorMessage: error.message },
      });
    } catch (_) { /* best-effort */ }
    next(error);
  }
};

module.exports = { getPrediction, requestPrediction };
