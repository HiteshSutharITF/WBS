const ApiResponse = require('../utils/apiResponse');
const { Tenant } = require('../models/zindex');

const requireTenant = async (req, res, next) => {
  try {
    // Super admins might provide tenantId via query or header if impersonating with permission
    if (['super_admin', 'support'].includes(req.user.role)) {
      const explicitTenant = req.headers['x-tenant-id'] || req.query.tenantId;
      if (explicitTenant) {
        req.tenantId = explicitTenant;
        return next();
      }
      return ApiResponse.badRequest(res, 'Tenant context required for this operation.');
    }

    if (!req.user.tenantId) {
      return ApiResponse.forbidden(res, 'No tenant associated with this user account.');
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return ApiResponse.notFound(res, 'Associated business tenant not found.');
    }

    if (tenant.status === 'suspended') {
      return ApiResponse.forbidden(res, 'Your business account is suspended. Please contact support.');
    }

    req.tenant = tenant;
    req.tenantId = tenant._id;
    next();
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

module.exports = {
  requireTenant
};
