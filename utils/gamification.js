const User = require('../models/User');

const POINTS_PER_MINUTE = {
  memorization: 2,
  revision: 1.5,
  murajaah: 1,
};

const STREAK_BONUS = 10;

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

function getLevelInfo(totalPoints) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalPoints >= LEVELS[i].minPoints) {
      return { level: i, title: LEVELS[i].title };
    }
  }
  return { level: 0, title: 'Pemula' };
}

function updateUserStreak(user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!user.lastActiveDate) {
    user.streak = 1;
  } else {
    const lastDate = new Date(user.lastActiveDate);
    lastDate.setHours(0, 0, 0, 0);
    const dayDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      return; // Already active today, don't change streak
    } else if (dayDiff === 1) {
      user.streak += 1;
      // Award bonus every 7 days
      if (user.streak > 0 && user.streak % 7 === 0) {
        user.totalPoints += STREAK_BONUS;
      }
    } else {
      // Streak broken, reset
      user.streak = 1;
    }
  }

  user.lastActiveDate = today;
}

async function awardPoints(userId, type, durationMinutes) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const points = calculatePoints(type, durationMinutes);
    updateUserStreak(user);
    user.totalPoints += points;

    const { level, title } = getLevelInfo(user.totalPoints);
    user.level = level;

    await user.save();
  } catch (err) {
    console.error('Failed to award points:', err.message);
  }
}

module.exports = {
  POINTS_PER_MINUTE,
  STREAK_BONUS,
  LEVELS,
  calculatePoints,
  getLevelInfo,
  updateUserStreak,
  awardPoints,
};
