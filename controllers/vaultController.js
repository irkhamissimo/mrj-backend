const TemporaryVault = require('../models/TemporaryVault');
const Surah = require('../models/Surah');
const VerifiedMemorization = require('../models/VerifiedMemorization');
const { getJuzNumber, juzMap } = require('../utils/quranHelpers');
const mongoose = require('mongoose');
const { mergeRanges } = require('../utils/verseRanges');

// Add new memorization to vault
exports.addToVault = async (req, res) => {
  try {
    const surahNumber = Number(req.body.surahNumber);
    const fromVerse = Number(req.body.fromVerse);
    const toVerse = Number(req.body.toVerse);

    // Validate surah and verses
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) throw new Error('Invalid surah number');
    if (!Number.isInteger(fromVerse) || !Number.isInteger(toVerse) || fromVerse < 1 || toVerse > surah.numberOfAyahs || fromVerse > toVerse) {
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
    const query = { status: 'pending' };
    if (req.user.role === 'teacher') {
      query.user = { $in: req.user.assignedStudents || [] };
    } else {
      query.user = req.user._id;
    }
    const vaultEntries = await TemporaryVault.find(query).sort('surahNumber');

    res.json(vaultEntries.map((entry) => ({
      ...entry.toObject(),
      canVerify: req.user.role === 'teacher',
    })));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Teacher verification and transfer to memorized
exports.verifyAndTransfer = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const { vaultId } = req.params;
    const { rating, notes } = req.body;

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can verify memorization' });
    }
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    let result;
    await dbSession.withTransaction(async () => {
      const vaultEntry = await TemporaryVault.findOne({
        _id: vaultId,
        user: { $in: req.user.assignedStudents || [] },
      }).session(dbSession);
      if (!vaultEntry) throw new Error('Vault entry not found');
      if (vaultEntry.status === 'verified') {
        const verifiedMemorization = await VerifiedMemorization.findOne({
          user: vaultEntry.user,
          surahNumber: vaultEntry.surahNumber,
          juzNumber: getJuzNumber(vaultEntry.surahNumber, vaultEntry.consolidatedVerses.fromVerse),
        }).session(dbSession);
        result = { vaultEntry, verifiedMemorization, alreadyVerified: true };
        return;
      }

      const surah = await Surah.findOne({ number: vaultEntry.surahNumber }).session(dbSession);
      if (!surah) throw new Error('Surah not found');
      const splitRanges = [];
      for (const range of vaultEntry.verses) {
        const startJuz = getJuzNumber(vaultEntry.surahNumber, range.fromVerse);
        const endJuz = getJuzNumber(vaultEntry.surahNumber, range.toVerse);
        for (let juzNumber = startJuz; juzNumber <= endJuz; juzNumber += 1) {
          const juzStart = juzMap[juzNumber - 1];
          const nextJuzStart = juzNumber < 30 ? juzMap[juzNumber] : [114, 7];
          const fromVerse = juzNumber === startJuz
            ? range.fromVerse
            : (vaultEntry.surahNumber === juzStart[0] ? juzStart[1] : 1);
          const toVerse = juzNumber === endJuz
            ? range.toVerse
            : (vaultEntry.surahNumber === nextJuzStart[0] ? nextJuzStart[1] - 1 : surah.numberOfAyahs);
          splitRanges.push({ juzNumber, fromVerse, toVerse });
        }
      }

      const verifiedMemorizations = [];
      for (const splitRange of splitRanges) {
        let verifiedMem = await VerifiedMemorization.findOne({
          user: vaultEntry.user,
          surahNumber: vaultEntry.surahNumber,
          juzNumber: splitRange.juzNumber,
        }).session(dbSession);
        if (verifiedMem) {
          verifiedMem.ranges = mergeRanges([
            ...(verifiedMem.ranges?.length ? verifiedMem.ranges : [verifiedMem.verses]),
            { fromVerse: splitRange.fromVerse, toVerse: splitRange.toVerse },
          ]);
          verifiedMem.verses = {
            fromVerse: Math.min(...verifiedMem.ranges.map((range) => range.fromVerse)),
            toVerse: Math.max(...verifiedMem.ranges.map((range) => range.toVerse)),
          };
        } else {
          verifiedMem = new VerifiedMemorization({
            user: vaultEntry.user,
            surahNumber: vaultEntry.surahNumber,
            surahName: vaultEntry.surahName,
            surahEnglishName: vaultEntry.surahEnglishName,
            juzNumber: splitRange.juzNumber,
            verses: { fromVerse: splitRange.fromVerse, toVerse: splitRange.toVerse },
            ranges: [{ fromVerse: splitRange.fromVerse, toVerse: splitRange.toVerse }],
            verificationDate: new Date(),
            nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            intervalDays: 1,
          });
        }
        await verifiedMem.save({ session: dbSession });
        verifiedMemorizations.push(verifiedMem);
      }

    // Update vault entry status
    vaultEntry.status = 'verified';
    vaultEntry.teacherVerification = {
      verifiedBy: req.user._id,
      verificationDate: new Date(),
      rating,
      notes
    };
      await vaultEntry.save({ session: dbSession });
      result = { vaultEntry, verifiedMemorizations };
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  } finally {
    await dbSession.endSession();
  }
}; 
