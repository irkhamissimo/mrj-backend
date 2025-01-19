const express = require('express');
const router = express.Router();
const memorizedController = require('../controllers/memorizedController');
const auth = require('../middleware/auth');

router.post('/surah', auth, memorizedController.addMemorizedSurah);
router.post('/juz', auth, memorizedController.addMemorizedJuz);
router.get('/', auth, memorizedController.getAllMemorized);
router.put('/update-verses/:surahNumber', auth, memorizedController.updateMemorizedSurahVerses);

module.exports = router; 