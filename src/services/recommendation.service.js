/**
 * Commercial market fit engine.
 *
 * The model predicts an SCA-like score. This module turns that score plus the
 * lot profile into a 0-100 compatibility score for four commercial destinations
 * and generates actionable recommendations.
 */

const MARKETS = {
  local: {
    label: 'Mercado local',
    description: 'Consumo interno, tiendas de barrio, plazas y distribuidores regionales.',
  },
  cafes: {
    label: 'Cafeterías y consumo',
    description: 'Cafeterías de origen, barras de espresso y consumo directo.',
  },
  export: {
    label: 'Exportación',
    description: 'Exportación diferenciada, importadores y distribución internacional.',
  },
  specialty: {
    label: 'Café de especialidad',
    description: 'Tostadores de origen, comercio directo, subastas y concursos.',
  },
};

const MARKET_ORDER = ['specialty', 'export', 'cafes', 'local'];

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = (value) => Math.round(value * 10) / 10;
const isPresent = (value) => value !== null && value !== undefined && value !== '';
const toNumber = (value) => (isPresent(value) ? Number(value) : null);

const opportunityLevel = (fitScore) => {
  if (fitScore >= 75) return 'high';
  if (fitScore >= 55) return 'medium';
  return 'low';
};

const buildContext = ({ prediction, batch, variables, evaluation }) => {
  const score = Number(prediction?.predictedScore) || 0;
  const altitude = toNumber(batch?.farm?.altitude);
  const variety = batch?.variety || 'other';
  const process = batch?.processingMethod || 'other';
  const weight = toNumber(batch?.weight);
  const fermentationHours = toNumber(variables?.fermentationHours);
  const storageMoisture = toNumber(variables?.storageMoisture);
  const soilPH = toNumber(variables?.soilPH);
  const defects = toNumber(evaluation?.defects);
  const sensoryScore = toNumber(evaluation?.totalScore);

  const scoreNorm = clamp(((score - 60) / 40) * 100);
  const processPremium = ['washed', 'honey', 'natural', 'anaerobic'].includes(process);
  const highAltitude = altitude !== null && altitude >= 1600;
  const veryHighAltitude = altitude !== null && altitude >= 1900;
  const lowMoisture = storageMoisture !== null && storageMoisture <= 11.5;
  const goodPH = soilPH !== null && soilPH >= 5.5 && soilPH <= 6.5;
  const lowDefects = defects === null || defects <= 5;
  const controlledFermentation =
    fermentationHours !== null && fermentationHours >= 12 && fermentationHours <= 72;
  const sensoryNorm = sensoryScore !== null ? clamp(((sensoryScore - 75) / 25) * 100) : null;

  return {
    score,
    category: prediction?.qualityCategory || null,
    altitude,
    variety,
    process,
    weight,
    fermentationHours,
    storageMoisture,
    soilPH,
    defects,
    sensoryScore,
    scoreNorm,
    processPremium,
    highAltitude,
    veryHighAltitude,
    lowMoisture,
    goodPH,
    lowDefects,
    controlledFermentation,
    sensoryNorm,
  };
};

const buildRationale = (market, context) => {
  const positive = [];
  const negative = [];

  if (context.score >= 80) positive.push(`puntaje estimado de ${context.score}/100`);
  else if (context.score >= 70) positive.push(`puntaje estimado de ${context.score}/100`);
  else negative.push(`puntaje estimado de ${context.score}/100`);

  if (context.veryHighAltitude) positive.push(`altitud de ${context.altitude} msnm`);
  else if (context.highAltitude) positive.push(`altitud de ${context.altitude} msnm`);
  else if (context.altitude !== null) negative.push(`altitud de ${context.altitude} msnm por debajo del rango de especialidad`);

  if (context.processPremium) positive.push(`proceso ${context.process}`);
  if (context.lowMoisture) positive.push('humedad de almacenamiento dentro del rango seguro');
  else if (context.storageMoisture !== null && context.storageMoisture > 12) {
    negative.push(`humedad de almacenamiento de ${context.storageMoisture}%`);
  }

  if (context.lowDefects) positive.push('bajo nivel de defectos');
  else negative.push(`${context.defects} defectos registrados`);

  if (context.sensoryScore !== null) {
    if (context.sensoryScore >= 80) positive.push(`cata SCA de ${context.sensoryScore}/100`);
    else negative.push(`cata SCA de ${context.sensoryScore}/100`);
  }

  if (context.controlledFermentation) positive.push('fermentación controlada');
  else if (context.fermentationHours !== null) {
    negative.push(`fermentación de ${context.fermentationHours} h fuera del rango 12-72 h`);
  }

  if (market === 'export') {
    if (context.weight !== null && context.weight >= 300) positive.push(`volumen de ${context.weight} kg`);
    else if (context.weight !== null && context.weight < 100) negative.push(`volumen de ${context.weight} kg para exportación directa`);
  }

  if (market === 'specialty' && ['geisha', 'bourbon', 'typica'].includes(context.variety)) {
    positive.push(`variedad ${context.variety}`);
  }

  const parts = [];
  if (positive.length) parts.push(`A favor: ${positive.join(', ')}.`);
  if (negative.length) parts.push(`A revisar: ${negative.join(', ')}.`);
  return parts.join(' ');
};

