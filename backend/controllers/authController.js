const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiResponse = require('../utils/apiResponse');
const { Tenant, User, AuditLog } = require('../models/zindex');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, tenantId: user.tenantId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

const register = async (req, res, next) => {
  try {
    return ApiResponse.forbidden(
      res,
      'Direct public registration is disabled. Client business accounts must be provisioned by ITFuturz Administrator.'
    );
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).populate('tenantId');
    if (!user) {
      return ApiResponse.unauthorized(res, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return ApiResponse.forbidden(res, 'Your user account has been deactivated. Contact your administrator.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return ApiResponse.unauthorized(res, 'Invalid email or password.');
    }

    if (user.tenantId && user.tenantId.status === 'suspended') {
      return ApiResponse.forbidden(res, 'This business account is currently suspended. Please contact ITFuturz support.');
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return ApiResponse.success(res, 'Login successful.', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId?._id || null
      },
      tenant: user.tenantId
        ? {
            id: user.tenantId._id,
            name: user.tenantId.name,
            email: user.tenantId.email,
            status: user.tenantId.status
          }
        : null
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('tenantId').select('-password');
    return ApiResponse.success(res, 'Profile retrieved successfully.', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId?._id || null
      },
      tenant: user.tenantId || null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};
