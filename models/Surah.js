const mongoose = require("mongoose");

const surahSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  englishName: {
    type: String,
    required: true
  },
  englishNameTranslation: {
    type: String,
    required: true
  },
  numberOfAyahs: {
    type: Number,
    required: true
  },
  revelationType: {
    type: String,
    enum: ['Meccan', 'Medinan'],
    required: true
  }
});

module.exports = mongoose.model('Surah', surahSchema); 