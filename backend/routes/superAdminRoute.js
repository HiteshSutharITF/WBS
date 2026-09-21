const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);
router.use(authorize('super_admin', 'support'));

router.get('/dashboard', superAdminController.getDashboardStats);
router.get('/tenants', superAdminController.listTenants);
router.post('/tenants', authorize('super_admin'), superAdminController.createTenant);
router.get('/tenants/:tenantId', superAdminController.getTenantDetail);
router.put('/tenants/:tenantId/status', authorize('super_admin'), superAdminController.toggleTenantStatus);
router.post('/tenants/:tenantId/impersonate', authorize('super_admin', 'support'), superAdminController.impersonateTenant);

router.get('/users', superAdminController.listAllUsers);
router.post('/users/:userId/impersonate', authorize('super_admin', 'support'), superAdminController.impersonateUser);

router.get('/health-alerts', superAdminController.getHealthAlerts);
router.get('/audit-logs', superAdminController.listAuditLogs);

module.exports = router;
