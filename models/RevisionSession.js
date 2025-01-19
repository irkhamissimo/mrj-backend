const mongoose = require("mongoose");

const revisionSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memorizationEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemorizationEntry',
    required: false
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
    enum: [10, 15, 20, 25],  // Available durations in minutes
    required: true
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

module.exports = mongoose.model('RevisionSession', revisionSessionSchema); 