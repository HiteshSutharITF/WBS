/**
 * MERN SOP Mandatory Central Models Exporter
 */
const Tenant = require('./tenantModel');
const User = require('./userModel');
const WabaAccount = require('./wabaAccountModel');
const Contact = require('./contactModel');
const Conversation = require('./conversationModel');
const Message = require('./messageModel');
const Template = require('./templateModel');
const Broadcast = require('./broadcastModel');
const ChatbotRule = require('./chatbotRuleModel');
const AuditLog = require('./auditLogModel');

module.exports = {
  Tenant,
  User,
  WabaAccount,
  Contact,
  Conversation,
  Message,
  Template,
  Broadcast,
  ChatbotRule,
  AuditLog
};
