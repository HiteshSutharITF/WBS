const express = require('express');
const router = express.Router();

const authRoute = require('./authRoute');
const tenantRoute = require('./tenantRoute');
const userRoute = require('./userRoute');
const contactRoute = require('./contactRoute');
const chatRoute = require('./chatRoute');
const messageRoute = require('./messageRoute');
const templateRoute = require('./templateRoute');
const broadcastRoute = require('./broadcastRoute');
const chatbotRoute = require('./chatbotRoute');
const webhookRoute = require('./webhookRoute');
const superAdminRoute = require('./superAdminRoute');

router.use('/auth', authRoute);
router.use('/tenant', tenantRoute);
router.use('/onboarding', tenantRoute);
router.use('/users', userRoute);
router.use('/contacts', contactRoute);
router.use('/chats', chatRoute);
router.use('/messages', messageRoute);
router.use('/templates', templateRoute);
router.use('/broadcasts', broadcastRoute);
router.use('/chatbot', chatbotRoute);
router.use('/webhook', webhookRoute);
router.use('/superadmin', superAdminRoute);

module.exports = router;
