const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pickVariables,
  buildAiPayload,
  buildFallbackPrediction,
  serializePrediction,
} = require('./prediction.service');

const batch = {
  id: 3,
  variety: 'geisha',
  processingMethod: 'washed',
  farm: { altitude: 1850 },
};

test('pickVariables keeps agronomic fields and drops bookkeeping', () => {
  const variables = {
    id: 10,
    batchId: 3,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    avgTemperature: 20.5,
    soilPH: 6.1,
    soilType: 'volcanic',
    fermentationHours: null,
    storageMoisture: '',
  };

  assert.deepEqual(pickVariables(variables), {
    avgTemperature: 20.5,
    soilPH: 6.1,
    soilType: 'volcanic',
  });
});

test('pickVariables tolerates missing input', () => {
  assert.deepEqual(pickVariables(null), {});
});

test('buildAiPayload never leaks ids or timestamps', () => {
  const payload = buildAiPayload({
    batch,
    variables: { id: 10, batchId: 3, avgTemperature: 20.5 },
  });

  assert.equal(payload.batchId, 3);
  assert.equal(payload.altitude, 1850);
  assert.deepEqual(payload.variables, { avgTemperature: 20.5 });
});

test('fallback prediction is deterministic', () => {
  const variables = { avgTemperature: 20.5, soilPH: 6.1, storageMoisture: 10.5 };
  const first = buildFallbackPrediction({ batch, variables, reason: 'offline' });
  const second = buildFallbackPrediction({ batch, variables, reason: 'offline' });

  assert.deepEqual(first, second);
  assert.equal(first.usedFallback, true);
  assert.equal(first.explanationMethod, 'rule_based');
  assert.equal(first.fallbackReason, 'offline');
  assert.ok(first.topFactors.length > 0);
});

test('fallback rewards good agronomic conditions', () => {
  const good = buildFallbackPrediction({
    batch,
    variables: {
      avgTemperature: 20,
      avgRainfall: 2000,
      avgHumidity: 78,
      soilPH: 6.1,
      soilOrganicMatter: 4.5,
      dryingMethod: 'raised_bed',
      storageMoisture: 10.5,
      pestControlType: 'organic',
      fermentationHours: 36,
      soilType: 'volcanic',
    },
    reason: 'offline',
  });

  const bad = buildFallbackPrediction({
    batch: { ...batch, variety: 'caturra', processingMethod: 'other', farm: { altitude: 900 } },
    variables: {
      avgTemperature: 30,
      avgRainfall: 700,
      avgHumidity: 50,
      soilPH: 4.5,
      soilOrganicMatter: 1,
      dryingMethod: 'other',
      storageMoisture: 15,
      pestControlType: 'none',
      fermentationHours: 120,
      soilType: 'sandy',
    },
    reason: 'offline',
  });

  assert.ok(good.predictedScore > bad.predictedScore);
  assert.ok(good.predictedScore <= 100);
  assert.ok(bad.predictedScore >= 0);
});

test('serializePrediction parses JSON columns safely', () => {
  const serialized = serializePrediction({
    id: 1,
    topFactors: '[{"feature":"soilPH"}]',
    inputFeatures: '{"soilPH":6.1}',
    rawOutput: 'not-json',
  });

  assert.deepEqual(serialized.topFactors, [{ feature: 'soilPH' }]);
  assert.deepEqual(serialized.inputFeatures, { soilPH: 6.1 });
  assert.equal(serialized.rawOutput, null);
});

test('serializePrediction returns null for missing row', () => {
  assert.equal(serializePrediction(null), null);
});
