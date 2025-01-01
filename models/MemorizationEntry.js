const mongoose = require('mongoose');

const memorizationEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  surahNumber: {
    type: Number,
    required: true
  },
  surahName: {
    type: String,
    required: true
  },
  fromVerse: {
    type: Number,
    required: true
  },
  toVerse: {
    type: Number,
    required: true
  },
  dateStarted: {
    type: Date,
    default: Date.now
  },
  dateCompleted: {
    type: Date
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'reviewing'],
    default: 'in_progress'
  },
  confidenceLevel: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: {
    type: String
  },
  totalSessionsCompleted: {
    type: Number,
    default: 0
  },
  reviewDates: [{
    date: Date,
    rating: Number
  }]
});

// Virtual property to get associated sessions
memorizationEntrySchema.virtual('sessions', {
  ref: 'MemorizationSession',
  localField: '_id',
  foreignField: 'memorizationEntry'
});

// Ensure virtuals are included when converting to JSON
memorizationEntrySchema.set('toJSON', { virtuals: true });
memorizationEntrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('MemorizationEntry', memorizationEntrySchema); 