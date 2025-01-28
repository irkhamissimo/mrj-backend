const MemorizationEntry = require("../models/MemorizationEntry");
const MemorizationSession = require("../models/MemorizationSession");
const RevisionSession = require("../models/RevisionSession");
const Surah = require("../models/Surah");
const TemporaryVault = require("../models/TemporaryVault");

// Start a new memorization entry
exports.startMemorization = async (req, res) => {
  try {
    const { surahNumber, fromVerse, toVerse } = req.body;

    // Get surah details to validate
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) {
      throw new Error("Invalid surah number");
    }

    // Validate verse numbers
    if (fromVerse < 1 || toVerse > surah.numberOfAyahs) {
      throw new Error(
        `Verse numbers must be between 1 and ${surah.numberOfAyahs}`
      );
    }
    if (fromVerse > toVerse) {
      throw new Error(
        "Starting verse must be less than or equal to ending verse"
      );
    }

    const entry = await MemorizationEntry.create({
      user: req.user._id,
      surahNumber,
      surahName: surah.name,
      surahEnglishName: surah.englishName,
      fromVerse,
      toVerse,
    });

    // Start first session automatically
    const session = await MemorizationSession.create({
      user: req.user._id,
      memorizationEntry: entry._id,
    });

    res.status(201).json({
      entry: {
        ...entry.toObject(),
        surahDetails: {
          englishName: surah.englishName,
          englishNameTranslation: surah.englishNameTranslation,
          numberOfAyahs: surah.numberOfAyahs,
        },
      },
      session,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Start a new session for existing entry
exports.startNewSession = async (req, res) => {
  try {
    const { entryId } = req.params;
    const dateNow = new Date();
    const localDateNow = new Date(dateNow.toLocaleString());
    const dateOnly = new Date(localDateNow.getFullYear(), localDateNow.getMonth(), localDateNow.getDate());

    // First, check and complete any active sessions that have passed 25 minutes
    const activeSession = await MemorizationSession.findOne({
      memorizationEntry: entryId,
      completed: false,
      startTime: { $gte: dateOnly },
    });

    if (activeSession) {
      const now = new Date();
      const startTime = new Date(activeSession.startTime);
      const elapsedTime = (now - startTime) / (1000 * 60); // in minutes
      const actualDuration =
        elapsedTime - (activeSession.totalPauseDuration || 0);

      if (actualDuration >= activeSession.duration && !activeSession.isPaused) {
        activeSession.completed = true;
        activeSession.endTime = now;
        await activeSession.save();

        // Update the memorization entry
        const entry = await MemorizationEntry.findById(entryId);
        entry.totalSessionsCompleted += 1;
        await entry.save();
      } else if (!activeSession.isPaused) {
        throw new Error("Previous session is still in progress");
      }
    }

    // Count completed sessions
    const existingSessions = await MemorizationSession.countDocuments({
      memorizationEntry: entryId,
      completed: true,
      startTime: { $gte: dateOnly },
    });

    if (existingSessions >= 4) {
      throw new Error("Maximum 4 sessions allowed per entry");
    }

    // Create new session
    const session = await MemorizationSession.create({
      user: req.user._id,
      memorizationEntry: entryId,
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Finish memorization
exports.finishMemorization = async (req, res) => {
  try {
    const { entryId } = req.params;
    const { confidenceLevel, notes } = req.body;

    // Find the entry and its active session
    const entry = await MemorizationEntry.findById(entryId);
    if (!entry) throw new Error("Memorization entry not found");

    // Find and complete any active session
    const activeSession = await MemorizationSession.findOne({
      memorizationEntry: entryId,
      completed: false,
    });

    if (activeSession) {
      activeSession.endTime = new Date();
      activeSession.completed = true;
      await activeSession.save();
    }

    // Get all completed sessions for this entry
    const completedSessions = await MemorizationSession.find({
      memorizationEntry: entryId,
      completed: true,
    });

    // Calculate total time
    const totalTimeInMinutes = completedSessions.length * 25;

    // Update the entry status
    entry.status = "completed";
    entry.dateCompleted = new Date();
    entry.confidenceLevel = confidenceLevel;
    entry.notes = notes;
    entry.totalTimeSpent = totalTimeInMinutes;
    await entry.save();

    // Add to temporary vault
    let vaultEntry = await TemporaryVault.findOne({
      user: req.user._id,
      surahNumber: entry.surahNumber,
      status: "pending",
    });

    if (vaultEntry) {
      // Add new verses to existing entry
      vaultEntry.verses.push({
        fromVerse: entry.fromVerse,
        toVerse: entry.toVerse,
        dateAdded: new Date(),
      });

      // Update consolidated verses
      vaultEntry.consolidatedVerses = {
        fromVerse: Math.min(
          vaultEntry.consolidatedVerses.fromVerse,
          entry.fromVerse
        ),
        toVerse: Math.max(vaultEntry.consolidatedVerses.toVerse, entry.toVerse),
      };
    } else {
      // Create new vault entry
      vaultEntry = new TemporaryVault({
        user: req.user._id,
        surahNumber: entry.surahNumber,
        surahName: entry.surahName,
        surahEnglishName: entry.surahEnglishName,
        verses: [
          {
            fromVerse: entry.fromVerse,
            toVerse: entry.toVerse,
            dateAdded: new Date(),
          },
        ],
        consolidatedVerses: {
          fromVerse: entry.fromVerse,
          toVerse: entry.toVerse,
        },
      });
    }

    await vaultEntry.save();

    res.json({
      message: "Memorization completed successfully",
      entry: {
        ...entry.toObject(),
        totalTimeSpent: totalTimeInMinutes,
        totalSessions: completedSessions.length,
      },
      lastSession: activeSession,
      vaultEntry,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get memorization progress
exports.getMemorizationProgress = async (req, res) => {
  try {
    const { entryId } = req.params;

    const entry = await MemorizationEntry.findById(entryId).populate(
      "sessions"
    );

    if (!entry) throw new Error("Memorization entry not found");

    const sessions = await MemorizationSession.find({
      memorizationEntry: entryId,
    }).sort("startTime");

    res.json({
      entry,
      sessions,
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s) => s.completed).length,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Toggle pause for a session
exports.togglePauseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await MemorizationSession.findById(sessionId);

    if (!session) throw new Error("Session not found");

    if (!session.isPaused) {
      // Pausing the session
      session.isPaused = true;
      session.pauseStartTime = new Date();
    } else {
      // Resuming the session
      const pauseDuration =
        (new Date() - new Date(session.pauseStartTime)) / (1000 * 60); // in minutes
      session.totalPauseDuration += pauseDuration;
      session.isPaused = false;
      session.pauseStartTime = null;
    }

    await session.save();
    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Check and update session status
exports.checkSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await MemorizationSession.findById(sessionId);

    if (!session || session.completed) {
      return res.json({ session });
    }

    const now = new Date();
    const startTime = new Date(session.startTime);
    const elapsedTime = (now - startTime) / 1000; // Changed to seconds
    const actualDuration = elapsedTime - (session.totalPauseDuration || 0) * 60; // Convert pause duration to seconds

    // For testing: 25 seconds instead of 25 minutes
    if (actualDuration >= 25 && !session.isPaused) {
      // Changed from session.duration to 25 seconds
      session.completed = true;
      session.endTime = now;
      await session.save();

      // Update the memorization entry
      const entry = await MemorizationEntry.findById(session.memorizationEntry);
      entry.totalSessionsCompleted += 1;
      await entry.save();
    }

    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Start a revision session
exports.startRevisionSession = async (req, res) => {
  try {
    const { entryId } = req.params;
    let { duration } = req.body;
    duration = parseInt(duration);

    // Validate duration
    if (
      duration !== 10 &&
      duration !== 15 &&
      duration !== 20 &&
      duration !== 25
    ) {
      throw new Error("Invalid duration. Must be 10, 15, 20, or 25 minutes");
    }

    // Check if entry exists and is completed
    const entry = await MemorizationEntry.findById(entryId);
    if (!entry) throw new Error("Memorization entry not found");
    if (entry.status !== "completed")
      throw new Error("Cannot revise uncompleted memorization");

    // Check number of existing revision sessions
    const existingRevisions = await RevisionSession.countDocuments({
      memorizationEntry: entryId,
    });

    if (existingRevisions >= 5) {
      throw new Error("Maximum 5 revision sessions allowed per entry");
    }

    // Create new revision session
    const revisionSession = await RevisionSession.create({
      user: req.user._id,
      memorizationEntry: entryId,
      duration,
    });

    res.status(201).json({ revisionSession });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Complete a revision session
exports.completeRevisionSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating } = req.body;

    const session = await RevisionSession.findById(sessionId);
    if (!session) throw new Error("Revision session not found");

    session.endTime = new Date();
    session.completed = true;
    session.rating = rating;
    await session.save();

    // Update the memorization entry's reviewDates
    const entry = await MemorizationEntry.findById(session.memorizationEntry);
    entry.reviewDates.push({
      date: new Date(),
      rating,
    });
    await entry.save();

    res.json({ session, entry });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Toggle pause for revision session
exports.toggleRevisionPause = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await RevisionSession.findById(sessionId);

    if (!session) throw new Error("Revision session not found");

    if (!session.isPaused) {
      // Pausing the session
      session.isPaused = true;
      session.pauseStartTime = new Date();
    } else {
      // Resuming the session
      const pauseDuration =
        (new Date() - new Date(session.pauseStartTime)) / (1000 * 60); // in minutes
      session.totalPauseDuration += pauseDuration;
      session.isPaused = false;
      session.pauseStartTime = null;
    }

    await session.save();
    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get revision sessions for an entry
exports.getRevisionSessions = async (req, res) => {
  try {
    const { entryId } = req.params;

    const revisionSessions = await RevisionSession.find({
      memorizationEntry: entryId,
    }).sort("startTime");

    res.json({
      revisionSessions,
      totalSessions: revisionSessions.length,
      completedSessions: revisionSessions.filter((s) => s.completed).length,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Check revision session status
exports.checkRevisionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await RevisionSession.findById(sessionId);

    if (!session || session.completed) {
      return res.json({ session });
    }

    const now = new Date();
    const startTime = new Date(session.startTime);
    const elapsedTime = (now - startTime) / (1000 * 60); // in minutes
    const actualDuration = elapsedTime - (session.totalPauseDuration || 0);

    if (actualDuration >= session.duration && !session.isPaused) {
      session.completed = true;
      session.endTime = now;
      await session.save();
    }

    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// get memorization that has been completed by entryId
exports.getCompletedMemorization = async (req, res) => {
  try {
    const { entryId } = req.params;
    const memorizations = await MemorizationEntry.find({
      status: "completed",
      _id: entryId,
    });
    if (!memorizations) throw new Error("Memorization not found");
    res.json(memorizations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add this new function to get all completed memorizations
exports.getCompletedMemorization = async (req, res) => {
  try {
    const memorizations = await MemorizationEntry.find({
      status: "completed",
    });
    res.json(memorizations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.countCompletedMemorization = async (req, res) => {
  try {
    // return count of completed memorizations
      const memorizations = await MemorizationEntry.countDocuments({
      user: req.user._id,
      status: "completed",
    });

    res.json(memorizations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// get memorization by dateStarted
exports.getMemorizationByDateStarted = async (req, res) => {
  try {
    const dateNow = new Date();
    const localDateNow = new Date(dateNow.toLocaleString());
    const dateOnly = new Date(localDateNow.getFullYear(), localDateNow.getMonth(), localDateNow.getDate());
    const memorizations = await MemorizationEntry.find({ dateStarted: { $gte: dateOnly } });
    
    const memorizationsWithSurahEnglishName = memorizations.map((memorization) => ({
      surahNumber: memorization.surahNumber,
      surahEnglishName: memorization.surahEnglishName,
      fromVerse: memorization.fromVerse,
      toVerse: memorization.toVerse,
      status: memorization.status,
      totalSessionsCompleted: memorization.totalSessionsCompleted,
    }));
    res.json(memorizationsWithSurahEnglishName);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
