const express = require('express');
const { getRecommendations } = require('../services/recommendation/recommendationService');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/recommendations — Content-based recommendations
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { topicId, limit = 5 } = req.query;

    if (!topicId) {
      return res.status(400).json({ error: 'topicId query parameter is required' });
    }

    const recommendations = await getRecommendations(topicId, parseInt(limit));
    res.json({ recommendations });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
