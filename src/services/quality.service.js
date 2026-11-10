const QUALITY_CATEGORIES = {
  SPECIALTY: 'SPECIALTY',
  PREMIUM: 'PREMIUM',
  COMMERCIAL: 'COMMERCIAL',
  LOW_GRADE: 'LOW_GRADE',
};

const classify = (score) => {
  if (score >= 85) return QUALITY_CATEGORIES.SPECIALTY;
  if (score >= 75) return QUALITY_CATEGORIES.PREMIUM;
  if (score >= 60) return QUALITY_CATEGORIES.COMMERCIAL;
  return QUALITY_CATEGORIES.LOW_GRADE;
};

module.exports = { QUALITY_CATEGORIES, classify };
