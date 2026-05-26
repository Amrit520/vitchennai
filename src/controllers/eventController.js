const { validationResult } = require('express-validator');
const Event = require('../models/Event');

exports.getEvents = async (req, res, next) => {
  try {
    const { eventType, status, upcoming, page = 1, limit = 12 } = req.query;
    const filter = {};

    if (eventType) filter.eventType = eventType;
    if (status) filter.status = status;
    else filter.status = { $in: ['published'] };

    if (upcoming === 'true') {
      filter.startDate = { $gte: new Date() };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('organizer', 'name email')
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Event.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: events.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      events,
    });
  } catch (error) {
    next(error);
  }
};

exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email')
      .populate('attendees', 'name email');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

exports.createEvent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const event = await Event.create({ ...req.body, organizer: req.user.id });
    res.status(201).json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

exports.cancelEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    event.status = 'cancelled';
    await event.save();
    res.json({ success: true, event, message: 'Event cancelled' });
  } catch (error) {
    next(error);
  }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ attendees: req.user.id })
      .populate('organizer', 'name')
      .sort({ startDate: 1 });

    res.json({ success: true, events });
  } catch (error) {
    next(error);
  }
};

exports.getEventStats = async (req, res, next) => {
  try {
    const [total, upcoming, byType] = await Promise.all([
      Event.countDocuments({ status: 'published' }),
      Event.countDocuments({ status: 'published', startDate: { $gte: new Date() } }),
      Event.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: { total, upcoming, byType },
    });
  } catch (error) {
    next(error);
  }
};
