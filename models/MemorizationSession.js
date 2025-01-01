const mongoose = require("mongoose");

const memorizationSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    type: Number,  // Duration in minutes
    default: 25    // Default Pomodoro duration
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
    type: Number,  // Total pause duration in minutes
    default: 0
  },
  memorizationEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemorizationEntry',
    required: true
  }
});

module.exports = mongoose.model('MemorizationSession', memorizationSessionSchema); 