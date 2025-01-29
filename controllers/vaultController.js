const TemporaryVault = require('../models/TemporaryVault');
const MemorizationEntry = require('../models/MemorizationEntry');
const Surah = require('../models/Surah');
const VerifiedMemorization = require('../models/VerifiedMemorization');
const { getJuzNumber } = require('../utils/quranHelpers');

// Add new memorization to vault
exports.addToVault = async (req, res) => {
  try {
    const { surahNumber, fromVerse, toVerse } = req.body;

    // Validate surah and verses
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) throw new Error('Invalid surah number');
    if (fromVerse < 1 || toVerse > surah.numberOfAyahs) {
      throw new Error(`Verse numbers must be between 1 and ${surah.numberOfAyahs}`);
    }

    // Find existing vault entry for this surah
    let vaultEntry = await TemporaryVault.findOne({
      user: req.user._id,
      surahNumber,
      status: 'pending'
    });

    if (vaultEntry) {
      // Add new verses to existing entry
      vaultEntry.verses.push({
        fromVerse,
        toVerse,
        dateAdded: new Date()
      });

      // Update consolidated verses
      vaultEntry.consolidatedVerses = {
        fromVerse: Math.min(vaultEntry.consolidatedVerses.fromVerse, fromVerse),
        toVerse: Math.max(vaultEntry.consolidatedVerses.toVerse, toVerse)
      };
    } else {
      // Create new vault entry
      vaultEntry = new TemporaryVault({
        user: req.user._id,
        surahNumber,
        surahName: surah.name,
        surahEnglishName: surah.englishName,
        verses: [{
          fromVerse,
          toVerse,
          dateAdded: new Date()
        }],
        consolidatedVerses: {
          fromVerse,
          toVerse
        }
      });
    }

    await vaultEntry.save();
    res.status(201).json(vaultEntry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get user's vault entries
exports.getVaultEntries = async (req, res) => {
  try {
    const vaultEntries = await TemporaryVault.find({
      user: req.user._id,
      status: 'pending'
    }).sort('surahNumber');

    res.json(vaultEntries);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Teacher verification and transfer to memorized
exports.verifyAndTransfer = async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { rating, notes } = req.body;

    const vaultEntry = await TemporaryVault.findById(vaultId);
    if (!vaultEntry) throw new Error('Vault entry not found');

    // Get the juz number for these verses
    const juzNumber = getJuzNumber(vaultEntry.surahNumber, vaultEntry.consolidatedVerses.fromVerse);

    // Find or create verified memorization entry
    let verifiedMem = await VerifiedMemorization.findOne({
      user: vaultEntry.user,
      surahNumber: vaultEntry.surahNumber,
      juzNumber
    });

    if (verifiedMem) {
      // Update existing verified memorization
      verifiedMem.verses = {
        fromVerse: Math.min(verifiedMem.verses.fromVerse, vaultEntry.consolidatedVerses.fromVerse),
        toVerse: Math.max(verifiedMem.verses.toVerse, vaultEntry.consolidatedVerses.toVerse)
      };
    } else {
      // Create new verified memorization
      verifiedMem = new VerifiedMemorization({
        user: vaultEntry.user,
        surahNumber: vaultEntry.surahNumber,
        surahName: vaultEntry.surahName,
        juzNumber,
        verses: vaultEntry.consolidatedVerses,
        verificationDate: new Date()
      });
    }

    await verifiedMem.save();

    // Update vault entry status
    vaultEntry.status = 'verified';
    vaultEntry.teacherVerification = {
      verifiedBy: req.user._id,
      verificationDate: new Date(),
      rating,
      notes
    };
    await vaultEntry.save();

    res.json({ vaultEntry, verifiedMemorization: verifiedMem });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 
