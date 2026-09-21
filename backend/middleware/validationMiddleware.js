const ApiResponse = require('../utils/apiResponse');

/**
 * Validation Middleware Runner
 * Validates request payload against rule definitions
 * @param {Function} validatorFn - (body) => ({ isValid: boolean, errors: Object, message: string })
 */
const validate = (validatorFn) => {
  return (req, res, next) => {
    if (!validatorFn) return next();
    const result = validatorFn(req.body, req);
    if (!result.isValid) {
      return ApiResponse.badRequest(res, result.message || 'Validation failed', result.errors);
    }
    next();
  };
};

module.exports = {
  validate
};
