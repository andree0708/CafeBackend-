const { classify } = require('./quality.service');

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = (value) => Math.round(value * 10) / 10;

const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

const serializePrediction = (prediction) => {
  if (!prediction) return null;
  return {
    ...prediction,
    topFactors: parseJson(prediction.topFactors, []),
    inputFeatures: parseJson(prediction.inputFeatures, null),
    rawOutput: parseJson(prediction.rawOutput, null),
  };
};

const serializePredictionRun = (run) => {
  if (!run) return null;
  return {
    ...run,
    topFactors: parseJson(run.topFactors, []),
    inputFeatures: parseJson(run.inputFeatures, null),
    rawOutput: parseJson(run.rawOutput, null),
  };
};

const buildAiPayload = ({ batch, variables }) => ({
  batchId: batch.id,
  variety: batch.variety,
  processingMethod: batch.processingMethod,
  altitude: batch.farm?.altitude,
  variables: variables || {},
});

/**
 * Deterministic fallback used only when the AI service is unavailable and
 * AI_FALLBACK_ENABLED is not disabled. It never uses Math.random(), so the
 * same lot always produces the same fallback result.
 */
const buildFallbackPrediction = ({ batch, variables, reason }) => {
  const v = variables || {};
  let score = 70;
  const factors = [];

  const add = (condition, points, feature, label, value) => {
    if (!condition) return;
    score += points;
    factors.push({
      feature,
      label,
      value,
      contribution: points,
      direction: points >= 0 ? 'positive' : 'negative',
    });
  };

  add(v.avgTemperature >= 17 && v.avgTemperature <= 23, 3, 'avgTemperature', 'Average temperature', v.avgTemperature);
  add(v.avgRainfall >= 1500 && v.avgRainfall <= 2500, 2, 'avgRainfall', 'Annual rainfall', v.avgRainfall);
  add(v.avgHumidity >= 70 && v.avgHumidity <= 85, 2, 'avgHumidity', 'Relative humidity', v.avgHumidity);
  add(v.soilPH >= 5.5 && v.soilPH <= 6.5, 4, 'soilPH', 'Soil pH', v.soilPH);
  add(v.soilOrganicMatter > 3, 3, 'soilOrganicMatter', 'Soil organic matter', v.soilOrganicMatter);
  add(v.dryingMethod === 'raised_bed', 4, 'dryingMethod', 'Drying method', v.dryingMethod);
  add(v.dryingMethod === 'sun', 2, 'dryingMethod', 'Drying method', v.dryingMethod);
  add(v.storageMoisture != null && v.storageMoisture <= 11, 3, 'storageMoisture', 'Storage moisture', v.storageMoisture);
  add(v.pestControlType === 'organic', 2, 'pestControlType', 'Pest control', v.pestControlType);
  add(v.fermentationHours >= 12 && v.fermentationHours <= 72, 2, 'fermentationHours', 'Fermentation hours', v.fermentationHours);
  add(v.soilType === 'volcanic', 2, 'soilType', 'Soil type', v.soilType);

  const altitude = batch?.farm?.altitude;
  add(altitude >= 1600 && altitude <= 2100, 3, 'altitude', 'Altitude', altitude);
  add(batch?.variety === 'geisha', 4, 'variety', 'Variety', batch?.variety);
  add(['washed', 'honey'].includes(batch?.processingMethod), 1, 'processingMethod', 'Processing method', batch?.processingMethod);

  const provided = Object.values(v).filter((value) => value !== null && value !== undefined && value !== '').length;
  const confidence = Math.min(0.75, 0.5 + provided * 0.02);

  score = round1(clamp(score));
  factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    predictedScore: score,
    qualityCategory: classify(score),
    confidenceLevel: Math.round(confidence * 100) / 100,
    confidenceMethod: 'rule_based',
    modelVersion: 'fallback-rules-v2',
    explanationMethod: 'rule_based',
    topFactors: factors.slice(0, 6),
    usedFallback: true,
    fallbackReason: reason || 'AI service unavailable.',
  };
};

module.exports = {
  parseJson,
  serializePrediction,
  serializePredictionRun,
  buildAiPayload,
  buildFallbackPrediction,
};
