const User = require('../models/User');
const { getLevelInfo } = require('../utils/gamification');

exports.getMyStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('username streak totalPoints level');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { title } = getLevelInfo(user.totalPoints);

    res.json({
      username: user.username,
      streak: user.streak,
      totalPoints: user.totalPoints,
      level: user.level,
      title,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const users = await User.find()
      .select('username totalPoints level streak')
      .sort({ totalPoints: -1 })
      .limit(20);

    const leaderboard = users.map((u, i) => {
      const { title } = getLevelInfo(u.totalPoints);
      return {
        rank: i + 1,
        username: u.username,
        totalPoints: u.totalPoints,
        level: u.level,
        title,
        streak: u.streak,
      };
    });

    const myRank = leaderboard.findIndex(u => u.username === req.user?.username);

    res.json({
      leaderboard,
      myRank: myRank >= 0 ? myRank + 1 : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
