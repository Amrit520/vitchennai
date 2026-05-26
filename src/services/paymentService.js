const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getRazorpayInstance } = require('../config/razorpay');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const Event = require('../models/Event');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  const code = error?.statusCode || error?.error?.code;
  const message = (error?.message || error?.error?.description || '').toLowerCase();
  if ([500, 502, 503, 504].includes(code)) return true;
  if (message.includes('timeout') || message.includes('network') || message.includes('econnreset')) {
    return true;
  }
  return false;
};

const withRetry = async (fn, maxAttempts = MAX_RETRIES) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) throw error;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
};

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
};

const getReferenceItem = async (paymentType, referenceId) => {
  if (paymentType === 'course') {
    return Course.findById(referenceId);
  }
  return Event.findById(referenceId);
};

const fulfillPayment = async (payment) => {
  if (payment.status === 'captured') return payment;

  if (payment.paymentType === 'course') {
    const existing = await Enrollment.findOne({ user: payment.user, course: payment.referenceId });
    if (!existing) {
      await Enrollment.create({
        user: payment.user,
        course: payment.referenceId,
        payment: payment._id,
        status: 'active',
      });
      await Course.findByIdAndUpdate(payment.referenceId, { $inc: { enrolledCount: 1 } });
      await User.findByIdAndUpdate(payment.user, {
        $addToSet: { enrolledCourses: payment.referenceId },
      });
    }
  } else if (payment.paymentType === 'event') {
    const event = await Event.findById(payment.referenceId);
    if (event && event.registeredCount < event.capacity) {
      const alreadyRegistered = event.attendees.some(
        (id) => id.toString() === payment.user.toString()
      );
      if (!alreadyRegistered) {
        await Event.findByIdAndUpdate(payment.referenceId, {
          $inc: { registeredCount: 1 },
          $addToSet: { attendees: payment.user },
        });
        await User.findByIdAndUpdate(payment.user, {
          $addToSet: { registeredEvents: payment.referenceId },
        });
      }
    }
  }

  payment.status = 'captured';
  await payment.save();
  return payment;
};

const createOrder = async ({ userId, paymentType, referenceId, idempotencyKey }) => {
  const key = idempotencyKey || uuidv4();

  const existing = await Payment.findOne({ idempotencyKey: key });
  if (existing) {
    if (existing.status === 'captured') {
      return { payment: existing, reused: true };
    }
    if (existing.razorpayOrderId && ['created', 'pending', 'authorized'].includes(existing.status)) {
      return { payment: existing, reused: true };
    }
  }

  const item = await getReferenceItem(paymentType, referenceId);
  if (!item) {
    const err = new Error(`${paymentType === 'course' ? 'Course' : 'Event'} not found`);
    err.statusCode = 404;
    throw err;
  }

  if (paymentType === 'event') {
    if (item.status === 'cancelled') {
      const err = new Error('Event has been cancelled');
      err.statusCode = 400;
      throw err;
    }
    if (item.registeredCount >= item.capacity) {
      const err = new Error('Event is fully booked');
      err.statusCode = 400;
      throw err;
    }
    const isRegistered = item.attendees?.some((id) => id.toString() === userId.toString());
    if (isRegistered) {
      const err = new Error('Already registered for this event');
      err.statusCode = 400;
      throw err;
    }
  }

  if (paymentType === 'course') {
    const enrollment = await Enrollment.findOne({ user: userId, course: referenceId });
    if (enrollment) {
      const err = new Error('Already enrolled in this course');
      err.statusCode = 400;
      throw err;
    }
  }

  const amount = item.price;
  const amountPaise = Math.round(amount * 100);

  let payment = existing || await Payment.create({
    user: userId,
    idempotencyKey: key,
    amount,
    currency: item.currency || 'INR',
    paymentType,
    referenceId,
    referenceModel: paymentType === 'course' ? 'Course' : 'Event',
    status: 'created',
    metadata: { itemTitle: item.title },
  });

  const razorpay = getRazorpayInstance();

  if (!razorpay) {
    payment.status = 'pending';
    payment.metadata = { ...payment.metadata, demoMode: true };
    await payment.save();
    return {
      payment,
      order: {
        id: `demo_order_${payment._id}`,
        amount: amountPaise,
        currency: 'INR',
        demoMode: true,
      },
      keyId: 'demo_key',
      demoMode: true,
    };
  }

  try {
    const order = await withRetry(() =>
      razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `lms_${payment._id}`,
        notes: {
          paymentId: payment._id.toString(),
          userId: userId.toString(),
          paymentType,
          referenceId: referenceId.toString(),
        },
      })
    );

    payment.razorpayOrderId = order.id;
    payment.status = 'pending';
    payment.lastAttemptAt = new Date();
    await payment.save();

    return {
      payment,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  } catch (error) {
    payment.status = 'failed';
    payment.failureReason = error.message || 'Order creation failed';
    payment.retryCount += 1;
    await payment.save();
    throw error;
  }
};

