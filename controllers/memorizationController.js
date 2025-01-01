const MemorizationEntry = require('../models/MemorizationEntry');
const MemorizationSession = require('../models/MemorizationSession');

// Start a new memorization entry
exports.startMemorization = async (req, res) => {
  try {
    const { surahNumber, surahName, fromVerse, toVerse } = req.body;
    
    const entry = await MemorizationEntry.create({
      user: req.user._id,
      surahNumber,
      surahName,
      fromVerse,
      toVerse
    });

    // Start first session automatically
    const session = await MemorizationSession.create({
      user: req.user._id,
      memorizationEntry: entry._id
    });

    res.status(201).json({ entry, session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Start a new session for existing entry
exports.startNewSession = async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const existingSessions = await MemorizationSession.countDocuments({
      memorizationEntry: entryId
    });

    if (existingSessions >= 4) {
      throw new Error('Maximum 4 sessions allowed per entry');
    }

    const session = await MemorizationSession.create({
      user: req.user._id,
      memorizationEntry: entryId
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Complete a session
exports.completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await MemorizationSession.findById(sessionId);
    if (!session) throw new Error('Session not found');

    session.endTime = new Date();
    session.completed = true;
    await session.save();

    // Update the memorization entry
    const entry = await MemorizationEntry.findById(session.memorizationEntry);
    entry.totalSessionsCompleted += 1;
    await entry.save();

    res.json({ session, entry });
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
    if (!entry) throw new Error('Memorization entry not found');

    // Find and complete any active session
    const activeSession = await MemorizationSession.findOne({
      memorizationEntry: entryId,
      completed: false
    });

    if (activeSession) {
      activeSession.endTime = new Date();
      activeSession.completed = true;
      await activeSession.save();
    }

    // Update the entry status
    entry.status = 'completed';
    entry.dateCompleted = new Date();
    entry.confidenceLevel = confidenceLevel;
    entry.notes = notes;
    await entry.save();

    res.json({ 
      message: 'Memorization completed successfully',
      entry,
      lastSession: activeSession 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get memorization progress
exports.getMemorizationProgress = async (req, res) => {
  try {
    const { entryId } = req.params;

    const entry = await MemorizationEntry.findById(entryId)
      .populate('sessions');

    if (!entry) throw new Error('Memorization entry not found');

    const sessions = await MemorizationSession.find({
      memorizationEntry: entryId
    }).sort('startTime');

    res.json({
      entry,
      sessions,
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.completed).length
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
    
    if (!session) throw new Error('Session not found');

    if (!session.isPaused) {
      // Pausing the session
      session.isPaused = true;
      session.pauseStartTime = new Date();
    } else {
      // Resuming the session
      const pauseDuration = (new Date() - new Date(session.pauseStartTime)) / (1000 * 60); // in minutes
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
    const elapsedTime = (now - startTime) / (1000 * 60); // in minutes
    const actualDuration = elapsedTime - (session.totalPauseDuration || 0);

    if (actualDuration >= session.duration && !session.isPaused) {
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