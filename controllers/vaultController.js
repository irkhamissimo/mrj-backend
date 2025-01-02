const TemporaryVault = require('../models/TemporaryVault');
const MemorizationEntry = require('../models/MemorizationEntry');
const Surah = require('../models/Surah');

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

    // Create verified memorization entry
    const memorizedEntry = await MemorizationEntry.create({
      user: vaultEntry.user,
      surahNumber: vaultEntry.surahNumber,
      surahName: vaultEntry.surahName,
      fromVerse: vaultEntry.consolidatedVerses.fromVerse,
      toVerse: vaultEntry.consolidatedVerses.toVerse,
      isVerified: true,
      teacherVerification: {
        verifiedBy: req.user._id,
        verificationDate: new Date(),
        rating,
        notes
      },
      status: 'completed',
      dateCompleted: new Date()
    });

    // Update vault entry status
    vaultEntry.status = 'verified';
    vaultEntry.teacherVerification = {
      verifiedBy: req.user._id,
      verificationDate: new Date(),
      rating,
      notes
    };
    await vaultEntry.save();

    res.json({ vaultEntry, memorizedEntry });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 