const verifyAndCapture = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    const err = new Error('Payment record not found');
    err.statusCode = 404;
    throw err;
  }

  if (payment.status === 'captured') {
    return { payment, alreadyCaptured: true };
  }

  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    payment.status = 'failed';
    payment.failureReason = 'Invalid payment signature';
    await payment.save();
    const err = new Error('Payment verification failed');
    err.statusCode = 400;
    throw err;
  }

  const razorpay = getRazorpayInstance();
  if (razorpay) {
    try {
      const rpPayment = await withRetry(() => razorpay.payments.fetch(razorpayPaymentId));
      if (rpPayment.status !== 'captured' && rpPayment.status !== 'authorized') {
        payment.status = 'failed';
        payment.failureReason = `Unexpected payment status: ${rpPayment.status}`;
        await payment.save();
        const err = new Error('Payment not successful');
        err.statusCode = 400;
        throw err;
      }
      if (rpPayment.status === 'authorized') {
        await withRetry(() => razorpay.payments.capture(razorpayPaymentId, payment.amount * 100, 'INR'));
      }
    } catch (error) {
      if (!isRetryableError(error)) {
        payment.status = 'failed';
        payment.failureReason = error.message;
        payment.retryCount += 1;
        await payment.save();
        throw error;
      }
      payment.retryCount += 1;
      payment.lastAttemptAt = new Date();
      await payment.save();
      throw error;
    }
  }

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  payment.status = 'authorized';
  await payment.save();

  await fulfillPayment(payment);
  return { payment, alreadyCaptured: false };
};

const completeDemoPayment = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    throw err;
  }
  if (payment.status === 'captured') {
    return { payment, alreadyCaptured: true };
  }
  payment.razorpayPaymentId = `demo_pay_${payment._id}`;
  payment.razorpayOrderId = payment.razorpayOrderId || `demo_order_${payment._id}`;
  payment.status = 'authorized';
  await payment.save();
  await fulfillPayment(payment);
  return { payment, alreadyCaptured: false };
};

const handleWebhook = async (rawBody, signature) => {
  if (!verifyWebhookSignature(rawBody, signature)) {
    const err = new Error('Invalid webhook signature');
    err.statusCode = 400;
    throw err;
  }

  const event = JSON.parse(rawBody.toString());
  const eventType = event.event;
  const payload = event.payload?.payment?.entity || event.payload?.order?.entity;

  if (!payload) return { processed: false };

  const orderId = payload.order_id || payload.id;
  const payment = await Payment.findOne({
    $or: [{ razorpayOrderId: orderId }, { razorpayPaymentId: payload.id }],
  });

  if (!payment) return { processed: false, reason: 'payment_not_found' };

  payment.webhookEvents.push({ event: eventType, payload: event.payload });
  payment.lastAttemptAt = new Date();

  switch (eventType) {
    case 'payment.captured':
      payment.razorpayPaymentId = payload.id;
      payment.status = 'captured';
      await payment.save();
      await fulfillPayment(payment);
      break;
    case 'payment.failed':
      payment.status = 'failed';
      payment.failureReason = payload.error_description || 'Payment failed';
      await payment.save();
      break;
    case 'order.paid':
      payment.status = 'pending';
      await payment.save();
      break;
    default:
      await payment.save();
  }

  return { processed: true, eventType };
};

const reconcilePendingPayments = async () => {
  const razorpay = getRazorpayInstance();
  if (!razorpay) return { reconciled: 0 };

  const pending = await Payment.find({
    status: { $in: ['pending', 'authorized'] },
    razorpayOrderId: { $exists: true, $ne: null },
    createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
  }).limit(50);

  let reconciled = 0;
  for (const payment of pending) {
    try {
      const payments = await razorpay.orders.fetchPayments(payment.razorpayOrderId);
      const captured = payments.items?.find((p) => p.status === 'captured');
      if (captured) {
        payment.razorpayPaymentId = captured.id;
        await fulfillPayment(payment);
        reconciled += 1;
      }
    } catch {
      // skip failed reconciliation attempts
    }
  }
  return { reconciled };
};

module.exports = {
  createOrder,
  verifyAndCapture,
  completeDemoPayment,
  handleWebhook,
  reconcilePendingPayments,
  verifyRazorpaySignature,
};
