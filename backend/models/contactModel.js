const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    bsuid: {
      type: String,
      index: true,
      default: function () {
        return `bsuid_${this.phone || Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    },
    phone: {
      type: String,
      default: '',
      index: true
    },
    name: {
      type: String,
      default: 'Unknown Lead',
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    leadStage: {
      type: String,
      enum: ['new', 'engaged', 'qualified', 'handed_off', 'converted', 'lost'],
      default: 'new',
      index: true
    },
    source: {
      type: String,
      default: 'direct_inbound'
    },
    tags: {
      type: [String],
      default: []
    },
    customFields: {
      type: Map,
      of: String,
      default: {}
    },
    optInStatus: {
      type: Boolean,
      default: true
    },
    optInSource: {
      type: String,
      default: 'inbound_message'
    },
    optInDate: {
      type: Date,
      default: Date.now
    },
    optOutDate: {
      type: Date,
      default: null
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    notes: [
      {
        text: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: { type: String, default: 'Agent' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    followUpDate: {
      type: Date,
      default: null
    },
    lastInboundAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index for tenant + phone lookup
contactSchema.index({ tenantId: 1, phone: 1 });
contactSchema.index({ tenantId: 1, bsuid: 1 });

module.exports = mongoose.model('Contact', contactSchema);
