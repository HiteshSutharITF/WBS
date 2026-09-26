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
    /** WhatsApp quote/reply — only set when this message is a reply */
    replyTo: {
      type: {
        messageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Message'
        },
        wamid: { type: String },
        content: { type: String },
        messageType: { type: String },
        mediaUrl: { type: String },
        direction: { type: String },
        senderType: { type: String },
        senderName: { type: String }
      },
      default: undefined
    },
    /** Soft-delete: hide from specific agents (Delete for me) */
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    /** Soft-delete for all agents + show "This message was deleted" */
    deletedForEveryone: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    /** WhatsApp-style emoji reactions */
    reactions: [
      {
        emoji: { type: String, required: true },
        actorType: {
          type: String,
          enum: ['agent', 'customer', 'bot'],
          default: 'agent'
        },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        reactedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
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
