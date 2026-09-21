const ApiResponse = require('../utils/apiResponse');
const { ChatbotRule, AuditLog } = require('../models/zindex');

const listRules = async (req, res, next) => {
  try {
    const rules = await ChatbotRule.find({ tenantId: req.tenantId })
      .populate('templateId', 'name category')
      .populate('actions.assignAgentId', 'name email')
      .sort({ priority: -1, createdAt: -1 });

    return ApiResponse.success(res, 'Chatbot rules retrieved successfully.', rules);
  } catch (error) {
    next(error);
  }
};

const createRule = async (req, res, next) => {
  try {
    const {
      name,
      triggerType,
      matchType,
      keywords,
      responseType,
      responseText,
      templateId,
      actions,
      priority
    } = req.body;

    const rule = await ChatbotRule.create({
      tenantId: req.tenantId,
      name: name.trim(),
      triggerType: triggerType || 'keyword',
      matchType: matchType || 'contains',
      keywords: Array.isArray(keywords) ? keywords.map((k) => k.toLowerCase().trim()) : [],
      responseType: responseType || 'text',
      responseText: responseText || '',
      templateId: templateId || null,
      actions: actions || {},
      priority: priority || 0
    });

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'CHATBOT_RULE_CREATED',
      details: { ruleId: rule._id, name: rule.name, triggerType: rule.triggerType },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, 'Chatbot automation rule created successfully.', rule, 201);
  } catch (error) {
    next(error);
  }
};

const updateRule = async (req, res, next) => {
  try {
    const { ruleId } = req.params;
    const {
      name,
      triggerType,
      matchType,
      keywords,
      responseType,
      responseText,
      templateId,
      actions,
      isActive,
      priority
    } = req.body;

    const rule = await ChatbotRule.findOne({ _id: ruleId, tenantId: req.tenantId });
    if (!rule) {
      return ApiResponse.notFound(res, 'Rule not found.');
    }

    if (name) rule.name = name.trim();
    if (triggerType) rule.triggerType = triggerType;
    if (matchType) rule.matchType = matchType;
    if (keywords) rule.keywords = keywords.map((k) => k.toLowerCase().trim());
    if (responseType) rule.responseType = responseType;
    if (responseText !== undefined) rule.responseText = responseText;
    if (templateId !== undefined) rule.templateId = templateId || null;
    if (actions) rule.actions = actions;
    if (isActive !== undefined) rule.isActive = isActive;
    if (priority !== undefined) rule.priority = priority;

    await rule.save();

    return ApiResponse.success(res, 'Chatbot rule updated successfully.', rule);
  } catch (error) {
    next(error);
  }
};

const deleteRule = async (req, res, next) => {
  try {
    const { ruleId } = req.params;
    const rule = await ChatbotRule.findOneAndDelete({ _id: ruleId, tenantId: req.tenantId });

    if (!rule) {
      return ApiResponse.notFound(res, 'Rule not found.');
    }

    return ApiResponse.success(res, 'Chatbot rule deleted successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listRules,
  createRule,
  updateRule,
  deleteRule
};
