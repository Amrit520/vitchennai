const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, sparse: true },
    razorpayPaymentId: { type: String, sparse: true },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentType: { type: String, enum: ['course', 'event'], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    referenceModel: { type: String, enum: ['Course', 'Event'], required: true },
    status: {
      type: String,
      enum: ['created', 'pending', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'created',
    },
    failureReason: { type: String },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    lastAttemptAt: { type: Date },
    webhookEvents: [
      {
        event: String,
        payload: mongoose.Schema.Types.Mixed,
        receivedAt: { type: Date, default: Date.now },
      },
    ],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ referenceId: 1, paymentType: 1, user: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
