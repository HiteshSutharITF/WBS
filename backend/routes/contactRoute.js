const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireTenant } = require('../middleware/tenantMiddleware');
const { uploadImport } = require('../middleware/uploadMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { validateContactCreate, validateNoteCreate } = require('../validations/contactValidation');

router.use(authenticate);
router.use(requireTenant);

router.get('/', contactController.listContacts);
router.get('/:contactId', contactController.getContactById);
router.post('/', validate(validateContactCreate), contactController.createContact);
router.put('/:contactId', contactController.updateContact);
router.put('/:contactId/stage', contactController.updateLeadStage);
router.post('/:contactId/notes', validate(validateNoteCreate), contactController.addNote);
router.post('/import-csv', uploadImport.single('file'), contactController.importContacts);

module.exports = router;
