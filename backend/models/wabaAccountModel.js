const mongoose = require('mongoose');

const wabaAccountSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true
    },
    wabaId: {
      type: String,
      required: true,
      index: true
    },
    phoneNumberId: {
      type: String,
      required: true,
      index: true
    },
    displayPhoneNumber: {
      type: String,
      default: ''
    },
    verifiedName: {
      type: String,
      default: ''
    },
    businessId: {
      type: String,
      default: ''
    },
    encryptedToken: {
      type: String,
      required: true
    },
    encryptedPin: {
      type: String,
      default: ''
    },
    tokenExpiresAt: {
      type: Date,
      index: true
    },
    qualityRating: {
      type: String,
      enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'],
      default: 'GREEN'
    },
    messagingLimit: {
      type: String,
      default: 'TIER_250'
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'needs_reconnect'],
      default: 'connected'
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WabaAccount', wabaAccountSchema);
