const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiResponse = require('../utils/apiResponse');
const { User } = require('../models/zindex');

const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return ApiResponse.unauthorized(res, 'Authentication required. Please login.');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return ApiResponse.unauthorized(res, 'User session invalid or deactivated.');
    }

    req.user = user;
    next();
  } catch (error) {
    return ApiResponse.unauthorized(res, 'Invalid or expired session token.');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required.');
    }
    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, `Role '${req.user.role}' is not authorized to access this resource.`);
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
