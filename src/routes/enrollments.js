const express = require('express');
const Enrollment = require('../models/Enrollment');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.patch('/:id/progress', protect, async (req, res, next) => {
  try {
    const { progress, lessonIndex } = req.body;
    const enrollment = await Enrollment.findOne({ _id: req.params.id, user: req.user.id });

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    if (progress !== undefined) enrollment.progress = Math.min(100, Math.max(0, progress));
    if (lessonIndex !== undefined && !enrollment.completedLessons.includes(lessonIndex)) {
      enrollment.completedLessons.push(lessonIndex);
    }

    await enrollment.save();
    res.json({ success: true, enrollment });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
