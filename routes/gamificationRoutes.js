const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const auth = require('../middleware/auth');

router.get('/me', auth, gamificationController.getMyStats);
router.get('/leaderboard', auth, gamificationController.getLeaderboard);

module.exports = router;
