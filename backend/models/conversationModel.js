const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved'],
      default: 'open',
      index: true
    },
    isBotPaused: {
      type: Boolean,
      default: false
    },
    handedOffAt: {
      type: Date,
      default: null
    },
    lastMessageText: {
      type: String,
      default: ''
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastCustomerMessageAt: {
      type: Date,
      default: Date.now
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    labels: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

conversationSchema.index({ tenantId: 1, contactId: 1 }, { unique: true });
conversationSchema.index({ tenantId: 1, status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
