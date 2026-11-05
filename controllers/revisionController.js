const VerifiedMemorization = require('../models/VerifiedMemorization');
const MurajaahSession = require('../models/MurajaahSession');
const MemorizationEntry = require('../models/MemorizationEntry');
const { awardPoints } = require('../utils/gamification');
const mongoose = require('mongoose');
const { nextReviewDate } = require('../utils/reviewSchedule');
const { mergeRanges } = require('../utils/verseRanges');

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
    const { type } = req.body;
    const identifier = Number(req.body.identifier);
    const duration = Number(req.body.duration);

    await MurajaahSession.updateMany(
      {
        user: req.user._id,
        completed: false,
        abandoned: { $ne: true },
        startTime: { $lt: getStartOfDay() },
      },
      { $set: { abandoned: true } }
    );

    const activeSession = await MurajaahSession.exists({
      user: req.user._id,
      completed: false,
      abandoned: { $ne: true },
    });
    if (activeSession) throw new Error('A review session is already in progress');

    // Validate duration
    if (![10, 15, 20, 25].includes(duration)) {
      throw new Error('Invalid duration. Must be 10, 15, 20, or 25 minutes');
    }
    if (!Number.isInteger(identifier)) throw new Error('Invalid revision identifier');

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
    const session = await MurajaahSession.findOne({ _id: sessionId, user: req.user._id });
    
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
    const session = await MurajaahSession.findOne({ _id: sessionId, user: req.user._id });

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
      const completedSession = await MurajaahSession.findOneAndUpdate(
        { _id: session._id, user: req.user._id, completed: false },
        { $set: { completed: true, endTime: now } },
        { new: true }
      );
      if (!completedSession) return res.json({ session });

      // Update verified memorizations
      for (const memId of session.verifiedMemorizations) {
        const verifiedMem = await VerifiedMemorization.findOne({
          _id: memId,
          user: req.user._id,
        });
        if (verifiedMem) {
          verifiedMem.lastRevisionDate = now;
          await verifiedMem.save();
        }
      }

      // Award gamification points for murajaah
      await awardPoints(session.user, 'murajaah', session.duration);
      return res.json({ session: completedSession });
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
      const completedSession = await MurajaahSession.findOneAndUpdate(
        { _id: session._id, user: req.user._id, completed: false },
        { $set: { completed: true, endTime: now } },
        { new: true }
      );
      if (!completedSession) return res.json({ session, verifiedMemorizations: [] });

      for (const memId of session.verifiedMemorizations) {
        const verifiedMem = await VerifiedMemorization.findOne({
          _id: memId,
          user: req.user._id,
        });
        if (verifiedMem) {
          verifiedMem.lastRevisionDate = now;
          await verifiedMem.save();
        }
      }

      await awardPoints(session.user, 'murajaah', session.duration);
      return res.json({ session: completedSession, verifiedMemorizations: [] });
    }

    const verifiedMemorizations = await VerifiedMemorization.find({
      _id: { $in: session.verifiedMemorizations },
      user: req.user._id,
    });

    res.json({ session, verifiedMemorizations });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Return material that is due on or before today. Legacy records derive their
// first review from the most recent revision or verification date.
exports.getDueReviews = async (req, res) => {
  try {
    const endOfToday = new Date(getStartOfDay().getTime() + 24 * 60 * 60 * 1000 - 1);
    const records = await VerifiedMemorization.find({ user: req.user._id })
      .sort({ nextReviewAt: 1, surahNumber: 1, 'verses.fromVerse': 1 });

    const due = records.filter((record) => {
      const baseDate = record.lastRevisionDate || record.verificationDate;
      const dueAt = record.nextReviewAt || new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
      record.nextReviewAt = dueAt;
      return dueAt <= endOfToday;
    });

    const grouped = new Map();
    for (const record of due) {
      const key = String(record.surahNumber);
      if (!grouped.has(key)) {
        grouped.set(key, {
          surahNumber: record.surahNumber,
          surahName: record.surahName,
          surahEnglishName: record.surahEnglishName,
          ranges: [],
          nextReviewAt: record.nextReviewAt,
        });
      }
      const item = grouped.get(key);
      item.ranges.push(...(record.ranges?.length ? record.ranges : [record.verses]));
      if (record.nextReviewAt < item.nextReviewAt) item.nextReviewAt = record.nextReviewAt;
    }

    const items = Array.from(grouped.values()).map((item) => ({
      ...item,
      ranges: mergeRanges(item.ranges),
    }));
    res.json({ items });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getPendingFeedback = async (req, res) => {
  try {
    const session = await MurajaahSession.findOne({
      user: req.user._id,
      completed: true,
      feedbackRequired: true,
      feedbackSubmittedAt: { $exists: false },
    }).sort({ endTime: -1 });
    res.json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.submitFeedback = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const rating = Number(req.body.rating);
    if (![1, 2, 3, 4, 5].includes(rating)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    let result;
    await dbSession.withTransaction(async () => {
      const reviewSession = await MurajaahSession.findOne({
        _id: req.params.sessionId,
        user: req.user._id,
      }).session(dbSession);

      if (!reviewSession) throw new Error('Murajaah session not found');
      if (!reviewSession.completed) throw new Error('Complete the session before rating it');
      if (reviewSession.feedbackSubmittedAt) {
        result = { session: reviewSession, alreadySubmitted: true };
        return;
      }

      const reviewedAt = reviewSession.endTime || new Date();
      const records = await VerifiedMemorization.find({
        _id: { $in: reviewSession.verifiedMemorizations },
        user: req.user._id,
      }).session(dbSession);
      if (records.length !== reviewSession.verifiedMemorizations.length) {
        throw new Error('One or more reviewed memorization records are unavailable');
      }

      for (const record of records) {
        const schedule = nextReviewDate(rating, record.intervalDays || 1, reviewedAt);
        record.lastRevisionDate = reviewedAt;
        record.intervalDays = schedule.intervalDays;
        record.nextReviewAt = schedule.nextReviewAt;
        record.revisions.push({ date: reviewedAt, rating, duration: reviewSession.duration });
        const ratedRevisions = record.revisions.filter((revision) => revision.rating);
        record.averageRating = ratedRevisions.reduce((sum, revision) => sum + revision.rating, 0) / ratedRevisions.length;
        await record.save({ session: dbSession });
      }

      reviewSession.rating = rating;
      reviewSession.feedbackSubmittedAt = new Date();
      reviewSession.feedbackRequired = false;
      await reviewSession.save({ session: dbSession });
      result = {
        session: reviewSession,
        nextReviewAt: records.length
          ? new Date(Math.min(...records.map((record) => record.nextReviewAt.getTime())))
          : null,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  } finally {
    await dbSession.endSession();
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
