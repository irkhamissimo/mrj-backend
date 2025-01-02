const Surah = require('../models/Surah');

// Get all surahs for dropdown
exports.getAllSurahs = async (req, res) => {
  try {
    const surahs = await Surah.find({})
      .select('number name englishName numberOfAyahs')
      .sort('number');
    
    res.json(surahs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get specific surah details
exports.getSurahDetails = async (req, res) => {
  try {
    const { surahNumber } = req.params;
    const surah = await Surah.findOne({ number: surahNumber });
    
    if (!surah) {
      throw new Error('Surah not found');
    }
    
    res.json(surah);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 