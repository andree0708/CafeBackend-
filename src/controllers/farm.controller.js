const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * Resolves the producer that belongs to the authenticated user.
 * Throws if the user has no producer profile.
 */
const getProducerFromUser = async (userId) => {
  const producer = await prisma.producer.findUnique({ where: { userId } });
  if (!producer) throw createError('Producer profile not found for this user.', 404);
  return producer;
};

/**
 * GET /api/farms
 * Returns all farms owned by the authenticated producer (or all for ADMIN).
 */
const getAllFarms = async (req, res, next) => {
  try {
    let where = {};

    if (req.user.role !== 'ADMIN') {
      const producer = await getProducerFromUser(req.user.id);
      where = { producerId: producer.id };
    }

    const farms = await prisma.farm.findMany({
      where,
      include: {
        producer: { select: { firstName: true, lastName: true } },
        _count: { select: { batches: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: { farms } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/farms/:id
 */
const getFarmById = async (req, res, next) => {
  try {
    const farm = await prisma.farm.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        producer: { select: { id: true, firstName: true, lastName: true, userId: true } },
        batches: {
          orderBy: { createdAt: 'desc' },
          include: { aiPrediction: { select: { status: true, qualityCategory: true, predictedScore: true } } },
        },
      },
    });

    if (!farm) return next(createError('Farm not found.', 404));

    if (req.user.role !== 'ADMIN' && farm.producer.userId !== req.user.id) {
      return next(createError('You do not have permission to view this farm.', 403));
    }

    res.status(200).json({ success: true, data: { farm } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/farms
 * Creates a new farm for the authenticated producer.
 */
const createFarm = async (req, res, next) => {
  try {
    const { name, location, municipality, department, hectares, altitude } = req.body;

    const producer = await getProducerFromUser(req.user.id);

    const farm = await prisma.farm.create({
      data: {
        name,
        location,
        municipality: municipality || null,
        department: department || null,
        hectares: hectares ? Number(hectares) : null,
        altitude: altitude ? Number(altitude) : null,
        producerId: producer.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Farm created successfully.',
      data: { farm },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/farms/:id
 * Updates a farm (owner or admin only).
 */
const updateFarm = async (req, res, next) => {
  try {
    const { name, location, municipality, department, hectares, altitude } = req.body;

    const farm = await prisma.farm.findUnique({
      where: { id: Number(req.params.id) },
      include: { producer: { select: { userId: true } } },
    });

    if (!farm) return next(createError('Farm not found.', 404));

    if (req.user.role !== 'ADMIN' && farm.producer.userId !== req.user.id) {
      return next(createError('You do not have permission to update this farm.', 403));
    }

    const updated = await prisma.farm.update({
      where: { id: farm.id },
      data: {
        name: name ?? farm.name,
        location: location ?? farm.location,
        municipality: municipality ?? farm.municipality,
        department: department ?? farm.department,
        hectares: hectares !== undefined ? Number(hectares) : farm.hectares,
        altitude: altitude !== undefined ? Number(altitude) : farm.altitude,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Farm updated successfully.',
      data: { farm: updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/farms/:id
 * Deletes a farm and all its related batches (cascade via Prisma schema).
 */
const deleteFarm = async (req, res, next) => {
  try {
    const farm = await prisma.farm.findUnique({
      where: { id: Number(req.params.id) },
      include: { producer: { select: { userId: true } } },
    });

    if (!farm) return next(createError('Farm not found.', 404));

    if (req.user.role !== 'ADMIN' && farm.producer.userId !== req.user.id) {
      return next(createError('You do not have permission to delete this farm.', 403));
    }

    await prisma.farm.delete({ where: { id: farm.id } });

    res.status(200).json({
      success: true,
      message: 'Farm deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllFarms, getFarmById, createFarm, updateFarm, deleteFarm };
