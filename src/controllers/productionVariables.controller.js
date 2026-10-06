const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * Verifies the batch exists and belongs to the authenticated user.
 */
const verifyBatchOwnership = async (batchId, userId, role) => {
  const batch = await prisma.batch.findUnique({
    where: { id: Number(batchId) },
    include: { farm: { include: { producer: { select: { userId: true } } } } },
  });
  if (!batch) throw createError('Batch not found.', 404);
  if (role !== 'ADMIN' && batch.farm.producer.userId !== userId) {
    throw createError('You do not have permission to access this batch.', 403);
  }
  return batch;
};

/**
 * GET /api/batches/:batchId/variables
 */
const getProductionVariables = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role);

    const variables = await prisma.productionVariables.findUnique({
      where: { batchId: Number(req.params.batchId) },
    });

    if (!variables) {
      return res.status(200).json({
        success: true,
        message: 'No production variables registered for this batch yet.',
        data: { variables: null },
      });
    }

    res.status(200).json({ success: true, data: { variables } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/batches/:batchId/variables
 * Creates or replaces production variables for a batch (upsert).
 */
const upsertProductionVariables = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role);

    const batchId = Number(req.params.batchId);
    const {
      avgTemperature, avgRainfall, avgHumidity,
      soilPH, soilOrganicMatter, soilNitrogen,
      fertilizationFrequency, pestControlType, irrigationType,
      dryingMethod, dryingDays, storageMoisture,
    } = req.body;

    const data = {
      avgTemperature: avgTemperature !== undefined ? Number(avgTemperature) : undefined,
      avgRainfall: avgRainfall !== undefined ? Number(avgRainfall) : undefined,
      avgHumidity: avgHumidity !== undefined ? Number(avgHumidity) : undefined,
      soilPH: soilPH !== undefined ? Number(soilPH) : undefined,
      soilOrganicMatter: soilOrganicMatter !== undefined ? Number(soilOrganicMatter) : undefined,
      soilNitrogen: soilNitrogen !== undefined ? Number(soilNitrogen) : undefined,
      fertilizationFrequency: fertilizationFrequency || undefined,
      pestControlType: pestControlType || undefined,
      irrigationType: irrigationType || undefined,
      dryingMethod: dryingMethod || undefined,
      dryingDays: dryingDays !== undefined ? Number(dryingDays) : undefined,
      storageMoisture: storageMoisture !== undefined ? Number(storageMoisture) : undefined,
    };

    // Remove undefined keys so upsert doesn't overwrite existing values with null
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

    const variables = await prisma.productionVariables.upsert({
      where: { batchId },
      update: data,
      create: { ...data, batchId },
    });

    res.status(200).json({
      success: true,
      message: 'Production variables saved successfully.',
      data: { variables },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProductionVariables, upsertProductionVariables };
