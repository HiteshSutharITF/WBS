const ApiResponse = require('../utils/apiResponse');
const { User, AuditLog } = require('../models/zindex');

const listTeamMembers = async (req, res, next) => {
  try {
    const users = await User.find({ tenantId: req.tenantId }).select('-password').sort({ createdAt: -1 });
    return ApiResponse.success(res, 'Team members retrieved successfully.', users);
  } catch (error) {
    next(error);
  }
};

const inviteTeamMember = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!['client_admin', 'client_agent'].includes(role)) {
      return ApiResponse.badRequest(res, 'Invalid role. Must be client_admin or client_agent.');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return ApiResponse.badRequest(res, 'User with this email already exists.');
    }

    const newUser = await User.create({
      tenantId: req.tenantId,
      name: name.trim(),
      email: email.toLowerCase(),
      password: password || 'Welcome@123',
      role
    });

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'TEAM_MEMBER_INVITED',
      details: { invitedEmail: newUser.email, role: newUser.role },
      ipAddress: req.ip
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    return ApiResponse.success(res, 'Team member added successfully.', userObj, 201);
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ _id: userId, tenantId: req.tenantId });

    if (!user) {
      return ApiResponse.notFound(res, 'User not found.');
    }

    if (user._id.toString() === req.user._id.toString()) {
      return ApiResponse.badRequest(res, 'You cannot deactivate your own account.');
    }

    user.isActive = !user.isActive;
    await user.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      details: { targetUserId: user._id, targetEmail: user.email },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`, {
      id: user._id,
      isActive: user.isActive
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTeamMembers,
  inviteTeamMember,
  toggleUserStatus
};
