const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

const classify = (score) => {
  if (score >= 85) return 'SPECIALTY';
  if (score >= 75) return 'PREMIUM';
  if (score >= 60) return 'COMMERCIAL';
  return 'LOW_GRADE';
};

const runMockModel = (variables, extras = {}) => {
  let score = 70;

  if (variables) {
    if (variables.avgTemperature >= 17 && variables.avgTemperature <= 23) score += 3;
    if (variables.avgRainfall >= 1500 && variables.avgRainfall <= 2500) score += 2;
    if (variables.avgHumidity >= 70 && variables.avgHumidity <= 85) score += 2;
    if (variables.soilPH >= 5.5 && variables.soilPH <= 6.5) score += 4;
    if (variables.soilOrganicMatter && variables.soilOrganicMatter > 3) score += 3;
    if (variables.dryingMethod === 'raised_bed') score += 4;
    if (variables.dryingMethod === 'sun') score += 2;
    if (variables.storageMoisture && variables.storageMoisture <= 11) score += 3;
    if (variables.pestControlType === 'organic') score += 2;
  }
  if (extras.altitude >= 1600 && extras.altitude <= 2100) score += 3;
  if (extras.variety === 'geisha') score += 4;
  if (extras.processingMethod === 'washed' || extras.processingMethod === 'honey') score += 1;

  score += Math.random() * 6 - 3;
  score = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

  return {
    predictedScore: score,
    qualityCategory: classify(score),
    confidenceLevel: Math.round((variables ? 0.72 + Math.random() * 0.18 : 0.42) * 100) / 100,
    modelVersion: 'fallback-rules-v1',
  };
};

const callAiService = async (payload) => {
  const base = process.env.AI_SERVICE_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    const data = await res.json();
    if (typeof data.predictedScore !== 'number') throw new Error('Invalid AI payload');
    return {
      predictedScore: data.predictedScore,
      qualityCategory: data.qualityCategory || classify(data.predictedScore),
      confidenceLevel: data.confidenceLevel ?? 0.7,
      modelVersion: data.modelVersion || 'cafe-rf-v1',
      rawOutput: data,
    };
  } finally {
    clearTimeout(timer);
  }
};

const generateRecommendations = (prediction, variables) => {
  const recs = [];

  if (prediction.qualityCategory === 'SPECIALTY') {
    recs.push({
      title: 'Canal de especialidad',
      description:
        'El lote califica como especialidad (score ≥ 85). Prioriza comercio directo, tostadores de origen y, si hay volumen y consistencia, concursos o subastas.',
      category: 'commercialization',
      priority: 'high',
    });
  } else if (prediction.qualityCategory === 'PREMIUM') {
    recs.push({
      title: 'Mercado premium y certificaciones',
      description:
        'El rango 75–84 admite exportación diferenciada. Evalúa sellos (Fair Trade, Rainforest, orgánico) y ajusta poscosecha para acercarte a especialidad.',
      category: 'commercialization',
      priority: 'high',
    });
  } else {
    recs.push({
      title: 'Revisar beneficio y almacenamiento',
      description:
        'Puntajes más bajos suelen originarse en secado, humedad de almacenamiento o fermentación. Documenta el proceso lote a lote antes de la próxima cosecha.',
      category: 'processing',
      priority: 'high',
    });
  }

  if (variables?.soilPH && (variables.soilPH < 5.5 || variables.soilPH > 6.5)) {
    recs.push({
      title: 'Corregir pH del suelo',
      description: `El rango óptimo para café es 5.5–6.5. El valor registrado es ${variables.soilPH}. Cal o azufre según el análisis de suelos.`,
      category: 'agronomic',
      priority: 'medium',
    });
  }

  if (variables?.storageMoisture && variables.storageMoisture > 12) {
    recs.push({
      title: 'Bajar humedad de almacenamiento',
      description: `Humedad de ${variables.storageMoisture}% supera el umbral seguro de 12%. Riesgo de hongos y pérdida de taza.`,
      category: 'processing',
      priority: 'high',
    });
  }

  if (variables?.avgTemperature && (variables.avgTemperature < 17 || variables.avgTemperature > 23)) {
    recs.push({
      title: 'Manejo de sombra y altitud',
      description:
        'La temperatura óptima de cultivo está entre 17 y 23 °C. Revisa sombrío y aptitud de la variedad en esa finca.',
      category: 'agronomic',
      priority: 'medium',
    });
  }

  recs.push({
    title: 'Trazabilidad completa',
    description:
      'Conserva variables, fechas y proceso por lote. Los compradores de especialidad pagan por evidencia verificable, no solo por el puntaje.',
    category: 'commercialization',
    priority: 'low',
  });

  return recs;
};

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

    await prisma.aIPrediction.upsert({
      where: { batchId },
      update: { status: 'PROCESSING', errorMessage: null },
      create: { batchId, status: 'PROCESSING' },
    });

    const payload = {
      batchId,
      variety: batch.variety,
      processingMethod: batch.processingMethod,
      altitude: batch.farm.altitude,
      variables: batch.productionVariables,
    };

    let result;
    try {
      result = await callAiService(payload);
    } catch (err) {
      console.warn('[AI] service unavailable, using fallback:', err.message);
      result = null;
    }
    if (!result) {
      result = runMockModel(batch.productionVariables, {
        altitude: batch.farm.altitude,
        variety: batch.variety,
        processingMethod: batch.processingMethod,
      });
    }

    const prediction = await prisma.aIPrediction.update({
      where: { batchId },
      data: {
        status: 'DONE',
        predictedScore: result.predictedScore,
        qualityCategory: result.qualityCategory,
        confidenceLevel: result.confidenceLevel,
        modelVersion: result.modelVersion,
        inputFeatures: JSON.stringify({
          ...(batch.productionVariables || {}),
          variety: batch.variety,
          processingMethod: batch.processingMethod,
          altitude: batch.farm.altitude,
        }),
        rawOutput: result.rawOutput ? JSON.stringify(result.rawOutput) : null,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    const recData = generateRecommendations(result, batch.productionVariables);
    await prisma.recommendation.deleteMany({ where: { batchId } });
    await prisma.recommendation.createMany({
      data: recData.map((r) => ({ ...r, batchId })),
    });

    res.status(200).json({
      success: true,
      message: 'Prediction completed successfully.',
      data: { prediction, recommendations: recData },
    });
  } catch (error) {
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
