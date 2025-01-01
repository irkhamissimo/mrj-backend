const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user with the decoded id
    const user = await User.findById(decoded.id)
      .select('-password'); // Exclude password from the result
    
    if (!user) {
      throw new Error('User not found');
    }

    // Add user to request object
    req.user = user;
    next();
    
  } catch (error) {
    res.status(401).json({ 
      error: 'Please authenticate',
      details: error.message 
    });
  }
};

module.exports = auth;
