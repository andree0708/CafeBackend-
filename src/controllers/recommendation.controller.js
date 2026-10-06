const prisma = require('../lib/prisma')
const { createError } = require('../middlewares/error.middleware')

/**
 * Verifies the batch belongs to the authenticated user.
 */
const verifyBatchOwnership = async (batchId, userId, role) => {
  const batch = await prisma.batch.findUnique({
    where: { id: Number(batchId) },
    include: { farm: { include: { producer: { select: { userId: true } } } } },
  })
  if (!batch) throw createError('Batch not found.', 404)
  if (role !== 'ADMIN' && batch.farm.producer.userId !== userId) {
    throw createError('You do not have permission to access this batch.', 403)
  }
  return batch
}

/**
 * GET /api/batches/:batchId/recommendations
 * Returns all recommendations for a batch.
 */
const getRecommendations = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role)

    const recommendations = await prisma.recommendation.findMany({
      where: { batchId: Number(req.params.batchId) },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })

    res.status(200).json({ success: true, data: { recommendations } })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/batches/:batchId/recommendations
 * Manually adds a recommendation to a batch (admin only).
 */
const addRecommendation = async (req, res, next) => {
  try {
    await verifyBatchOwnership(req.params.batchId, req.user.id, req.user.role)

    const { title, description, category, priority } = req.body

    const recommendation = await prisma.recommendation.create({
      data: {
        title,
        description,
        category,
        priority: priority || 'medium',
        batchId: Number(req.params.batchId),
      },
    })

    res.status(201).json({
      success: true,
      message: 'Recommendation added successfully.',
      data: { recommendation },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/batches/:batchId/recommendations/:id
 * Deletes a specific recommendation (admin only).
 */
const deleteRecommendation = async (req, res, next) => {
  try {
    const rec = await prisma.recommendation.findUnique({
      where: { id: Number(req.params.id) },
    })

    if (!rec) return next(createError('Recommendation not found.', 404))
    if (rec.batchId !== Number(req.params.batchId)) {
      return next(createError('Recommendation does not belong to this batch.', 400))
    }

    await prisma.recommendation.delete({ where: { id: rec.id } })

    res.status(200).json({ success: true, message: 'Recommendation deleted.' })
  } catch (error) {
    next(error)
  }
}

module.exports = { getRecommendations, addRecommendation, deleteRecommendation }
