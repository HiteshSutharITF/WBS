const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validationMiddleware');
const { validateRegister, validateLogin } = require('../validations/authValidation');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', validate(validateRegister), authController.register);
router.post('/login', validate(validateLogin), authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
