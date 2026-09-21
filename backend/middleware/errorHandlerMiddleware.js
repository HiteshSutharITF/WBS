const ApiResponse = require('../utils/apiResponse');

const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return ApiResponse.badRequest(res, messages.join(', '), err.errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return ApiResponse.badRequest(res, `A record with this ${field} already exists.`);
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.badRequest(res, 'File size exceeds the 25MB maximum limit.');
    }
    return ApiResponse.badRequest(res, `File upload error: ${err.message}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid authentication token.');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Authentication token has expired. Please login again.');
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server encountered an issue processing your request.';

  return ApiResponse.error(res, message, statusCode);
};

module.exports = errorHandler;
