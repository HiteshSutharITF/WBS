const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');

router.use(authenticate);
router.use(requireTenant);

router.get('/', chatController.listConversations);
router.get('/:conversationId', chatController.getConversation);
router.put('/:conversationId/assign', chatController.assignAgent);
router.put('/:conversationId/toggle-bot', chatController.toggleBotPause);
router.put('/:conversationId/status', chatController.updateStatus);

module.exports = router;
