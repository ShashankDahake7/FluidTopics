const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { auth } = require('../middleware/auth');

// Optional auth: attach req.user if token is present, but don't reject anonymous submissions
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) return auth(req, res, next);
  next();
};

/**
 * POST /api/feedback — Submit topic feedback (rating and/or comment)
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { topicId, rating, feedback } = req.body || {};
    if (!topicId) {
      return res.status(400).json({ error: 'topicId is required' });
    }
    const hasRating = rating != null && rating !== '';
    const hasFeedback = typeof feedback === 'string' && feedback.trim().length > 0;
    if (!hasRating && !hasFeedback) {
      return res.status(400).json({ error: 'Provide a rating or feedback text' });
    }

    const doc = await Feedback.create({
      topicId,
      userId: req.user?.id || null,
      rating: hasRating ? Number(rating) : null,
      feedback: hasFeedback ? feedback.trim() : '',
    });

    res.status(201).json({ message: 'Feedback received', feedback: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
