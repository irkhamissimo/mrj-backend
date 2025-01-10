const express = require('express');
const router = express.Router();
const revisionController = require('../controllers/revisionController');
const auth = require('../middleware/auth');

router.get('/by-surah', auth, revisionController.getVerifiedBySurah);
router.get('/by-juz', auth, revisionController.getVerifiedByJuz);
router.post('/start', auth, revisionController.startRevision);
router.put('/:sessionId/pause', auth, revisionController.pauseRevision);

module.exports = router; 