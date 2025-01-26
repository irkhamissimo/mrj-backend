const mongoose = require("mongoose");

const verifiedMemorizationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // For Surah-based organization
  surahNumber: {
    type: Number,
    required: true
  },
  surahName: {
    type: String,
    required: true
  },
  surahEnglishName: {
    type: String,
    required: true
  },
  // For Juz-based organization
  juzNumber: {
    type: Number,
    required: true
  },
  // Track verses in this verified memorization
  verses: {
    fromVerse: {
      type: Number,
      required: true
    },
    toVerse: {
      type: Number,
      required: true
    }
  },
  // Track when this was verified
  verificationDate: {
    type: Date,
    required: true
  },
  // Track revision history
  revisions: [{
    date: {
      type: Date,
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    duration: {
      type: Number,
      enum: [10, 15, 20, 25]
    },
    notes: String
  }],
  lastRevisionDate: Date,
  averageRating: {
    type: Number,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VerifiedMemorization', verifiedMemorizationSchema); 