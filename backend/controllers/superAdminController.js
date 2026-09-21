const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiResponse = require('../utils/apiResponse');
const { Tenant, User, WabaAccount, Message, Template, AuditLog, Conversation } = require('../models/zindex');

const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalTenants,
      activeTenants,
      signupsThisWeek,
      messagesToday,
      failedMessagesTotal,
      connectedWabas,
      alertsCount
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: 'active' }),
      Tenant.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Message.countDocuments({ createdAt: { $gte: today } }),
      Message.countDocuments({ status: 'failed' }),
      WabaAccount.countDocuments({ status: 'connected' }),
      // Alert: tokens expiring in next 7 days or quality not GREEN
      WabaAccount.countDocuments({
        $or: [
          { tokenExpiresAt: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
          { qualityRating: { $in: ['YELLOW', 'RED'] } },
          { status: 'needs_reconnect' }
        ]
      })
    ]);

    // Onboarding counter: Meta cap of 200 per rolling 7 days (SA-08)
    const rollingOnboardings = signupsThisWeek;
    const metaOnboardingCap = 200;

    return ApiResponse.success(res, 'Super Admin metrics retrieved.', {
      overview: {
        totalTenants,
        activeTenants,
        signupsThisWeek,
        messagesToday,
        failedMessagesTotal,
        connectedWabas,
        alertsCount
      },
      metaCap: {
        currentRolling7Days: rollingOnboardings,
        maxCap: metaOnboardingCap,
        percentageUsed: ((rollingOnboardings / metaOnboardingCap) * 100).toFixed(1),
        warningActive: rollingOnboardings >= 150
      }
    });
  } catch (error) {
    next(error);
  }
};

const listTenants = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tenants, total] = await Promise.all([
      Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Tenant.countDocuments(filter)
    ]);

    // Attach WABA connection summary and primary Admin User
    const tenantIds = tenants.map((t) => t._id);
    const [wabas, adminUsers] = await Promise.all([
      WabaAccount.find({ tenantId: { $in: tenantIds } }),
      User.find({ tenantId: { $in: tenantIds }, role: 'client_admin' }).select('-password')
    ]);

    const wabaMap = {};
    wabas.forEach((w) => {
      wabaMap[w.tenantId.toString()] = w;
    });

    const adminMap = {};
    adminUsers.forEach((u) => {
      adminMap[u.tenantId.toString()] = u;
    });

    const enriched = tenants.map((t) => {
      const obj = t.toObject();
      const w = wabaMap[t._id.toString()];
      obj.waba = w
        ? {
            displayPhoneNumber: w.displayPhoneNumber,
            qualityRating: w.qualityRating,
            messagingLimit: w.messagingLimit,
            status: w.status,
            tokenExpiresAt: w.tokenExpiresAt
          }
        : null;
      obj.adminUser = adminMap[t._id.toString()] || null;
      return obj;
    });

    return ApiResponse.success(res, 'Tenants list retrieved.', {
      tenants: enriched,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

const getTenantDetail = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return ApiResponse.notFound(res, 'Tenant not found.');
    }

    const [waba, users, templateCount, messageCount] = await Promise.all([
      WabaAccount.findOne({ tenantId }),
      User.find({ tenantId }).select('-password'),
      Template.countDocuments({ tenantId }),
      Message.countDocuments({ tenantId })
    ]);

    return ApiResponse.success(res, 'Tenant detailed diagnostics retrieved.', {
      tenant,
      waba,
      users,
      stats: {
        templateCount,
        messageCount
      }
    });
  } catch (error) {
    next(error);
  }
};

const toggleTenantStatus = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return ApiResponse.badRequest(res, 'Invalid status. Must be active or suspended.');
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return ApiResponse.notFound(res, 'Tenant not found.');
    }

    tenant.status = status;
    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: status === 'suspended' ? 'TENANT_SUSPENDED' : 'TENANT_REACTIVATED',
      details: { tenantName: tenant.name },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, `Tenant has been ${status}.`, tenant);
  } catch (error) {
    next(error);
  }
};

