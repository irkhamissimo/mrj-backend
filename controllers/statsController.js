const MemorizationSession = require('../models/MemorizationSession');
const MurajaahSession = require('../models/MurajaahSession');
const RevisionSession = require('../models/RevisionSession');

/**
 * Helper function to determine the period's start and end dates.
 * @param {String} period - 'daily', 'weekly', or 'monthly'
 * @param {String} dateStr - Optional ISO date string to use as reference (defaults to current date)
 * @returns {Object} An object with `start` and `end` Date objects for the specified period.
 */
function getPeriodRange(period, dateStr) {
  // Use provided date if available, otherwise use the current date.
  const date = dateStr ? new Date(dateStr) : new Date();
  let start, end;

  switch (period) {
    case 'weekly': {
      // Assume week starts on Sunday.
      const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      break;
    }
    case 'monthly': {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      break;
    }
    case 'daily':
    default: {
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      break;
    }
  }

  return { start, end };
}

/**
 * GET /stats?period=[daily|weekly|monthly]&date=[optional ISO date string]
 *
 * This endpoint calculates the time spent (in minutes and hours) doing:
 *   - Ziyadah (new memorization sessions from MemorizationSession)
 *   - Revision (revision sessions from RevisionSession)
 *   - Murajaah (revision sessions from MurajaahSession)
 * for the specified period.
 */
