const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const { uploadMedia } = require('../middleware/uploadMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { validateTextMessage, validateTemplateMessage } = require('../validations/messageValidation');

router.use(authenticate);
router.use(requireTenant);

router.post('/text', validate(validateTextMessage), messageController.sendTextMessage);
router.post('/media', uploadMedia.single('file'), messageController.sendMediaMessage);
router.post('/template', validate(validateTemplateMessage), messageController.sendTemplateMessage);
router.post('/upload', uploadMedia.single('file'), messageController.uploadMediaAsset);
router.post('/:messageId/react', messageController.reactToMessage);
router.post('/:messageId/delete', messageController.deleteMessage);

module.exports = router;