const scoreMarket = (market, context) => {
  switch (market) {
    case 'specialty':
      return clamp(
        context.scoreNorm * 0.45 +
          (context.processPremium ? 12 : 0) +
          (context.veryHighAltitude ? 10 : context.highAltitude ? 6 : 0) +
          (['geisha', 'bourbon', 'typica'].includes(context.variety) ? 8 : 0) +
          (context.lowDefects ? 8 : 0) +
          (context.lowMoisture ? 7 : 0) +
          (context.controlledFermentation ? 5 : 0) +
          (context.sensoryNorm !== null ? context.sensoryNorm * 0.05 : 5)
      );

    case 'export':
      return clamp(
        context.scoreNorm * 0.4 +
          (context.score >= 80 ? 12 : 0) +
          (context.weight !== null && context.weight >= 300 ? 10 : context.weight !== null && context.weight >= 100 ? 6 : 0) +
          (context.lowMoisture ? 10 : 0) +
          (context.goodPH ? 6 : 0) +
          (context.processPremium ? 8 : 0) +
          (context.lowDefects ? 8 : 0) +
          (context.sensoryNorm !== null ? context.sensoryNorm * 0.06 : 4)
      );

    case 'cafes':
      return clamp(
        context.scoreNorm * 0.35 +
          (context.score >= 75 ? 10 : 0) +
          (context.processPremium ? 10 : 0) +
          (context.sensoryNorm !== null ? context.sensoryNorm * 0.15 : 8) +
          (context.weight !== null && context.weight >= 50 ? 8 : 4) +
          (context.lowDefects ? 10 : 0) +
          (context.lowMoisture ? 7 : 0) +
          10
      );

    case 'local':
    default:
      return clamp(
        50 +
          context.scoreNorm * 0.2 +
          (context.weight !== null && context.weight >= 50 ? 8 : 4) +
          (context.lowMoisture ? 7 : 0) +
          (context.goodPH ? 5 : 0) +
          10
      );
  }
};

const buildMarketFits = ({ prediction, batch, variables, evaluation }) => {
  const context = buildContext({ prediction, batch, variables, evaluation });

  return MARKET_ORDER.map((market) => {
    const fitScore = round1(scoreMarket(market, context));
    return {
      market,
      label: MARKETS[market].label,
      description: MARKETS[market].description,
      fitScore,
      opportunityLevel: opportunityLevel(fitScore),
      rationale: buildRationale(market, context),
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
};

const priorityFor = (level) => (level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low');

const buildMarketRecommendations = (marketFits) => {
  const recommendations = [];
  const [top, second] = marketFits;

  if (top) {
    recommendations.push({
      title: `Mercado recomendado: ${MARKETS[top.market].label}`,
      description: `El lote muestra una compatibilidad de ${top.fitScore}/100 con ${MARKETS[top.market].label.toLowerCase()}. ${top.rationale}`,
      category: 'commercialization',
      priority: priorityFor(top.opportunityLevel),
      market: top.market,
      fitScore: top.fitScore,
      opportunityLevel: top.opportunityLevel,
      rationale: top.rationale,
    });
  }

  if (second && second.fitScore >= 65) {
    recommendations.push({
      title: `Alternativa comercial: ${MARKETS[second.market].label}`,
      description: `Compatibilidad de ${second.fitScore}/100. ${second.rationale}`,
      category: 'commercialization',
      priority: priorityFor(second.opportunityLevel),
      market: second.market,
      fitScore: second.fitScore,
      opportunityLevel: second.opportunityLevel,
      rationale: second.rationale,
    });
  }

  return recommendations;
};

const buildAgronomicRecommendations = ({ variables, evaluation }) => {
  const recommendations = [];

  if (variables?.soilPH != null && (variables.soilPH < 5.5 || variables.soilPH > 6.5)) {
    recommendations.push({
      title: 'Corregir pH del suelo',
      description: `El rango óptimo para café es 5.5-6.5. El valor registrado es ${variables.soilPH}. Cal o azufre según el análisis de suelos.`,
      category: 'agronomic',
      priority: 'medium',
    });
  }

  if (variables?.storageMoisture != null && variables.storageMoisture > 12) {
    recommendations.push({
      title: 'Bajar humedad de almacenamiento',
      description: `Humedad de ${variables.storageMoisture}% supera el umbral seguro de 12%. Riesgo de hongos y pérdida de taza.`,
      category: 'processing',
      priority: 'high',
    });
  }

  if (variables?.avgTemperature != null && (variables.avgTemperature < 17 || variables.avgTemperature > 23)) {
    recommendations.push({
      title: 'Manejo de sombra y altitud',
      description:
        'La temperatura óptima de cultivo está entre 17 y 23 °C. Revisa sombrío y aptitud de la variedad en esa finca.',
      category: 'agronomic',
      priority: 'medium',
    });
  }

  if (variables?.fermentationHours != null && (variables.fermentationHours < 12 || variables.fermentationHours > 72)) {
    recommendations.push({
      title: 'Revisar tiempo de fermentación',
      description: `Se registraron ${variables.fermentationHours} h de fermentación. Para procesos controlados se sugiere documentar el rango 12-72 h y monitorear pH y temperatura.`,
      category: 'processing',
      priority: 'medium',
    });
  }

  if (evaluation?.defects != null && evaluation.defects > 5) {
    recommendations.push({
      title: 'Reducir defectos en la cosecha',
      description: `La evaluación registra ${evaluation.defects} defectos. Revisa selección de cereza, flotación y limpieza del beneficio antes de la próxima cosecha.`,
      category: 'processing',
      priority: 'high',
    });
  }

  recommendations.push({
    title: 'Trazabilidad completa',
    description:
      'Conserva variables, fechas y proceso por lote. Los compradores de especialidad pagan por evidencia verificable, no solo por el puntaje.',
    category: 'commercialization',
    priority: 'low',
  });

  return recommendations;
};

const generateRecommendations = ({ prediction, batch, variables, evaluation, marketFits }) => {
  return [
    ...buildMarketRecommendations(marketFits),
    ...buildAgronomicRecommendations({ variables, evaluation }),
  ];
};

module.exports = {
  MARKETS,
  buildMarketFits,
  generateRecommendations,
  opportunityLevel,
  buildContext,
};