const getHealthAlerts = async (req, res, next) => {
  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const alerts = await WabaAccount.find({
      $or: [
        { tokenExpiresAt: { $lte: sevenDaysFromNow } },
        { qualityRating: { $in: ['YELLOW', 'RED'] } },
        { status: { $ne: 'connected' } }
      ]
    }).populate('tenantId', 'name email status');

    return ApiResponse.success(res, 'System health alerts retrieved.', alerts);
  } catch (error) {
    next(error);
  }
};

const listAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments()
    ]);

    return ApiResponse.success(res, 'Audit logs retrieved.', {
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Client Tenant and initial Client Admin user
 */
const createTenant = async (req, res, next) => {
  try {
    const { name, email, adminName, password, phone, plan } = req.body;

    if (!name || !email || !adminName || !password) {
      return ApiResponse.badRequest(res, 'Business name, email, admin full name, and password are required.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return ApiResponse.badRequest(res, 'A user account with this email address already exists.');
    }

    const existingTenant = await Tenant.findOne({ email: normalizedEmail });
    if (existingTenant) {
      return ApiResponse.badRequest(res, 'A business entity with this email address already exists.');
    }

    // 1. Create Tenant
    const tenant = await Tenant.create({
      name: name.trim(),
      email: normalizedEmail,
      plan: plan || 'starter',
      contactPhone: phone ? phone.trim() : '',
      status: 'active'
    });

    // 2. Create initial Client Admin User
    const user = await User.create({
      tenantId: tenant._id,
      name: adminName.trim(),
      email: normalizedEmail,
      password,
      role: 'client_admin',
      phone: phone ? phone.trim() : '',
      status: 'active'
    });

    // 3. Log Audit
    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'TENANT_CREATED_BY_ADMIN',
      details: { tenantName: tenant.name, adminEmail: user.email, plan: tenant.plan },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, 'Client business and administrator account created successfully.', {
      tenant,
      adminUser: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a single-sign-on impersonation token for the primary client_admin of a tenant
 */
const impersonateTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return ApiResponse.notFound(res, 'Client business not found.');
    }

    // Find the active client_admin user for this tenant
    const targetUser = await User.findOne({ tenantId, role: 'client_admin', isActive: true });
    if (!targetUser) {
      return ApiResponse.notFound(res, 'No active client administrator found for this business.');
    }

    // Sign SSO token
    const token = jwt.sign(
      {
        id: targetUser._id,
        role: targetUser.role,
        tenantId: targetUser.tenantId,
        impersonatedBy: req.user._id
      },
      env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Audit log
    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'IMPERSONATION_LOGIN',
      details: {
        targetTenantName: tenant.name,
        targetUserId: targetUser._id,
        targetUserEmail: targetUser.email,
        staffEmail: req.user.email
      },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, `SSO token generated for ${targetUser.name} (${tenant.name}).`, {
      token,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        tenantId: targetUser.tenantId
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        status: tenant.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a single-sign-on impersonation token for any specific client user (admin or agent)
 */
const impersonateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId).populate('tenantId');
    if (!targetUser) {
      return ApiResponse.notFound(res, 'User not found.');
    }

    if (targetUser.role === 'super_admin' || targetUser.role === 'support') {
      return ApiResponse.forbidden(res, 'Cannot impersonate administrative staff members.');
    }

    const token = jwt.sign(
      {
        id: targetUser._id,
        role: targetUser.role,
        tenantId: targetUser.tenantId?._id || targetUser.tenantId,
        impersonatedBy: req.user._id
      },
      env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Audit log
    await AuditLog.create({
      tenantId: targetUser.tenantId?._id,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'IMPERSONATION_LOGIN',
      details: {
        targetUserId: targetUser._id,
        targetUserEmail: targetUser.email,
        staffEmail: req.user.email
      },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, `SSO token generated for ${targetUser.name}.`, {
      token,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        tenantId: targetUser.tenantId?._id || targetUser.tenantId
      },
      tenant: targetUser.tenantId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all client users across all tenants
 */
const listAllUsers = async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const filter = { role: { $in: ['client_admin', 'client_agent'] } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('tenantId', 'name email status plan')
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    return ApiResponse.success(res, 'Client users list retrieved.', {
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  listTenants,
  createTenant,
  impersonateTenant,
  impersonateUser,
  listAllUsers,
  getTenantDetail,
  toggleTenantStatus,
  getHealthAlerts,
  listAuditLogs
};
