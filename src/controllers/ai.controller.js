const { getHealth, getModelInfo } = require('../services/ai.service');

const getStatus = async (req, res) => {
  try {
    const [health, model] = await Promise.all([getHealth(), getModelInfo()]);
    res.status(200).json({
      success: true,
      data: { online: true, health, model },
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: {
        online: false,
        health: null,
        model: null,
        error: error.message,
      },
    });
  }
};

module.exports = { getStatus };
