const express = require('express');
const { body } = require('express-validator');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getMyEnrollments,
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getCourses);
router.get('/enrollments/me', protect, getMyEnrollments);
router.get('/:id', getCourse);

router.post(
  '/',
  protect,
  authorize('instructor', 'admin'),
  [
    body('title').trim().notEmpty(),
    body('description').notEmpty(),
    body('category').notEmpty(),
    body('price').isFloat({ min: 0 }),
  ],
  createCourse
);

router.put('/:id', protect, authorize('instructor', 'admin'), updateCourse);
router.delete('/:id', protect, authorize('instructor', 'admin'), deleteCourse);

module.exports = router;
