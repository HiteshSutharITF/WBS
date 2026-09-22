const ApiResponse = require('../utils/apiResponse');
const { Contact, Conversation, Message, AuditLog } = require('../models/zindex');
const fs = require('fs');

const listContacts = async (req, res, next) => {
  try {
    const { search, leadStage, tag, optInStatus, page = 1, limit = 50 } = req.query;
    const filter = { tenantId: req.tenantId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { bsuid: { $regex: search, $options: 'i' } }
      ];
    }

    if (leadStage && leadStage !== 'all') {
      filter.leadStage = leadStage;
    }

    if (tag) {
      filter.tags = tag;
    }

    if (optInStatus !== undefined && optInStatus !== 'all') {
      filter.optInStatus = optInStatus === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .populate('assignedAgentId', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Contact.countDocuments(filter)
    ]);

    return ApiResponse.success(res, 'Contacts retrieved successfully.', {
      contacts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    next(error);
  }
};

const getContactById = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const contact = await Contact.findOne({ _id: contactId, tenantId: req.tenantId })
      .populate('assignedAgentId', 'name email');

    if (!contact) {
      return ApiResponse.notFound(res, 'Contact not found.');
    }

    // Fetch conversation and recent messages
    const conversation = await Conversation.findOne({ contactId: contact._id, tenantId: req.tenantId });
    let messages = [];
    if (conversation) {
      messages = await Message.find({ conversationId: conversation._id, tenantId: req.tenantId })
        .sort({ createdAt: 1 })
        .limit(100);
    }

    return ApiResponse.success(res, 'Contact profile details retrieved.', {
      contact,
      conversation,
      messages
    });
  } catch (error) {
    next(error);
  }
};

const createContact = async (req, res, next) => {
  try {
    const { name, phone, email, leadStage, source, tags, customFields, optInStatus } = req.body;

    // Check if phone or bsuid already exists for this tenant
    if (phone) {
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      const existing = await Contact.findOne({ tenantId: req.tenantId, phone: cleanPhone });
      if (existing) {
        return ApiResponse.badRequest(res, `A contact with phone ${phone} already exists.`);
      }
    }

    const contact = await Contact.create({
      tenantId: req.tenantId,
      name: name ? name.trim() : 'New Lead',
      phone: phone ? phone.replace(/[^\d+]/g, '') : '',
      email: email ? email.trim().toLowerCase() : '',
      leadStage: leadStage || 'new',
      source: source || 'manual_entry',
      tags: Array.isArray(tags) ? tags : [],
      customFields: customFields || {},
      optInStatus: optInStatus !== undefined ? optInStatus : true,
      optInSource: 'manual_admin'
    });

    // Automatically create empty Conversation for this contact (no customer inbound message yet)
    await Conversation.create({
      tenantId: req.tenantId,
      contactId: contact._id,
      status: 'open',
      lastCustomerMessageAt: null,
      lastMessageAt: null,
      lastMessageText: ''
    });

    return ApiResponse.success(res, 'Contact created successfully.', contact, 201);
  } catch (error) {
    next(error);
  }
};

const updateContact = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const { name, phone, email, leadStage, tags, customFields, assignedAgentId, followUpDate } = req.body;

    const contact = await Contact.findOne({ _id: contactId, tenantId: req.tenantId });
    if (!contact) {
      return ApiResponse.notFound(res, 'Contact not found.');
    }

    if (name) contact.name = name.trim();
    if (phone) contact.phone = phone.replace(/[^\d+]/g, '');
    if (email !== undefined) contact.email = email.trim().toLowerCase();
    if (leadStage) contact.leadStage = leadStage;
    if (tags) contact.tags = Array.isArray(tags) ? tags : contact.tags;
    if (customFields) contact.customFields = customFields;
    if (assignedAgentId !== undefined) contact.assignedAgentId = assignedAgentId || null;
    if (followUpDate !== undefined) contact.followUpDate = followUpDate ? new Date(followUpDate) : null;

    await contact.save();

    return ApiResponse.success(res, 'Contact updated successfully.', contact);
  } catch (error) {
    next(error);
  }
};

const updateLeadStage = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const { leadStage } = req.body;

    const allowedStages = ['new', 'engaged', 'qualified', 'handed_off', 'converted', 'lost'];
    if (!allowedStages.includes(leadStage)) {
      return ApiResponse.badRequest(res, `Invalid lead stage. Allowed: ${allowedStages.join(', ')}`);
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, tenantId: req.tenantId },
      { leadStage },
      { new: true }
    );

    if (!contact) {
      return ApiResponse.notFound(res, 'Contact not found.');
    }

    return ApiResponse.success(res, `Lead stage updated to ${leadStage}.`, contact);
  } catch (error) {
    next(error);
  }
};

const addNote = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const { text } = req.body;

    const contact = await Contact.findOne({ _id: contactId, tenantId: req.tenantId });
    if (!contact) {
      return ApiResponse.notFound(res, 'Contact not found.');
    }

    contact.notes.push({
      text: text.trim(),
      createdBy: req.user._id,
      authorName: req.user.name,
      createdAt: new Date()
    });

    await contact.save();

    return ApiResponse.success(res, 'Note added successfully.', contact.notes);
  } catch (error) {
    next(error);
  }
};

const importContacts = async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.badRequest(res, 'Please upload a CSV file.');
    }

    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return ApiResponse.badRequest(res, 'CSV file is empty or missing data rows.');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIndex = headers.findIndex((h) => h.includes('name'));
    const phoneIndex = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('number'));
    const emailIndex = headers.findIndex((h) => h.includes('email'));
    const tagIndex = headers.findIndex((h) => h.includes('tag'));

    if (phoneIndex === -1 && nameIndex === -1) {
      return ApiResponse.badRequest(res, 'CSV must contain at least a "name" or "phone" column header.');
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((c) => c.trim());
      const phone = phoneIndex !== -1 ? (row[phoneIndex] || '').replace(/[^\d+]/g, '') : '';
      const name = nameIndex !== -1 ? row[nameIndex] : 'Imported Lead';
      const email = emailIndex !== -1 ? (row[emailIndex] || '').toLowerCase() : '';
      const tag = tagIndex !== -1 && row[tagIndex] ? [row[tagIndex]] : ['imported'];

      if (!phone && !name) {
        skippedCount++;
        continue;
      }

      // Upsert by phone if phone exists
      if (phone) {
        const existing = await Contact.findOne({ tenantId: req.tenantId, phone });
        if (existing) {
          skippedCount++;
          continue;
        }
      }

      const newContact = await Contact.create({
        tenantId: req.tenantId,
        name: name || 'Imported Lead',
        phone,
        email,
        leadStage: 'new',
        source: 'csv_import',
        tags: tag,
        optInStatus: true,
        optInSource: 'csv_import_optin_confirmed'
      });

      await Conversation.create({
        tenantId: req.tenantId,
        contactId: newContact._id,
        status: 'open',
        lastCustomerMessageAt: null,
        lastMessageAt: null,
        lastMessageText: ''
      });

      importedCount++;
    }

    // Clean up temp import file
    try {
      fs.unlinkSync(filePath);
    } catch (_) {}

    return ApiResponse.success(res, `Import completed: ${importedCount} contacts added, ${skippedCount} skipped.`, {
      importedCount,
      skippedCount
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listContacts,
  getContactById,
  createContact,
  updateContact,
  updateLeadStage,
  addNote,
  importContacts
};
