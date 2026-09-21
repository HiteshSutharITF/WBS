const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    },
    wamid: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    senderType: {
      type: String,
      enum: ['customer', 'agent', 'bot', 'system'],
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'document', 'audio', 'video', 'interactive', 'template', 'system'],
      default: 'text'
    },
    content: {
      type: String,
      default: ''
    },
    mediaUrl: {
      type: String,
      default: ''
    },
    mediaType: {
      type: String,
      default: ''
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      default: null
    },
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
      index: true
    },
    errorCode: {
      type: String,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
