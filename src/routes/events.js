const express = require('express');
const { body } = require('express-validator');
const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  cancelEvent,
  getMyEvents,
  getEventStats,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', getEventStats);
router.get('/', getEvents);
router.get('/my/registrations', protect, getMyEvents);
router.get('/:id', getEvent);

router.post(
  '/',
  protect,
  authorize('instructor', 'admin'),
  [
    body('title').trim().notEmpty(),
    body('description').notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('price').isFloat({ min: 0 }),
    body('capacity').isInt({ min: 1 }),
  ],
  createEvent
);

router.put('/:id', protect, authorize('instructor', 'admin'), updateEvent);
router.patch('/:id/cancel', protect, authorize('instructor', 'admin'), cancelEvent);

module.exports = router;
