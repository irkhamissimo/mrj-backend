const express = require('express');
const router = express.Router();
const surahController = require('../controllers/surahController');

router.get('/', surahController.getAllSurahs);
router.get('/:surahNumber', surahController.getSurahDetails);

module.exports = router; 