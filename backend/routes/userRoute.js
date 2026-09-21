const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');

router.use(authenticate);
router.use(requireTenant);

router.get('/', userController.listTeamMembers);
router.post('/invite', authorize('client_admin', 'super_admin'), userController.inviteTeamMember);
router.put('/:userId/toggle-status', authorize('client_admin', 'super_admin'), userController.toggleUserStatus);

module.exports = router;
