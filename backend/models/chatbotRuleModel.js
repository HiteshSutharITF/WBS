const mongoose = require('mongoose');

const chatbotRuleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true
    },
    triggerType: {
      type: String,
      enum: ['keyword', 'welcome', 'away', 'intent_quote', 'intent_support', 'hand_off'],
      default: 'keyword'
    },
    matchType: {
      type: String,
      enum: ['exact', 'contains', 'starts_with', 'any'],
      default: 'contains'
    },
    keywords: {
      type: [String],
      default: []
    },
    responseType: {
      type: String,
      enum: ['text', 'template', 'hand_off'],
      default: 'text'
    },
    responseText: {
      type: String,
      default: ''
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      default: null
    },
    actions: {
      addTag: { type: String, default: '' },
      updateLeadStage: { type: String, default: '' },
      assignAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      pauseBot: { type: Boolean, default: false }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatbotRule', chatbotRuleSchema);
