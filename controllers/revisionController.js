const VerifiedMemorization = require('../models/VerifiedMemorization');
const MurajaahSession = require('../models/MurajaahSession');
const MemorizationEntry = require('../models/MemorizationEntry');
const { awardPoints } = require('../utils/gamification');

// Helper to get the start of the current day in a specific timezone.
// This is used so daily counters (like the murajaah session circles) reset
// at the user's local midnight instead of the server's timezone.
function getStartOfDay(timeZone = 'Asia/Jakarta') {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateParts = dateFormatter.formatToParts(now);
  const year = parseInt(dateParts.find((p) => p.type === 'year').value, 10);
  const month = parseInt(dateParts.find((p) => p.type === 'month').value, 10);
  const day = parseInt(dateParts.find((p) => p.type === 'day').value, 10);

  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const offsetParts = offsetFormatter.formatToParts(now);
  const offsetName = offsetParts.find((p) => p.type === 'timeZoneName').value;
  const match = offsetName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const sign = match[1] === '+' ? 1 : -1;
  const offsetMinutes = sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));

  return new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  );
}

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

    // Validate duration
    if (![10, 15, 20, 25].includes(duration)) {
      throw new Error('Invalid duration. Must be 10, 15, 20, or 25 minutes');
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
      revisionType: type,
      revisionIdentifier: identifier,
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

    if (!session) {
      return res.json({ session });
    }

    // A leftover session from a previous day is treated as finished so any
    // open client clears it, without marking it completed in the database.
    if (session.abandoned) {
      return res.json({ session: { ...session.toObject(), completed: true } });
    }

    if (session.completed) {
      return res.json({ session });
    }

    const now = new Date();
    const startTime = new Date(session.startTime);
    const elapsedTime = (now - startTime) / 1000; // in seconds
    const actualDuration = elapsedTime - (session.totalPauseDuration || 0) * 60; // Convert pause duration to seconds

    // Check if session should be completed
    if (actualDuration >= session.duration * 60 && !session.isPaused) {
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

      // Award gamification points for murajaah
      awardPoints(session.user, 'murajaah', session.duration);
    }

    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get the user's current (in-progress) murajaah session, if any
exports.getCurrentRevision = async (req, res) => {
  try {
    const startOfToday = getStartOfDay();

    // Abandon any incomplete sessions left over from previous days so they
    // don't resurface as the active session after the daily reset.
    // Use $ne: true so legacy sessions missing the field are still matched.
    await MurajaahSession.updateMany(
      {
        user: req.user._id,
        completed: false,
        abandoned: { $ne: true },
        startTime: { $lt: startOfToday },
      },
      { $set: { abandoned: true } }
    );

    const session = await MurajaahSession.findOne({
      user: req.user._id,
      completed: false,
      abandoned: { $ne: true },
    }).sort({ startTime: -1 });

    if (!session) {
      return res.json({ session: null });
    }

    // Reuse the same completion logic as checkSessionStatus so a session
    // that finished while offline is marked complete here.
    const now = new Date();
    const startTime = new Date(session.startTime);
    const elapsedTime = (now - startTime) / 1000;
    const actualDuration = elapsedTime - (session.totalPauseDuration || 0) * 60;

    if (actualDuration >= session.duration * 60 && !session.isPaused) {
      session.completed = true;
      session.endTime = now;
      await session.save();

      for (const memId of session.verifiedMemorizations) {
        const verifiedMem = await VerifiedMemorization.findById(memId);
        if (verifiedMem) {
          verifiedMem.lastRevisionDate = now;
          await verifiedMem.save();
        }
      }

      awardPoints(session.user, 'murajaah', session.duration);
      return res.json({ session, verifiedMemorizations: [] });
    }

    const verifiedMemorizations = await VerifiedMemorization.find({
      _id: { $in: session.verifiedMemorizations },
    });

    res.json({ session, verifiedMemorizations });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get memorized content
exports.getMemorizedContent = async (req, res) => {
  try {
    const dateOnly = getStartOfDay();
    const memorizedContent = await MemorizationEntry.find({ user: req.user._id, dateStarted: { $gte: dateOnly } });
// get how many sessions completed
    const totalSessionsCompleted = memorizedContent.reduce((acc, mem) => acc + mem.totalSessionsCompleted, 0);  

    res.json({ totalSessionsCompleted });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// get murajaah sessions by date
exports.countMurajaahSessions = async (req, res) => {
  try {
    const dateOnly = getStartOfDay();
    const sessions = await MurajaahSession.find({ user: req.user._id, startTime: { $gte: dateOnly } });
    
    const totalSessionsCompleted = sessions.filter(session => session.completed).length;

    res.json({ totalSessionsCompleted });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};