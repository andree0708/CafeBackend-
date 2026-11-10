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

const VARIABLE_KEYS = [
  'avgTemperature',
  'avgRainfall',
  'avgHumidity',
  'soilPH',
  'soilOrganicMatter',
  'soilNitrogen',
  'fertilizationFrequency',
  'pestControlType',
  'irrigationType',
  'dryingMethod',
  'dryingDays',
  'storageMoisture',
  'fermentationHours',
  'soilType',
];

/**
 * Keeps only agronomic fields, so database bookkeeping (ids, timestamps) never
 * leaks into the stored prediction snapshot.
 */
const pickVariables = (variables) => {
  const result = {};
  for (const key of VARIABLE_KEYS) {
    const value = variables?.[key];
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
};

const buildAiPayload = ({ batch, variables }) => ({
  batchId: batch.id,
  variety: batch.variety,
  processingMethod: batch.processingMethod,
  altitude: batch.farm?.altitude,
  variables: pickVariables(variables),
});

/**
 * Deterministic fallback used only when the AI service is unavailable and
 * AI_FALLBACK_ENABLED is not disabled. It never uses Math.random(), so the
 * same lot always produces the same fallback result.
 */
const buildFallbackPrediction = ({ batch, variables, reason }) => {
  const v = variables || {};
  const BASE_SCORE = 68;
  const WEIGHT = 0.6;
  let total = 0;
  const factors = [];

  const isPresent = (value) => value !== null && value !== undefined && value !== '';

  // Adds an effective contribution only when the value was actually recorded.
  // This keeps missing data neutral instead of silently rewarding the lot.
  const add = (value, points, feature, label) => {
    if (!isPresent(value)) return;
    const effective = round1(points * WEIGHT);
    total += effective;
    factors.push({
      feature,
      label,
      value,
      contribution: effective,
      direction: effective >= 0 ? 'positive' : 'negative',
    });
  };

  const temperature = v.avgTemperature;
  if (isPresent(temperature)) {
    add(temperature, temperature >= 17 && temperature <= 23 ? 3 : -3, 'avgTemperature', 'Average temperature');
  }

  const rainfall = v.avgRainfall;
  if (isPresent(rainfall)) {
    add(rainfall, rainfall >= 1500 && rainfall <= 2500 ? 2 : -2, 'avgRainfall', 'Annual rainfall');
  }

  const humidity = v.avgHumidity;
  if (isPresent(humidity)) {
    add(humidity, humidity >= 70 && humidity <= 85 ? 2 : -2, 'avgHumidity', 'Relative humidity');
  }

  const ph = v.soilPH;
  if (isPresent(ph)) {
    add(ph, ph >= 5.5 && ph <= 6.5 ? 4 : -4, 'soilPH', 'Soil pH');
  }

  const organicMatter = v.soilOrganicMatter;
  if (isPresent(organicMatter)) {
    add(organicMatter, organicMatter > 3 ? 3 : -2, 'soilOrganicMatter', 'Soil organic matter');
  }

  const dryingMethod = v.dryingMethod;
  if (isPresent(dryingMethod)) {
    const dryingPoints = { raised_bed: 4, sun: 2, greenhouse: 2, mechanical: -1, other: -2 };
    add(dryingMethod, dryingPoints[dryingMethod] ?? -2, 'dryingMethod', 'Drying method');
  }

  const storageMoisture = v.storageMoisture;
  if (isPresent(storageMoisture)) {
    const moisturePoints = storageMoisture <= 11 ? 3 : storageMoisture <= 12 ? 1 : -4;
    add(storageMoisture, moisturePoints, 'storageMoisture', 'Storage moisture');
  }

  const pestControlType = v.pestControlType;
  if (isPresent(pestControlType)) {
    const pestPoints = { organic: 2, integrated: 1, chemical: -2, none: -2 };
    add(pestControlType, pestPoints[pestControlType] ?? 0, 'pestControlType', 'Pest control');
  }

  const fermentationHours = v.fermentationHours;
  if (isPresent(fermentationHours)) {
    const fermentationPoints = fermentationHours >= 12 && fermentationHours <= 72 ? 2 : -3;
    add(fermentationHours, fermentationPoints, 'fermentationHours', 'Fermentation hours');
  }

  const soilType = v.soilType;
  if (isPresent(soilType)) {
    const soilPoints = { volcanic: 2, loam: 1, clay: -1, sandy: -2, other: 0 };
    add(soilType, soilPoints[soilType] ?? 0, 'soilType', 'Soil type');
  }

  const altitude = batch?.farm?.altitude;
  if (isPresent(altitude)) {
    const altitudePoints = altitude >= 1600 && altitude <= 2100 ? 3 : altitude >= 1400 ? 1 : -3;
    add(altitude, altitudePoints, 'altitude', 'Altitude');
  }

  const variety = batch?.variety;
  if (isPresent(variety)) {
    const varietyPoints = variety === 'geisha' ? 4 : ['bourbon', 'typica', 'tabi'].includes(variety) ? 2 : 0;
    add(variety, varietyPoints, 'variety', 'Variety');
  }

  const processingMethod = batch?.processingMethod;
  if (isPresent(processingMethod)) {
    const processPoints = ['washed', 'honey', 'natural', 'anaerobic'].includes(processingMethod) ? 1 : -1;
    add(processingMethod, processPoints, 'processingMethod', 'Processing method');
  }

  const provided = Object.values(v).filter(isPresent).length;
  const confidence = Math.min(0.75, 0.5 + provided * 0.02);

  const score = round1(clamp(BASE_SCORE + total, 40, 92));
  factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    predictedScore: score,
    qualityCategory: classify(score),
    confidenceLevel: Math.round(confidence * 100) / 100,
    confidenceMethod: 'rule_based',
    modelVersion: 'fallback-rules-v2',
    explanationMethod: 'rule_based',
    baselineScore: BASE_SCORE,
    topFactors: factors.slice(0, 6),
    usedFallback: true,
    fallbackReason: reason || 'AI service unavailable.',
  };
};

module.exports = {
  parseJson,
  serializePrediction,
  serializePredictionRun,
  pickVariables,
  buildAiPayload,
  buildFallbackPrediction,
};
