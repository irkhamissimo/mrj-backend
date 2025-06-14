const express = require('express');
const router = express.Router();
const memorizationController = require('../controllers/memorizationController');
const auth = require('../middleware/auth');

router.post('/start', auth, memorizationController.startMemorization);
router.post('/:entryId/sessions', auth, memorizationController.startNewSession);
router.put('/:entryId/finish', auth, memorizationController.finishMemorization);
router.get('/:entryId/progress', auth, memorizationController.getMemorizationProgress);
router.put('/sessions/:sessionId/pause', auth, memorizationController.togglePauseSession);
router.get('/sessions/:sessionId/status', auth, memorizationController.checkSessionStatus);
router.get('/:entryId/completed', auth, memorizationController.getCompletedMemorization);
router.get('/completedMemorizations', auth, memorizationController.getMemorizationByDateStarted);
// Revision routes
router.post('/:entryId/revisions', auth, memorizationController.startRevisionSession);
router.put('/revisions/:sessionId/complete', auth, memorizationController.completeRevisionSession);
router.put('/revisions/:sessionId/pause', auth, memorizationController.toggleRevisionPause);
router.get('/:entryId/revisions', auth, memorizationController.getRevisionSessions);
router.get('/revisions/:sessionId/status', auth, memorizationController.checkRevisionStatus);
router.get('/countCompletedMemorizations', auth, memorizationController.countCompletedMemorization);
router.get('/completed', auth, memorizationController.getCompletedMemorization);

module.exports = router; 