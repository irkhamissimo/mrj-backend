const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const statsController = require('../controllers/statsController');

/**
 * GET /stats
 * Query parameters:
 *   - period: daily | weekly | monthly (default: daily)
 *   - date: Optional ISO date string to set the reference point (defaults to current date)
 */
router.get('/', auth, statsController.getStats);
router.get('/daily-breakdown', auth, statsController.getDailyStats);
router.get('/weekly-breakdown', auth, statsController.getWeeklyStats);
router.get('/monthly-breakdown', auth, statsController.getMonthlyStats);

module.exports = router; 