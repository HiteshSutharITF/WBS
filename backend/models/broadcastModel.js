const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Broadcast name is required'],
      trim: true
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: true
    },
    targetSegment: {
      tags: { type: [String], default: [] },
      leadStage: { type: String, default: 'all' },
      allOptedIn: { type: Boolean, default: true }
    },
    variableMapping: {
      type: Map,
      of: String,
      default: {}
    },
    headerMediaUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'draft',
      index: true
    },
    scheduledAt: {
      type: Date,
      default: null
    },
    totalRecipients: {
      type: Number,
      default: 0
    },
    sentCount: {
      type: Number,
      default: 0
    },
    deliveredCount: {
      type: Number,
      default: 0
    },
    readCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    recipients: [
      {
        contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
        phone: String,
        status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
        wamid: String,
        error: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Broadcast', broadcastSchema);
