const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { validateChatbotRule } = require('../validations/chatbotValidation');

router.use(authenticate);
router.use(requireTenant);

router.get('/', chatbotController.listRules);
router.post('/', authorize('client_admin', 'super_admin'), validate(validateChatbotRule), chatbotController.createRule);
router.put('/:ruleId', authorize('client_admin', 'super_admin'), chatbotController.updateRule);
router.delete('/:ruleId', authorize('client_admin', 'super_admin'), chatbotController.deleteRule);

module.exports = router;
