const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    metaTemplateId: {
      type: String,
      default: null,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Template name must contain only lowercase letters, numbers, and underscores']
    },
    category: {
      type: String,
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
      required: true
    },
    language: {
      type: String,
      default: 'en_US'
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
      default: 'PENDING',
      index: true
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    header: {
      format: {
        type: String,
        enum: ['NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'],
        default: 'NONE'
      },
      text: { type: String, default: '' },
      mediaUrl: { type: String, default: '' }
    },
    body: {
      text: {
        type: String,
        required: [true, 'Template body text is required']
      },
      sampleVariables: {
        type: [String],
        default: []
      }
    },
    footer: {
      text: { type: String, default: '' }
    },
    buttons: [
      {
        type: {
          type: String,
          enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
          required: true
        },
        text: { type: String, required: true },
        value: { type: String, default: '' }
      }
    ]
  },
  { timestamps: true }
);

templateSchema.index({ tenantId: 1, name: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('Template', templateSchema);
