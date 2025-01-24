const VerifiedMemorization = require('../models/VerifiedMemorization');
const MurajaahSession = require('../models/MurajaahSession');

// Get verified memorizations by surah
exports.getVerifiedBySurah = async (req, res) => {
  try {
    const verifiedMems = await VerifiedMemorization.find({
      user: req.user._id
    }).sort('surahNumber');

    // Group by surah
    const bySurah = verifiedMems.reduce((acc, mem) => {
      if (!acc[mem.surahNumber]) {
        acc[mem.surahNumber] = {
          surahNumber: mem.surahNumber,
          surahName: mem.surahName,
          verses: [],
          lastRevisionDate: mem.lastRevisionDate,
          averageRating: mem.averageRating
        };
      }
      acc[mem.surahNumber].verses.push(mem.verses);
      return acc;
    }, {});

    res.json(Object.values(bySurah));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get verified memorizations by juz
exports.getVerifiedByJuz = async (req, res) => {
  try {
    const verifiedMems = await VerifiedMemorization.find({
      user: req.user._id
    }).sort('juzNumber');

    // Group by juz
    const byJuz = verifiedMems.reduce((acc, mem) => {
      if (!acc[mem.juzNumber]) {
        acc[mem.juzNumber] = {
          juzNumber: mem.juzNumber,
          surahs: {},
          lastRevisionDate: mem.lastRevisionDate,
          averageRating: mem.averageRating
        };
      }
      if (!acc[mem.juzNumber].surahs[mem.surahNumber]) {
        acc[mem.juzNumber].surahs[mem.surahNumber] = {
          surahNumber: mem.surahNumber,
          surahName: mem.surahName,
          verses: []
        };
      }
      acc[mem.juzNumber].surahs[mem.surahNumber].verses.push(mem.verses);
      return acc;
    }, {});

    res.json(Object.values(byJuz));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Start revision session
exports.startRevision = async (req, res) => {
  try {
    const { type, identifier, duration } = req.body; // type: 'surah' or 'juz', identifier: surahNumber or juzNumber
    // make duration 25 seconds

    // Validate duration
    if (duration !== 25) {
      throw new Error('Invalid duration. Must be 25 minutes');
    }

    let verifiedMems;
    if (type === 'surah') {
      verifiedMems = await VerifiedMemorization.find({
        user: req.user._id,
        surahNumber: identifier
      });
    } else if (type === 'juz') {
      verifiedMems = await VerifiedMemorization.find({
        user: req.user._id,
        juzNumber: identifier
      });
    } else {
      throw new Error('Invalid revision type');
    }

    if (!verifiedMems.length) {
      throw new Error('No verified memorizations found');
    }

    // Create murajaah session
    const session = await MurajaahSession.create({
      user: req.user._id,
      duration,
      verifiedMemorizations: verifiedMems.map(mem => mem._id)
    });

    res.json({ session, verifiedMemorizations: verifiedMems });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add this new method to handle pause/resume
exports.pauseRevision = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await MurajaahSession.findById(sessionId);
    
    if (!session) throw new Error('Murajaah session not found');
    if (session.completed) throw new Error('Cannot pause completed session');

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
    res.json({ 
      message: session.isPaused ? 'Session paused' : 'Session resumed',
      session 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Check session status
exports.checkSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await MurajaahSession.findById(sessionId);

    if (!session || session.completed) {
      return res.json({ session });
    }

    const now = new Date();
    const startTime = new Date(session.startTime);
    const elapsedTime = (now - startTime) / 1000; // in seconds
    const actualDuration = elapsedTime - (session.totalPauseDuration || 0) * 60; // Convert pause duration to seconds

    // Check if session should be completed
    if (actualDuration >= 25 && !session.isPaused) {
      session.completed = true;
      session.endTime = now;
      await session.save();

      // Update verified memorizations
      for (const memId of session.verifiedMemorizations) {
        const verifiedMem = await VerifiedMemorization.findById(memId);
        if (verifiedMem) {
          verifiedMem.lastRevisionDate = now;
          await verifiedMem.save();
        }
      }
    }

    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get memorized content
exports.getMemorizedContent = async (req, res) => {
  try {
    const dateNow = new Date();
    const localDateNow = new Date(dateNow.toLocaleString());
    const dateOnly = new Date(localDateNow.getFullYear(), localDateNow.getMonth(), localDateNow.getDate());
    const memorizedContent = await MemorizationEntry.find({ user: req.user._id, dateStarted: { $gte: dateOnly } });
// get how many sessions completed
    const totalSessionsCompleted = memorizedContent.reduce((acc, mem) => acc + mem.totalSessionsCompleted, 0);  

    res.json({ totalSessionsCompleted });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};