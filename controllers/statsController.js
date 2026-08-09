const MemorizationSession = require('../models/MemorizationSession');
const MurajaahSession = require('../models/MurajaahSession');
const RevisionSession = require('../models/RevisionSession');

// Get the calendar day (YYYY-MM-DD) for a Date in the given timezone
function getDayKey(date, timeZone = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Get the start of the current day (as a Date) in the given timezone
function getStartOfDay(timeZone = 'Asia/Jakarta') {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dateFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === 'year').value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month').value, 10);
  const day = parseInt(parts.find((p) => p.type === 'day').value, 10);

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
  const offsetMinutes =
    sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));

  return new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  );
}

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
 * Helper function that aggregates sessions by day, in the Asia/Jakarta timezone.
 * Returns a map of "YYYY-MM-DD" -> total minutes.
 */
async function aggregateByDay(Model, userId, start, end) {
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
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime", timezone: "Asia/Jakarta" } },
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
    // Default to the last 7 full days in the Asia/Jakarta timezone.
    const { startDate, endDate } = req.query;
    const end = endDate
      ? new Date(endDate)
      : new Date(getStartOfDay().getTime() + 24 * 60 * 60 * 1000); // start of tomorrow (Jakarta)
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const userId = req.user._id;

    const memMap = await aggregateByDay(MemorizationSession, userId, start, end);
    const revisionMap = await aggregateByDay(RevisionSession, userId, start, end);
    const murajaahMap = await aggregateByDay(MurajaahSession, userId, start, end);

    // Fill in all days in the range so the chart shows a complete 7-day window
    const dailyStats = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const date = getDayKey(dayStart);
      dailyStats.push({
        date,
        ziyadah: memMap[date] || 0,
        revision: revisionMap[date] || 0,
        murajaah: murajaahMap[date] || 0,
        total:
          (memMap[date] || 0) + (revisionMap[date] || 0) + (murajaahMap[date] || 0)
      });
    }

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

    // Aggregate by Jakarta day, then collapse into "YYYY-MM" keys
    const memMap = await aggregateByDay(MemorizationSession, userId, start, end);
    const revisionMap = await aggregateByDay(RevisionSession, userId, start, end);
    const murajaahMap = await aggregateByDay(MurajaahSession, userId, start, end);

    const byMonth = (map) => {
      const out = {};
      Object.entries(map).forEach(([day, mins]) => {
        const month = day.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
        out[month] = (out[month] || 0) + mins;
      });
      return out;
    };

    const memMonthMap = byMonth(memMap);
    const revisionMonthMap = byMonth(revisionMap);
    const murajaahMonthMap = byMonth(murajaahMap);

    const monthsSet = new Set([
      ...Object.keys(memMonthMap),
      ...Object.keys(revisionMonthMap),
      ...Object.keys(murajaahMonthMap)
    ]);

    const monthlyStats = [];
    monthsSet.forEach(month => {
      const ziyadah = memMonthMap[month] || 0;
      const revision = revisionMonthMap[month] || 0;
      const murajaah = murajaahMonthMap[month] || 0;
      monthlyStats.push({
        month,
        ziyadah,
        revision,
        murajaah,
        total: ziyadah + revision + murajaah
      });
    });

    // Sort by month (ascending)
    monthlyStats.sort((a, b) => a.month.localeCompare(b.month));

    res.json({ monthlyStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Helper function that aggregates sessions by ISO week.
 * Groups by Jakarta day first, then collapses into ISO week numbers so late-evening
 * sessions count toward the correct week.
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
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime", timezone: "Asia/Jakarta" } },
        totalMinutes: { $sum: "$duration" }
      }
    }
  ]);

  const map = {};
  result.forEach(item => {
    const [year, month, day] = item._id.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // ISO week of the Jakarta calendar day
    const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const dayNum = (new Date(utc).getUTCDay() + 6) % 7; // Monday = 0
    const weekStart = new Date(utc - dayNum * 86400000);
    const weekYear = weekStart.getUTCFullYear();
    const jan1 = new Date(Date.UTC(weekYear, 0, 1));
    const weekNumber = Math.ceil(((weekStart - jan1) / 86400000 + 1) / 7);
    const weekKey = `${weekYear}-W${weekNumber}`;
    map[weekKey] = (map[weekKey] || 0) + item.totalMinutes;
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