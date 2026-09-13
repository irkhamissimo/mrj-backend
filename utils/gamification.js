const User = require('../models/User');

const POINTS_PER_MINUTE = {
  memorization: 2,
  revision: 1.5,
  murajaah: 1,
};

// Awarded for the first completed activity of the day.
const DAILY_LOGGING_BONUS = 5;

// A day only counts as "logged" if the first activity lasts at least this long.
const MIN_LOGGING_DURATION = 10;

// Streak milestone bonuses. Every +30 days after 90 awards 250.
const STREAK_MILESTONES = {
  7: 20,
  14: 40,
  21: 60,
  30: 100,
  60: 250,
  90: 500,
};

const LEVELS = [
  { minPoints: 0, title: 'Pemula' },
  { minPoints: 50, title: 'Semangat' },
  { minPoints: 200, title: 'Rajin' },
  { minPoints: 500, title: 'Tekun' },
  { minPoints: 1000, title: 'Hafidz Pemula' },
  { minPoints: 2000, title: 'Hafidz Menengah' },
  { minPoints: 5000, title: 'Hafidz Mahir' },
  { minPoints: 10000, title: 'Hafidz Sejati' },
];

function calculatePoints(type, durationMinutes) {
  const rate = POINTS_PER_MINUTE[type] || 0;
  return Math.round(durationMinutes * rate);
}

function getStreakMilestoneBonus(streak) {
  if (STREAK_MILESTONES[streak]) return STREAK_MILESTONES[streak];
  if (streak > 90 && (streak - 90) % 30 === 0) return 250;
  return 0;
}

function getLevelInfo(totalPoints) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalPoints >= LEVELS[i].minPoints) {
      return { level: i, title: LEVELS[i].title };
    }
  }
  return { level: 0, title: 'Pemula' };
}

// Get the calendar day (YYYY-MM-DD) for a Date in the given timezone
function getDayKey(date, timeZone = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function updateUserStreak(user) {
  const today = new Date();
  const todayKey = getDayKey(today);

  let isNewDay = true;
  let streakBonus = 0;

  if (!user.lastActiveDate) {
    user.streak = 1;
  } else {
    const lastKey = getDayKey(new Date(user.lastActiveDate));
    const diffMs =
      Date.parse(todayKey + 'T00:00:00Z') - Date.parse(lastKey + 'T00:00:00Z');
    const dayDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      isNewDay = false; // Already active today
    } else if (dayDiff === 1) {
      user.streak += 1;
      streakBonus = getStreakMilestoneBonus(user.streak);
    } else {
      // Streak broken, reset
      user.streak = 1;
    }
  }

  user.lastActiveDate = today;
  return { isNewDay, streakBonus };
}

async function awardPoints(userId, type, durationMinutes) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const points = calculatePoints(type, durationMinutes);
    const { isNewDay, streakBonus } = updateUserStreak(user);

    let bonus = streakBonus;
    if (isNewDay && durationMinutes >= MIN_LOGGING_DURATION) {
      bonus += DAILY_LOGGING_BONUS;
    }

    user.totalPoints += points + bonus;

    const { level, title } = getLevelInfo(user.totalPoints);
    user.level = level;

    await user.save();
  } catch (err) {
    console.error('Failed to award points:', err.message);
  }
}

module.exports = {
  POINTS_PER_MINUTE,
  DAILY_LOGGING_BONUS,
  MIN_LOGGING_DURATION,
  STREAK_MILESTONES,
  LEVELS,
  calculatePoints,
  getStreakMilestoneBonus,
  getLevelInfo,
  updateUserStreak,
  awardPoints,
};
