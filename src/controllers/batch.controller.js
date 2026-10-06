const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * Verifies the farm exists and belongs to the authenticated user (or user is ADMIN).
 */
const verifyFarmOwnership = async (farmId, userId, role) => {
  const farm = await prisma.farm.findUnique({
    where: { id: Number(farmId) },
    include: { producer: { select: { userId: true } } },
  });
  if (!farm) throw createError('Farm not found.', 404);
  if (role !== 'ADMIN' && farm.producer.userId !== userId) {
    throw createError('You do not have permission to access this farm.', 403);
  }
  return farm;
};

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
 * GET /api/batches
 * Returns all batches for the authenticated producer.
 */
const getAllBatches = async (req, res, next) => {
  try {
    let where = {};

    if (req.user.role !== 'ADMIN') {
      const producer = await prisma.producer.findUnique({ where: { userId: req.user.id } });
      if (!producer) return next(createError('Producer profile not found.', 404));
      where = { farm: { producerId: producer.id } };
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        farm: { select: { id: true, name: true, municipality: true } },
        aiPrediction: {
          select: { status: true, qualityCategory: true, predictedScore: true, confidenceLevel: true },
        },
        _count: { select: { recommendations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: { batches } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/batches/:id
 */
const getBatchById = async (req, res, next) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            location: true,
            municipality: true,
            department: true,
            producer: { select: { id: true, firstName: true, lastName: true, userId: true } },
          },
        },
        productionVariables: true,
        coffeeEvaluation: true,
        aiPrediction: true,
        recommendations: { orderBy: { priority: 'asc' } },
      },
    });

    if (!batch) return next(createError('Batch not found.', 404));

    if (req.user.role !== 'ADMIN' && batch.farm.producer.userId !== req.user.id) {
      return next(createError('You do not have permission to view this batch.', 403));
    }

    res.status(200).json({ success: true, data: { batch } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/farms/:farmId/batches
 * Creates a new batch under a specific farm.
 */
const createBatch = async (req, res, next) => {
  try {
    const { farmId } = req.params;
    const { code, harvestDate, processingMethod, variety, weight, notes } = req.body;

    await verifyFarmOwnership(farmId, req.user.id, req.user.role);

    const batch = await prisma.batch.create({
      data: {
        code,
        harvestDate: new Date(harvestDate),
        processingMethod: processingMethod || null,
        variety: variety || null,
        weight: weight ? Number(weight) : null,
        notes: notes || null,
        farmId: Number(farmId),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Batch created successfully.',
      data: { batch },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/batches/:id
 */
const updateBatch = async (req, res, next) => {
  try {
    const batch = await verifyBatchOwnership(req.params.id, req.user.id, req.user.role);
    const { code, harvestDate, processingMethod, variety, weight, notes } = req.body;

    const updated = await prisma.batch.update({
      where: { id: batch.id },
      data: {
        code: code ?? batch.code,
        harvestDate: harvestDate ? new Date(harvestDate) : batch.harvestDate,
        processingMethod: processingMethod ?? batch.processingMethod,
        variety: variety ?? batch.variety,
        weight: weight !== undefined ? Number(weight) : batch.weight,
        notes: notes ?? batch.notes,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Batch updated successfully.',
      data: { batch: updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/batches/:id
 */
const deleteBatch = async (req, res, next) => {
  try {
    const batch = await verifyBatchOwnership(req.params.id, req.user.id, req.user.role);
    await prisma.batch.delete({ where: { id: batch.id } });

    res.status(200).json({ success: true, message: 'Batch deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllBatches, getBatchById, createBatch, updateBatch, deleteBatch };
