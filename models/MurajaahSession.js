const mongoose = require("mongoose");

const murajaahSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedMemorizations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VerifiedMemorization'
  }],
  // What the user selected when starting the session: a specific surah or a
  // full juz. Stored so activity history can show "Juz 1" instead of guessing
  // from the underlying memorizations.
  revisionType: {
    type: String,
    enum: ['surah', 'juz']
  },
  revisionIdentifier: {
    type: Number
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    required: true,
    default: 25
  },
  completed: {
    type: Boolean,
    default: false
  },
  // Set when an incomplete session is left over from a previous day so it no
  // longer surfaces as the active session after the daily reset.
  abandoned: {
    type: Boolean,
    default: false
  },
  isPaused: {
    type: Boolean,
    default: false
  },
  pauseStartTime: {
    type: Date
  },
  totalPauseDuration: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  }
});

module.exports = mongoose.model('MurajaahSession', murajaahSessionSchema); 