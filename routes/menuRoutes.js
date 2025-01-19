const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', auth, menuController.getMenuItems);

// Admin routes (you might want to add admin middleware)
router.post('/', auth, menuController.addMenuItem);
router.put('/:id', auth, menuController.updateMenuItem);
router.delete('/:id', auth, menuController.deleteMenuItem);

module.exports = router; 