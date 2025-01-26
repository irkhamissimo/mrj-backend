const VerifiedMemorization = require('../models/VerifiedMemorization');
const Surah = require('../models/Surah');
const { getJuzNumber, juzMap } = require('../utils/quranHelpers');
const jwt = require('jsonwebtoken');
// Add previously memorized surah
exports.addMemorizedSurah = async (req, res) => {
  try {
    const { surahNumber, fromVerse, toVerse } = req.body;

    // Validate surah and verses
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) throw new Error('Invalid surah number');
    if (fromVerse < 1 || toVerse > surah.numberOfAyahs) {
      throw new Error(`Verse numbers must be between 1 and ${surah.numberOfAyahs}`);
    }

    // Get juz number for these verses
    const startJuz = getJuzNumber(surahNumber, fromVerse);
    const endJuz = getJuzNumber(surahNumber, toVerse);

    // We need to split the verses if they span multiple juz
    for (let currentJuz = startJuz; currentJuz <= endJuz; currentJuz++) {
      // Find juz boundaries
      const juzStartInfo = juzMap[currentJuz - 1];
      const juzEndInfo = currentJuz < 30 ? juzMap[currentJuz] : [114, 6];

      let juzFromVerse = fromVerse;
      let juzToVerse = toVerse;

      // Adjust verses based on juz boundaries
      if (currentJuz !== startJuz) {
        // If not the first juz, start from the juz's first verse
        juzFromVerse = surahNumber === juzStartInfo[0] ? juzStartInfo[1] : 1;
      }
      if (currentJuz !== endJuz) {
        // If not the last juz, end at the juz's last verse
        juzToVerse = surahNumber === juzEndInfo[0] ? juzEndInfo[1] - 1 : surah.numberOfAyahs;
      }

      // Check if there's an existing memorization for this surah and juz
      let verifiedMem = await VerifiedMemorization.findOne({
        user: req.user._id,
        surahNumber,
        juzNumber: currentJuz
      });

      if (verifiedMem) {
        // Update existing memorization if new verses extend the range
        verifiedMem.verses = {
          fromVerse: Math.min(verifiedMem.verses.fromVerse, juzFromVerse),
          toVerse: Math.max(verifiedMem.verses.toVerse, juzToVerse)
        };
      } else {
        // Create new memorization entry
        verifiedMem = new VerifiedMemorization({
          user: req.user._id,
          surahNumber,
          surahName: surah.name,
          surahEnglishName: surah.englishName,
          juzNumber: currentJuz,
          verses: { fromVerse: juzFromVerse, toVerse: juzToVerse },
          verificationDate: new Date(),
          averageRating: 5
        });
      }

      await verifiedMem.save();
    }

    // Return all memorizations for this surah
    const allMemorizations = await VerifiedMemorization.find({
      user: req.user._id,
      surahNumber
    }).sort('juzNumber');

    res.status(201).json(allMemorizations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add previously memorized juz
exports.addMemorizedJuz = async (req, res) => {
  try {
    const { juzNumber } = req.body;
    
    // Validate juz number
    if (juzNumber < 1 || juzNumber > 30) {
      throw new Error('Invalid juz number');
    }

    // Get the start point of this juz and next juz
    const juzStart = juzMap[juzNumber - 1];
    const nextJuzStart = juzNumber < 30 ? juzMap[juzNumber] : [114, 6];

    const verifiedMems = [];
    let currentSurah = juzStart[0];
    
    while (currentSurah <= nextJuzStart[0]) {
      const surah = await Surah.findOne({ number: currentSurah });
      if (!surah) throw new Error(`Surah ${currentSurah} not found`);

      let fromVerse, toVerse;

      if (currentSurah === juzStart[0]) {
        // First surah in juz
        fromVerse = juzStart[1];
        if (currentSurah === nextJuzStart[0]) {
          // If this is also the last surah in juz
          toVerse = nextJuzStart[1] - 1;
        } else {
          toVerse = surah.numberOfAyahs;
        }
      } else if (currentSurah === nextJuzStart[0]) {
        // Last surah in juz
        fromVerse = 1;
        toVerse = nextJuzStart[1] - 1;
      } else {
        // Middle surahs - include all verses
        fromVerse = 1;
        toVerse = surah.numberOfAyahs;
      }

      // Only add this surah if it has verses in this juz
      if (currentSurah < nextJuzStart[0] || (currentSurah === nextJuzStart[0] && toVerse >= fromVerse)) {
        // Check existing or create new
        let verifiedMem = await VerifiedMemorization.findOne({
          user: req.user._id,
          surahNumber: currentSurah,
          juzNumber
        });

        if (verifiedMem) {
          // Only update if the new range extends the existing one
          const newFromVerse = Math.min(verifiedMem.verses.fromVerse, fromVerse);
          const newToVerse = Math.max(verifiedMem.verses.toVerse, toVerse);
          
          // Only update if there's a change
          if (newFromVerse !== verifiedMem.verses.fromVerse || newToVerse !== verifiedMem.verses.toVerse) {
            verifiedMem.verses = {
              fromVerse: newFromVerse,
              toVerse: newToVerse
            };
            await verifiedMem.save();
          }
        } else {
          verifiedMem = new VerifiedMemorization({
            user: req.user._id,
            surahNumber: currentSurah,
            surahName: surah.name,
            surahEnglishName: surah.englishName,
            juzNumber,
            verses: { fromVerse, toVerse },
            verificationDate: new Date(),
            averageRating: 5
          });
          await verifiedMem.save();
        }
        
        verifiedMems.push(verifiedMem);
      }
      
      currentSurah++;
    }

    res.status(201).json({
      message: `Successfully added Juz ${juzNumber} to memorized content`,
      verifiedMemorizations: verifiedMems
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all memorized content (both from verification and direct addition)
exports.getAllMemorized = async (req, res) => {
  try {
    // get token from header
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const memorized = await VerifiedMemorization.find({
      user: req.user._id
    }).sort({ surahNumber: 1, 'verses.fromVerse': 1 });

    // Group by both surah and juz
    const bySurah = {};
    const byJuz = {};

    memorized.forEach(mem => {
      // Group by surah
      if (!bySurah[mem.surahNumber]) {
        bySurah[mem.surahNumber] = {
          surahNumber: mem.surahNumber,
          surahName: mem.surahName,
          surahEnglishName: mem.surahEnglishName,
          verses: [],
          lastRevisionDate: mem.lastRevisionDate,
          averageRating: mem.averageRating
        };
      }
      bySurah[mem.surahNumber].verses.push(mem.verses);

      // Group by juz
      if (!byJuz[mem.juzNumber]) {
        byJuz[mem.juzNumber] = {
          juzNumber: mem.juzNumber,
          surahs: {},
          lastRevisionDate: mem.lastRevisionDate,
          averageRating: mem.averageRating
        };
      }
      if (!byJuz[mem.juzNumber].surahs[mem.surahNumber]) {
        byJuz[mem.juzNumber].surahs[mem.surahNumber] = {
          surahNumber: mem.surahNumber,
          surahName: mem.surahName,
          surahEnglishName: mem.surahEnglishName,
          verses: []
        };
      }
      byJuz[mem.juzNumber].surahs[mem.surahNumber].verses.push(mem.verses);
    });

    // Format verses as a single range string for each surah
    Object.values(bySurah).forEach(surah => {
      if (surah.verses.length > 0) {
        const minVerse = Math.min(...surah.verses.map(v => v.fromVerse));
        const maxVerse = Math.max(...surah.verses.map(v => v.toVerse));
        surah.verses = `${minVerse} - ${maxVerse}`;
      }
    });

    // Format verses as a single range string for each surah in juz
    Object.values(byJuz).forEach(juz => {
      Object.values(juz.surahs).forEach(surah => {
        if (surah.verses.length > 0) {
          const minVerse = Math.min(...surah.verses.map(v => v.fromVerse));
          const maxVerse = Math.max(...surah.verses.map(v => v.toVerse));
          surah.verses = `${minVerse} - ${maxVerse}`;
        }
      });
    });

    res.json({
      bySurah: Object.values(bySurah),
      byJuz: Object.values(byJuz)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 

// Update memorized surah verses
exports.updateMemorizedSurahVerses = async (req, res) => {
  kkk
 try {
  const { surahNumber} =req.params;
  const { verses } = req.body;
  const memorized = await VerifiedMemorization.findOneAndUpdate({ surahNumber, user: req.user._id }, { 

 });
  res.json(memorized);
 } catch (error) {
  res.status(400).json({ error: error.message });
 }
};