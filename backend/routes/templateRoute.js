const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { validateTemplateCreate } = require('../validations/templateValidation');

router.use(authenticate);
router.use(requireTenant);

router.get('/', templateController.listTemplates);
router.post('/', authorize('client_admin', 'super_admin'), validate(validateTemplateCreate), templateController.createTemplate);
router.post('/sync', authorize('client_admin', 'super_admin'), templateController.syncTemplates);
router.delete('/:templateId', authorize('client_admin', 'super_admin'), templateController.deleteTemplate);

module.exports = router;
