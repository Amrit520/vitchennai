const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    thumbnail: { type: String, default: '' },
    duration: { type: String, default: '8 weeks' },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    lessons: [
      {
        title: String,
        content: String,
        duration: String,
        order: Number,
      },
    ],
    enrolledCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
