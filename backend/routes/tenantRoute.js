const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');

router.use(authenticate);
router.use(requireTenant);

router.get('/profile', tenantController.getTenantProfile);
router.put('/working-hours', authorize('client_admin', 'super_admin'), tenantController.updateWorkingHours);
router.post('/whatsapp/complete', authorize('client_admin', 'super_admin'), tenantController.completeWhatsAppOnboarding);
router.post('/complete', authorize('client_admin', 'super_admin'), tenantController.completeWhatsAppOnboarding);
router.post('/whatsapp/disconnect', authorize('client_admin', 'super_admin'), tenantController.disconnectWhatsApp);

module.exports = router;
