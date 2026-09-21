const ApiResponse = require('../utils/apiResponse');
const { Broadcast, Template, Contact, WabaAccount, Message, Conversation, AuditLog } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const socket = require('../config/socket');
const env = require('../config/env');

const listBroadcasts = async (req, res, next) => {
  try {
    const broadcasts = await Broadcast.find({ tenantId: req.tenantId })
      .populate('templateId', 'name category language')
      .sort({ createdAt: -1 });

    return ApiResponse.success(res, 'Broadcasts retrieved successfully.', broadcasts);
  } catch (error) {
    next(error);
  }
};

const createBroadcast = async (req, res, next) => {
  try {
    const { name, templateId, targetSegment, variableMapping, scheduledAt } = req.body;

    const template = await Template.findOne({ _id: templateId, tenantId: req.tenantId });
    if (!template) {
      return ApiResponse.notFound(res, 'Selected template not found.');
    }

    if (template.status !== 'APPROVED' && !env.ENABLE_MOCK_FALLBACK) {
      return ApiResponse.badRequest(res, 'Cannot broadcast using unapproved template.');
    }

    // Build contact filter (CRITICAL: enforce optInStatus: true per PL-01)
    const contactFilter = {
      tenantId: req.tenantId,
      optInStatus: true,
      phone: { $exists: true, $ne: '' }
    };

    if (targetSegment?.tags && targetSegment.tags.length > 0) {
      contactFilter.tags = { $in: targetSegment.tags };
    }

    if (targetSegment?.leadStage && targetSegment.leadStage !== 'all') {
      contactFilter.leadStage = targetSegment.leadStage;
    }

    const contacts = await Contact.find(contactFilter);
    if (contacts.length === 0) {
      return ApiResponse.badRequest(res, 'No opted-in contacts found matching the target segment criteria.');
    }

    const recipients = contacts.map((c) => ({
      contactId: c._id,
      phone: c.phone,
      status: 'pending'
    }));

    const broadcast = await Broadcast.create({
      tenantId: req.tenantId,
      name: name.trim(),
      templateId,
      targetSegment: targetSegment || { allOptedIn: true },
      variableMapping: variableMapping || {},
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      totalRecipients: recipients.length,
      recipients
    });

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'BROADCAST_CREATED',
      details: { broadcastId: broadcast._id, name: broadcast.name, totalRecipients: recipients.length },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, 'Broadcast campaign created successfully.', broadcast, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Execute Broadcast Dispatch
 * Runs asynchronously in background to avoid blocking server
 */
const startBroadcast = async (req, res, next) => {
  try {
    const { broadcastId } = req.params;

    const broadcast = await Broadcast.findOne({ _id: broadcastId, tenantId: req.tenantId })
      .populate('templateId');

    if (!broadcast) {
      return ApiResponse.notFound(res, 'Broadcast not found.');
    }

    if (broadcast.status === 'processing') {
      return ApiResponse.badRequest(res, 'Broadcast is already processing.');
    }

    const waba = await WabaAccount.findOne({ tenantId: req.tenantId });
    if (!waba && !env.ENABLE_MOCK_FALLBACK) {
      return ApiResponse.badRequest(res, 'WhatsApp Business Account is not connected.');
    }

    const token = waba ? cryptoUtils.decrypt(waba.encryptedToken) : 'mock_token';
    const phoneNumberId = waba?.phoneNumberId || env.META_TEST_PHONE_NUMBER_ID;

    // Set status to processing immediately
    broadcast.status = 'processing';
    await broadcast.save();

    // Respond to user right away
    ApiResponse.success(res, 'Broadcast execution started.', {
      broadcastId: broadcast._id,
      status: 'processing',
      totalRecipients: broadcast.totalRecipients
    });

    // Run dispatch asynchronously
    setImmediate(async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (const item of broadcast.recipients) {
        if (item.status === 'sent') continue;

        try {
          // Find contact to interpolate variables
          const contact = await Contact.findById(item.contactId);
          const recipientPhone = item.phone.replace(/[^\d]/g, '');

          // Map dynamic parameters
          const params = [];
          if (broadcast.variableMapping) {
            const keys = Object.keys(broadcast.variableMapping);
            keys.sort();
            for (const k of keys) {
              const field = broadcast.variableMapping[k];
              params.push(contact ? contact[field] || `{{${k}}}` : `{{${k}}}`);
            }
          }

          const components = [];
          if (params.length > 0) {
            components.push({
              type: 'body',
              parameters: params.map((p) => ({ type: 'text', text: String(p) }))
            });
          }

          const metaPayload = {
            messaging_product: 'whatsapp',
            to: recipientPhone,
            type: 'template',
            template: {
              name: broadcast.templateId.name,
              language: { code: broadcast.templateId.language || 'en_US' },
              components: components.length > 0 ? components : undefined
            }
          };

          const metaRes = await MetaGraphApi.sendMessage(phoneNumberId, token, metaPayload);
          const wamid = metaRes?.messages?.[0]?.id || `wamid.bcast_${Date.now()}`;

          item.status = 'sent';
          item.wamid = wamid;
          sentCount++;

          // Upsert conversation & store message
          let conversation = await Conversation.findOne({
            tenantId: broadcast.tenantId,
            contactId: item.contactId
          });
          if (!conversation) {
            conversation = await Conversation.create({
              tenantId: broadcast.tenantId,
              contactId: item.contactId,
              status: 'open'
            });
          }

          await Message.create({
            tenantId: broadcast.tenantId,
            conversationId: conversation._id,
            contactId: item.contactId,
            wamid,
            direction: 'outbound',
            senderType: 'system',
            messageType: 'template',
            content: `[Broadcast: ${broadcast.name}] ${broadcast.templateId.body?.text || ''}`,
            templateId: broadcast.templateId._id,
            status: 'sent',
            sentAt: new Date()
          });
        } catch (err) {
          item.status = 'failed';
          item.error = err.message;
          failedCount++;
        }

        // Small throttle to stay well within Meta rate limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      broadcast.sentCount = sentCount;
      broadcast.failedCount = failedCount;
      broadcast.status = 'completed';
      await broadcast.save();

      // Emit socket completion event
      socket.emitToTenant(broadcast.tenantId, 'broadcast_completed', {
        broadcastId: broadcast._id,
        sentCount,
        failedCount
      });
    });
  } catch (error) {
    next(error);
  }
};

const getBroadcastReport = async (req, res, next) => {
  try {
    const { broadcastId } = req.params;
    const broadcast = await Broadcast.findOne({ _id: broadcastId, tenantId: req.tenantId })
      .populate('templateId');

    if (!broadcast) {
      return ApiResponse.notFound(res, 'Broadcast not found.');
    }

    return ApiResponse.success(res, 'Broadcast report retrieved.', broadcast);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listBroadcasts,
  createBroadcast,
  startBroadcast,
  getBroadcastReport
};
