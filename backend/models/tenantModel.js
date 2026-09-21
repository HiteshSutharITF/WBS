const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Business email is required'],
      unique: true,
      trim: true,
      lowercase: true
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'needs_reconnect'],
      default: 'active'
    },
    plan: {
      type: String,
      default: 'Growth'
    },
    workingHours: {
      enabled: { type: Boolean, default: true },
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      days: { type: [Number], default: [1, 2, 3, 4, 5, 6] } // Monday to Saturday
    },
    limits: {
      maxUsers: { type: Number, default: 10 },
      maxContacts: { type: Number, default: 10000 },
      maxBroadcastsMonth: { type: Number, default: 50 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);
