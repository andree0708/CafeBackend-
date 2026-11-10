const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 8000);

class AiServiceError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
  }
}

const getBaseUrl = () => (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const base = getBaseUrl();
  if (!base) {
    throw new AiServiceError('AI_SERVICE_URL is not configured.', 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AiServiceError(`AI service responded with HTTP ${response.status}.`, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AiServiceError(`AI service timed out after ${DEFAULT_TIMEOUT_MS} ms.`, 504);
    }
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError(`AI service unavailable: ${error.message}`, 503);
  } finally {
    clearTimeout(timer);
  }
}

async function predict(payload) {
  const data = await request('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (typeof data.predictedScore !== 'number') {
    throw new AiServiceError('Invalid AI payload: predictedScore is missing.', 502);
  }

  return data;
}

async function getModelInfo() {
  return request('/model-info');
}

async function getHealth() {
  return request('/health');
}

module.exports = {
  AiServiceError,
  predict,
  getModelInfo,
  getHealth,
};
