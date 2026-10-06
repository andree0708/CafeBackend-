const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * GET /api/producers
 * Returns all producers. Admin sees all; producer sees only their own profile.
 */
const getAllProducers = async (req, res, next) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { userId: req.user.id };

    const producers = await prisma.producer.findMany({
      where,
      include: {
        user: { select: { email: true, role: true } },
        _count: { select: { farms: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: { producers } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/producers/:id
 */
const getProducerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const producer = await prisma.producer.findUnique({
      where: { id: Number(id) },
      include: {
        user: { select: { email: true, role: true, createdAt: true } },
        farms: {
          include: { _count: { select: { batches: true } } },
        },
      },
    });

    if (!producer) return next(createError('Producer not found.', 404));

    // Producers can only view their own profile
    if (req.user.role !== 'ADMIN' && producer.userId !== req.user.id) {
      return next(createError('You do not have permission to view this producer.', 403));
    }

    res.status(200).json({ success: true, data: { producer } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/producers/:id
 * Updates a producer profile.
 */
const updateProducer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, document } = req.body;

    const producer = await prisma.producer.findUnique({ where: { id: Number(id) } });
    if (!producer) return next(createError('Producer not found.', 404));

    if (req.user.role !== 'ADMIN' && producer.userId !== req.user.id) {
      return next(createError('You do not have permission to update this producer.', 403));
    }

    const updated = await prisma.producer.update({
      where: { id: Number(id) },
      data: {
        firstName: firstName ?? producer.firstName,
        lastName: lastName ?? producer.lastName,
        phone: phone ?? producer.phone,
        document: document ?? producer.document,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Producer updated successfully.',
      data: { producer: updated },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllProducers, getProducerById, updateProducer };
