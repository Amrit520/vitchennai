const { validationResult } = require('express-validator');
const paymentService = require('../services/paymentService');
const Payment = require('../models/Payment');

exports.createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { paymentType, referenceId, idempotencyKey } = req.body;
    const result = await paymentService.createOrder({
      userId: req.user.id,
      paymentType,
      referenceId,
      idempotencyKey,
    });

    res.status(result.reused ? 200 : 201).json({
      success: true,
      reused: result.reused || false,
      demoMode: result.demoMode || false,
      paymentId: result.payment._id,
      order: result.order,
      keyId: result.keyId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      itemTitle: result.payment.metadata?.itemTitle,
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const result = await paymentService.verifyAndCapture({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    res.json({
      success: true,
      message: result.alreadyCaptured ? 'Payment already processed' : 'Payment verified successfully',
      payment: {
        id: result.payment._id,
        status: result.payment.status,
        paymentType: result.payment.paymentType,
        referenceId: result.payment.referenceId,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.completeDemoPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    const result = await paymentService.completeDemoPayment(paymentId);

    res.json({
      success: true,
      message: 'Demo payment completed',
      payment: result.payment,
    });
  } catch (error) {
    next(error);
  }
};

exports.webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const result = await paymentService.handleWebhook(req.body, signature);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
};

exports.reconcile = async (req, res, next) => {
  try {
    const result = await paymentService.reconcilePendingPayments();
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
