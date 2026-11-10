const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMarketFits,
  generateRecommendations,
  opportunityLevel,
} = require('./recommendation.service');

const buildBatch = (overrides = {}) => ({
  id: 1,
  variety: 'geisha',
  processingMethod: 'washed',
  weight: 320,
  farm: { altitude: 1950 },
  ...overrides,
});

const buildVariables = (overrides = {}) => ({
  storageMoisture: 10.5,
  soilPH: 6.1,
  fermentationHours: 36,
  ...overrides,
});

const buildEvaluation = (overrides = {}) => ({
  totalScore: 86,
  defects: 1,
  ...overrides,
});

test('a high-quality specialty lot ranks specialty first', () => {
  const fits = buildMarketFits({
    prediction: { predictedScore: 89.5, qualityCategory: 'SPECIALTY' },
    batch: buildBatch(),
    variables: buildVariables(),
    evaluation: buildEvaluation(),
  });

  assert.equal(fits.length, 4);
  assert.equal(fits[0].market, 'specialty');
  assert.ok(fits[0].fitScore >= 75);
  assert.equal(fits[0].opportunityLevel, 'high');
});

test('market fits are sorted from highest to lowest', () => {
  const fits = buildMarketFits({
    prediction: { predictedScore: 82, qualityCategory: 'PREMIUM' },
    batch: buildBatch(),
    variables: buildVariables(),
    evaluation: buildEvaluation(),
  });

  const scores = fits.map((fit) => fit.fitScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test('a low-grade lot favors local market over specialty', () => {
  const fits = buildMarketFits({
    prediction: { predictedScore: 62, qualityCategory: 'COMMERCIAL' },
    batch: buildBatch({ variety: 'caturra', processingMethod: 'other', weight: 40, farm: { altitude: 1100 } }),
    variables: buildVariables({ storageMoisture: 14, soilPH: 4.8, fermentationHours: 120 }),
    evaluation: buildEvaluation({ totalScore: 68, defects: 18 }),
  });

  const specialty = fits.find((fit) => fit.market === 'specialty');
  const local = fits.find((fit) => fit.market === 'local');
  assert.ok(local.fitScore > specialty.fitScore);
  assert.equal(local.market, fits[0].market);
});

test('recommendations include the market fit metadata', () => {
  const fits = buildMarketFits({
    prediction: { predictedScore: 89.5, qualityCategory: 'SPECIALTY' },
    batch: buildBatch(),
    variables: buildVariables(),
    evaluation: buildEvaluation(),
  });

  const recommendations = generateRecommendations({
    prediction: { predictedScore: 89.5, qualityCategory: 'SPECIALTY' },
    batch: buildBatch(),
    variables: buildVariables(),
    evaluation: buildEvaluation(),
    marketFits: fits,
  });

  const marketRecommendation = recommendations.find((item) => item.market);
  assert.ok(marketRecommendation);
  assert.equal(typeof marketRecommendation.fitScore, 'number');
  assert.ok(['low', 'medium', 'high'].includes(marketRecommendation.opportunityLevel));
  assert.ok(marketRecommendation.rationale.length > 0);
});

test('opportunity level thresholds are stable', () => {
  assert.equal(opportunityLevel(80), 'high');
  assert.equal(opportunityLevel(75), 'high');
  assert.equal(opportunityLevel(60), 'medium');
  assert.equal(opportunityLevel(55), 'medium');
  assert.equal(opportunityLevel(40), 'low');
});
