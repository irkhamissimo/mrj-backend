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