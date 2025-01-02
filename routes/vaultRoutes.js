const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vaultController');
const auth = require('../middleware/auth');

router.get('/', auth, vaultController.getVaultEntries);
router.post('/:vaultId/verify', auth, vaultController.verifyAndTransfer);

module.exports = router; 