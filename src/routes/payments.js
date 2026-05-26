const express = require('express');
const { body } = require('express-validator');
const {
  createOrder,
  verifyPayment,
  completeDemoPayment,
  webhook,
  getPaymentHistory,
  reconcile,
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/webhook', webhook);

router.post(
  '/create-order',
  protect,
  [
    body('paymentType').isIn(['course', 'event']),
    body('referenceId').notEmpty(),
  ],
  createOrder
);

router.post(
  '/verify',
  protect,
  [
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
  ],
  verifyPayment
);

router.post('/demo-complete', protect, completeDemoPayment);
router.get('/history', protect, getPaymentHistory);
router.post('/reconcile', protect, authorize('admin'), reconcile);

module.exports = router;
