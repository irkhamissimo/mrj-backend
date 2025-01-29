const mongoose = require("mongoose");

const temporaryVaultSchema = new mongoose.Schema({
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
  surahEnglishName: {
    type: String,
    required: false
  },
  verses: [{
    fromVerse: {
      type: Number,
      required: true
    },
    toVerse: {
      type: Number,
      required: true
    },
    dateAdded: {
      type: Date,
      default: Date.now
    }
  }],
  consolidatedVerses: {
    fromVerse: {
      type: Number,
      required: true
    },
    toVerse: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'verified'],
    default: 'pending'
  },
  teacherVerification: {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationDate: Date,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    notes: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TemporaryVault', temporaryVaultSchema); 