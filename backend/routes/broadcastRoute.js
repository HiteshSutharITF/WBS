const express = require('express');
const router = express.Router();
const broadcastController = require('../controllers/broadcastController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { validateBroadcastCreate } = require('../validations/broadcastValidation');

router.use(authenticate);
router.use(requireTenant);

router.get('/', broadcastController.listBroadcasts);
router.post('/', authorize('client_admin', 'super_admin'), validate(validateBroadcastCreate), broadcastController.createBroadcast);
router.post('/:broadcastId/start', authorize('client_admin', 'super_admin'), broadcastController.startBroadcast);
router.get('/:broadcastId/report', broadcastController.getBroadcastReport);

module.exports = router;
