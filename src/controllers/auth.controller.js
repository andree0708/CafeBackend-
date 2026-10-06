const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { createError } = require('../middlewares/error.middleware');

/**
 * Generates a signed JWT for the given user id.
 */
const signToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/register
 * Registers a new user and creates their producer profile.
 */
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, document } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(createError('Email is already registered.', 409));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'PRODUCER',
        producer: {
          create: {
            firstName,
            lastName,
            phone: phone || null,
            document: document || null,
          },
        },
      },
      include: {
        producer: true,
      },
    });

    const token = signToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          producer: {
            id: user.producer.id,
            firstName: user.producer.firstName,
            lastName: user.producer.lastName,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { producer: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(createError('Invalid email or password.', 401));
    }

    const token = signToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          producer: user.producer
            ? {
                id: user.producer.id,
                firstName: user.producer.firstName,
                lastName: user.producer.lastName,
              }
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        producer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            document: true,
            _count: { select: { farms: true } },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/change-password
 * Changes the authenticated user's password.
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return next(createError('Current password is incorrect.', 400));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, changePassword };
