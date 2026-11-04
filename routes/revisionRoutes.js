const express = require('express');
const router = express.Router();
const revisionController = require('../controllers/revisionController');
const auth = require('../middleware/auth');

// Get memorized content
router.get('/by-surah', auth, revisionController.getVerifiedBySurah);
router.get('/by-juz', auth, revisionController.getVerifiedByJuz);

// Murajaah session management
router.post('/start', auth, revisionController.startRevision);
router.get('/due', auth, revisionController.getDueReviews);
router.get('/feedback/pending', auth, revisionController.getPendingFeedback);
router.post('/:sessionId/feedback', auth, revisionController.submitFeedback);
router.put('/:sessionId/pause', auth, revisionController.pauseRevision);
router.get('/:sessionId/status', auth, revisionController.checkSessionStatus);
router.get('/current', auth, revisionController.getCurrentRevision);
router.get('/memorized', auth, revisionController.getMemorizedContent);
router.get('/sessions', auth, revisionController.countMurajaahSessions);
module.exports = router; 
