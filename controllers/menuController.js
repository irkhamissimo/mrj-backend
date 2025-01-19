const Menu = require('../models/Menu');

// Get all active menu items
exports.getMenuItems = async (req, res) => {
  try {
    const menuItems = await Menu.find({ isActive: true })
      .sort('order')
      .select('title path');
    
    res.json(menuItems);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add new menu item (admin only)
exports.addMenuItem = async (req, res) => {
  try {
    const { title, path, order } = req.body;
    
    const menuItem = await Menu.create({
      title,
      path,
      order: order || 0
    });
    
    res.status(201).json(menuItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update menu item (admin only)
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, path, order, isActive } = req.body;
    
    const menuItem = await Menu.findByIdAndUpdate(
      id,
      { title, path, order, isActive },
      { new: true }
    );
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete menu item (admin only)
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const menuItem = await Menu.findByIdAndDelete(id);
    
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 