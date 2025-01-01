const express = require('express');
const router = express.Router();
const memorizationController = require('../controllers/memorizationController');
const auth = require('../middleware/auth');

router.post('/start', auth, memorizationController.startMemorization);
router.post('/:entryId/sessions', auth, memorizationController.startNewSession);
router.put('/sessions/:sessionId/complete', auth, memorizationController.completeSession);
router.put('/:entryId/finish', auth, memorizationController.finishMemorization);
router.get('/:entryId/progress', auth, memorizationController.getMemorizationProgress);
router.put('/sessions/:sessionId/pause', auth, memorizationController.togglePauseSession);
router.get('/sessions/:sessionId/status', auth, memorizationController.checkSessionStatus);

module.exports = router; 