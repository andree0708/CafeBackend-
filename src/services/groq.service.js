const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const DEFAULT_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 60000);

class GroqServiceError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'GroqServiceError';
    this.status = status;
  }
}

const getApiKey = () => process.env.GROQ_API_KEY || '';

function buildPrompt({ batch, prediction, marketFits, evaluation, variables }) {
  const lines = [
    'Analiza el siguiente lote de café colombiano y redacta un análisis en español (máximo 350 palabras, formato markdown con secciones).',
    '',
    `Lote: ${batch.code} | Finca: ${batch.farm?.name || '?'} (${batch.farm?.municipality || '?'}, ${batch.farm?.department || '?'}, ${batch.farm?.altitude || '?'} msnm)`,
    `Variedad: ${batch.variety || '?'} | Beneficio: ${batch.processingMethod || '?'} | Cosecha: ${batch.harvestDate || '?'} | Peso: ${batch.weight || '?'} kg`,
    '',
    `Puntaje estimado por el modelo Random Forest: ${prediction.predictedScore} (${prediction.qualityCategory}, confianza ${Math.round((prediction.confidenceLevel || 0) * 100)}%, modelo ${prediction.modelVersion}).`,
  ];

  const factors = Array.isArray(prediction.topFactors) ? prediction.topFactors.slice(0, 6) : [];
  if (factors.length) {
    lines.push('');
    lines.push('Factores SHAP principales (variable: contribución al puntaje):');
    for (const f of factors) {
      const name = f.feature || f.name || JSON.stringify(f);
      const value = typeof f.value === 'number' ? f.value.toFixed(2) : f.value ?? '';
      lines.push(`- ${name}: ${value}`);
    }
  }

  if (Array.isArray(marketFits) && marketFits.length) {
    lines.push('');
    lines.push('Compatibilidad por mercado (0-100):');
    for (const m of marketFits) lines.push(`- ${m.market}: ${m.fitScore}`);
  }

  if (evaluation?.totalScore) {
    lines.push('');
    lines.push(`Cata SCA del productor: ${evaluation.totalScore}/100 (defectos: ${evaluation.defects ?? '?'}, evaluador: ${evaluation.evaluatorName || '?'}).`);
  }

  if (variables && typeof variables === 'object') {
    const v = variables;
    lines.push('');
    lines.push(
      `Variables: T ${v.avgTemperature ?? '?'}°C, lluvia ${v.avgRainfall ?? '?'} mm, humedad ${v.avgHumidity ?? '?'}%, ` +
      `pH ${v.soilPH ?? '?'}, MO ${v.soilOrganicMatter ?? '?'}%, N ${v.soilNitrogen ?? '?'}, ` +
      `suelo ${v.soilType || '?'}, riego ${v.irrigationType || '?'}, secado ${v.dryingMethod || '?'} (${v.dryingDays ?? '?'} días), ` +
      `fermentación ${v.fermentationHours ?? '?'} h, humedad almacén ${v.storageMoisture ?? '?'}%.`
    );
  }

  lines.push('');
  lines.push('Estructura tu respuesta en: ## Resumen, ## Lectura del modelo, ## Mercados, ## 3 acciones concretas. Tono directo, sin rodeos.');

  return lines.join('\n');
}

async function generateBatchAnalysis(context) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new GroqServiceError('GROQ_API_KEY is not configured.', 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.6,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: 'Eres un asesor técnico en café de especialidad colombiano. Respondes solo en español, de forma concreta y accionable.',
          },
          { role: 'user', content: buildPrompt(context) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new GroqServiceError(
        `Groq responded with HTTP ${response.status}. ${detail.slice(0, 200)}`,
        response.status >= 500 ? 502 : response.status
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content?.trim();
    if (!analysis) {
      throw new GroqServiceError('Groq returned an empty analysis.', 502);
    }

    return { analysis, model: data.model || DEFAULT_MODEL };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new GroqServiceError(`Groq timed out after ${DEFAULT_TIMEOUT_MS} ms.`, 504);
    }
    if (error instanceof GroqServiceError) throw error;
    throw new GroqServiceError(`Groq unavailable: ${error.message}`, 503);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  GroqServiceError,
  generateBatchAnalysis,
  buildPrompt,
};