exports.getStats = async (req, res) => {
  try {
    // Get the period type from query string (defaults to 'daily')
    const period = req.query.period || 'daily';
    const { start, end } = getPeriodRange(period, req.query.date);

    const userId = req.user._id;

    // Query all completed memorization sessions (used for ziyadah)
    const ziyadahSessions = await MemorizationSession.find({
      user: userId,
      completed: true,
      startTime: { $gte: start, $lt: end }
    });

    // Query all completed murajaah sessions
    const murajaahSessions = await MurajaahSession.find({
      user: userId,
      completed: true,
      startTime: { $gte: start, $lt: end }
    });

    // Query all completed revision sessions (from RevisionSession)
    const revisionSessions = await RevisionSession.find({
      user: userId,
      completed: true,
      startTime: { $gte: start, $lt: end }
    });

    // Sum durations for each category (assuming duration is stored in minutes)
    const totalZiyadahMinutes = ziyadahSessions.reduce((acc, session) => acc + (session.duration || 0), 0);
    const totalMurajaahMinutes = murajaahSessions.reduce((acc, session) => acc + (session.duration || 0), 0);
    const totalRevisionMinutes = revisionSessions.reduce((acc, session) => acc + (session.duration || 0), 0);
    const totalMinutes = totalZiyadahMinutes + totalRevisionMinutes + totalMurajaahMinutes;

    res.json({
      period,
      start: start.toISOString(),
      end: end.toISOString(),
      timeSpent: {
        ziyadah: {
          minutes: totalZiyadahMinutes,
          hours: (totalZiyadahMinutes / 60).toFixed(2)
        },
        revision: {
          minutes: totalRevisionMinutes,
          hours: (totalRevisionMinutes / 60).toFixed(2)
        },
        murajaah: {
          minutes: totalMurajaahMinutes,
          hours: (totalMurajaahMinutes / 60).toFixed(2)
        },
        total: {
          minutes: totalMinutes,
          hours: (totalMinutes / 60).toFixed(2)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Helper function that aggregates sessions by a given date format.
 * The dateFormat parameter supports MongoDB date format strings, e.g.:
 *   - Daily: "%Y-%m-%d"
 *   - Monthly: "%Y-%m"
 */
async function aggregateByDate(Model, userId, start, end, dateFormat) {
  const result = await Model.aggregate([
    {
      $match: {
        user: userId,
        completed: true,
        startTime: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$startTime" } },
        totalMinutes: { $sum: "$duration" }
      }
    }
  ]);

  const map = {};
  result.forEach(item => {
    map[item._id] = item.totalMinutes;
  });
  return map;
}

/**
 * GET /stats/daily-breakdown?startDate=[ISO]&endDate=[ISO]
 *
 * Returns daily aggregated statistics (grouped by date in "YYYY-MM-DD") for a given date range.
 * If not provided, defaults to the last 7 days.
 */
exports.getDailyStats = async (req, res) => {
  try {
    // If not provided, default to last 7 days.
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 7));
    const end = endDate ? new Date(endDate) : new Date();
    const userId = req.user._id;

    // Using daily date format "%Y-%m-%d"
    const memMap = await aggregateByDate(MemorizationSession, userId, start, end, "%Y-%m-%d");
    const revisionMap = await aggregateByDate(RevisionSession, userId, start, end, "%Y-%m-%d");
    const murajaahMap = await aggregateByDate(MurajaahSession, userId, start, end, "%Y-%m-%d");

    const datesSet = new Set([
      ...Object.keys(memMap),
      ...Object.keys(revisionMap),
      ...Object.keys(murajaahMap)
    ]);

    const dailyStats = [];
    datesSet.forEach(date => {
      const ziyadah = memMap[date] || 0;
      const revision = revisionMap[date] || 0;
      const murajaah = murajaahMap[date] || 0;
      dailyStats.push({
        date,
        ziyadah,
        revision,
        murajaah,
        total: ziyadah + revision + murajaah
      });
    });

    // Sort by date (ascending)
    dailyStats.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ dailyStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /stats/monthly-breakdown?startDate=[ISO]&endDate=[ISO]
 *
 * Returns monthly aggregated statistics (grouped by month in "YYYY-MM") for a given date range.
 * If not provided, defaults to the last 3 months.
 */
exports.getMonthlyStats = async (req, res) => {
  try {
    // If not provided, default to the last 3 months.
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const end = endDate ? new Date(endDate) : new Date();
    const userId = req.user._id;

    // Using monthly date format "%Y-%m"
    const memMap = await aggregateByDate(MemorizationSession, userId, start, end, "%Y-%m");
    const revisionMap = await aggregateByDate(RevisionSession, userId, start, end, "%Y-%m");
    const murajaahMap = await aggregateByDate(MurajaahSession, userId, start, end, "%Y-%m");

    const monthsSet = new Set([
      ...Object.keys(memMap),
      ...Object.keys(revisionMap),
      ...Object.keys(murajaahMap)
    ]);

    const monthlyStats = [];
    monthsSet.forEach(month => {
      const ziyadah = memMap[month] || 0;
      const revision = revisionMap[month] || 0;
      const murajaah = murajaahMap[month] || 0;
      monthlyStats.push({
        month,
        ziyadah,
        revision,
        murajaah,
        total: ziyadah + revision + murajaah
      });
    });

    // Sort by month (ascending)
    monthlyStats.sort((a, b) => new Date(a.month) - new Date(b.month));

    res.json({ monthlyStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Helper function that aggregates sessions by week using ISO week numbers.
 * Groups records by {isoWeekYear, isoWeek} and projects a string in the format "YYYY-W<week>".
 */
async function aggregateByWeek(Model, userId, start, end) {
  const result = await Model.aggregate([
    {
      $match: {
        user: userId,
        completed: true,
        startTime: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: {
          isoWeekYear: { $isoWeekYear: "$startTime" },
          isoWeek: { $isoWeek: "$startTime" }
        },
        totalMinutes: { $sum: "$duration" }
      }
    },
    {
      $project: {
        week: {
          $concat: [
            { $toString: "$_id.isoWeekYear" },
            "-W",
            { $toString: "$_id.isoWeek" }
          ]
        },
        totalMinutes: 1,
        _id: 0
      }
    }
  ]);

  const map = {};
  result.forEach(item => {
    map[item.week] = item.totalMinutes;
  });
  return map;
}

/**
 * GET /stats/weekly-breakdown?startDate=[ISO]&endDate=[ISO]
 *
 * Returns weekly aggregated statistics (grouped by ISO week as "YYYY-W<week>") for a given date range.
 * If not provided, defaults to the last 4 weeks.
 */
exports.getWeeklyStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 28));
    const end = endDate ? new Date(endDate) : new Date();
    const userId = req.user._id;

    const memMap = await aggregateByWeek(MemorizationSession, userId, start, end);
    const revisionMap = await aggregateByWeek(RevisionSession, userId, start, end);
    const murajaahMap = await aggregateByWeek(MurajaahSession, userId, start, end);

    const weeksSet = new Set([
      ...Object.keys(memMap),
      ...Object.keys(revisionMap),
      ...Object.keys(murajaahMap)
    ]);

    const weeklyStats = [];
    weeksSet.forEach(week => {
      const ziyadah = memMap[week] || 0;
      const revision = revisionMap[week] || 0;
      const murajaah = murajaahMap[week] || 0;
      weeklyStats.push({
        week,
        ziyadah,
        revision,
        murajaah,
        total: ziyadah + revision + murajaah
      });
    });

    // Sort by week (ascending)
    weeklyStats.sort((a, b) => a.week.localeCompare(b.week));

    res.json({ weeklyStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 