const env = require('../config/env');
const fs = require('fs');
const path = require('path');
const { verifyWebhookSignature } = require('../utils/webhookSignature');
const { WabaAccount, Tenant, Contact, Conversation, Message, ChatbotRule, Template } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const socket = require('../config/socket');

const INBOUND_MEDIA_DIR = path.join(__dirname, '..', 'uploads', 'inbound');

const ensureInboundMediaDir = () => {
  if (!fs.existsSync(INBOUND_MEDIA_DIR)) {
    fs.mkdirSync(INBOUND_MEDIA_DIR, { recursive: true });
  }
};

/**
 * Download Meta media id to local /uploads/inbound and return relative path + mime.
 */
const storeInboundMedia = async (mediaId, token, messageType) => {
  if (!mediaId || !token) return { mediaUrl: '', mediaType: '' };
  try {
    ensureInboundMediaDir();
    const downloaded = await MetaGraphApi.downloadMediaById(mediaId, token);
    if (!downloaded?.buffer?.length) {
      return { mediaUrl: '', mediaType: downloaded?.mimeType || '' };
    }
    const safeName = `${Date.now()}_${String(mediaId).slice(-12)}_${downloaded.fileName || `${messageType}.bin`}`
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const absolute = path.join(INBOUND_MEDIA_DIR, safeName);
    fs.writeFileSync(absolute, downloaded.buffer);
    return {
      mediaUrl: `/uploads/inbound/${safeName}`,
      mediaType: downloaded.mimeType || ''
    };
  } catch (err) {
    console.warn(`[Webhook] Failed to download inbound ${messageType} media ${mediaId}:`, err.message);
    return { mediaUrl: '', mediaType: '' };
  }
};

/**
 * Meta Webhook Verification Handshake (GET)
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Verification handshake successful.');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification handshake failed.');
  return res.sendStatus(403);
};

/**
 * Inbound Webhook Event Processor (POST)
 */
const handleWebhook = async (req, res) => {
  // Acknowledge Meta immediately within 2 seconds
  res.status(200).send('EVENT_RECEIVED');

  // Verify signature if secret provided and not in mock fallback
  const signature = req.headers['x-hub-signature-256'];
  if (req.rawBody && !verifyWebhookSignature(req.rawBody, signature)) {
    console.warn('[Webhook] Invalid X-Hub-Signature-256 rejected.');
    return;
  }

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account' || !body.entry) {
      return;
    }

    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // 1. Check for incoming messages
        if (value.messages && value.metadata) {
          const phoneNumberId = value.metadata.phone_number_id;

          // Route to tenant
          const waba = await WabaAccount.findOne({
            $or: [
              { phoneNumberId: String(phoneNumberId).trim() },
              { wabaId: String(entry.id).trim() }
            ]
          });
          if (!waba) {
            console.warn(`[Webhook] Unrecognized phone_number_id: ${phoneNumberId}, entry.id: ${entry.id}`);
            continue;
          }

          const tenant = await Tenant.findById(waba.tenantId);
          if (!tenant || tenant.status === 'suspended') {
            continue;
          }

          for (const msg of value.messages) {
            await processIncomingMessage(msg, value.contacts, waba, tenant);
          }
        }

        // 2. Check for message delivery / read / failed status updates
        if (value.statuses) {
          for (const statusObj of value.statuses) {
            await processMessageStatus(statusObj);
          }
        }

        // 3. Check for template status updates
        if (change.field === 'message_template_status_update') {
          await processTemplateStatus(value);
        }
      }
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error.message);
  }
};

/**
 * Process a single incoming WhatsApp message
 */
async function processIncomingMessage(msg, metaContacts, waba, tenant) {
  const wamid = msg.id;

  // Deduplication check by wamid (PL-07)
  const existingMsg = await Message.findOne({ wamid });
  if (existingMsg) {
    return;
  }

  // Customer emoji reaction on an existing message (not a new chat bubble)
  if (msg.type === 'reaction') {
    const targetWamid = msg.reaction?.message_id || '';
    const emoji = msg.reaction?.emoji != null ? String(msg.reaction.emoji) : '';
    if (!targetWamid) return;

    const target = await Message.findOne({ tenantId: tenant._id, wamid: targetWamid });
    if (!target) {
      console.warn(`[Webhook] Reaction for unknown wamid ${targetWamid}`);
      return;
    }

    // One customer reaction per message — replace or clear
    target.reactions = (target.reactions || []).filter((r) => r.actorType !== 'customer');
    if (emoji) {
      target.reactions.push({
        emoji,
        actorType: 'customer',
        actorId: null,
        reactedAt: new Date(parseInt(msg.timestamp, 10) * 1000 || Date.now())
      });
    }
    await target.save();

    socket.emitToConversation(target.conversationId, 'message_updated', target);
    socket.emitToTenant(tenant._id, 'message_updated', {
      conversationId: target.conversationId,
      message: target
    });
    return;
  }

  const rawSender = String(msg.from || '').trim();
  const digitsOnly = rawSender.replace(/\D/g, '');
  const last10 = digitsOnly.slice(-10);
  const profileName = metaContacts?.[0]?.profile?.name || 'WhatsApp Customer';

  // Search by any phone format variant (with +, without +, country code prefix, last 10 digits regex)
  const phoneVariants = [
    digitsOnly,
    `+${digitsOnly}`,
    last10,
    `+${last10}`,
    `91${last10}`,
    `+91${last10}`
  ];

  // 1. Find or create Contact
  let contact = await Contact.findOne({
    tenantId: tenant._id,
    $or: [
      { phone: { $in: phoneVariants } },
      { phone: new RegExp(`${last10}$`) }
    ]
  });
  const isFirstTimeLead = !contact;

  if (!contact) {
    const formattedPhone = digitsOnly.length === 10 ? `+91${digitsOnly}` : `+${digitsOnly}`;
    contact = await Contact.create({
      tenantId: tenant._id,
      phone: formattedPhone,
      name: profileName,
      leadStage: 'new',
      source: 'direct_inbound',
      optInStatus: true,
      optInSource: 'inbound_message',
      lastInboundAt: new Date()
    });
  } else {
    contact.lastInboundAt = new Date();
    await contact.save();
  }

  // 2. Find or create Conversation
  let conversation = await Conversation.findOne({ tenantId: tenant._id, contactId: contact._id });
  if (!conversation) {
    conversation = await Conversation.create({
      tenantId: tenant._id,
      contactId: contact._id,
      status: 'open',
      lastCustomerMessageAt: new Date(),
      lastMessageAt: new Date(),
      lastMessageText: '',
      unreadCount: 1
    });
  } else {
    conversation.lastCustomerMessageAt = new Date(); // Reset 24-hour service window
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    conversation.status = 'open';
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  // 3. Extract content & type — download inbound media to local disk for inbox preview
  let content = '';
  let messageType = 'text';
  let mediaUrl = '';
  let mediaType = '';

  if (msg.type === 'text') {
    content = msg.text?.body || '';
  } else if (['image', 'document', 'audio', 'video', 'sticker'].includes(msg.type)) {
    messageType = msg.type === 'sticker' ? 'image' : msg.type;
    content = msg[msg.type]?.caption || (msg.type === 'sticker' ? '' : `[${msg.type.toUpperCase()}]`);
    const metaMediaId = msg[msg.type]?.id || '';
    if (metaMediaId) {
      const token = cryptoUtils.decrypt(waba.encryptedToken);
      const stored = await storeInboundMedia(metaMediaId, token, messageType);
      mediaUrl = stored.mediaUrl;
      mediaType = stored.mediaType;
      // Keep a useful list preview even when download fails
      if (!content || content.startsWith('[')) {
        if (messageType === 'image') content = mediaUrl ? '📷 Photo' : '[IMAGE]';
        else if (messageType === 'video') content = mediaUrl ? '🎥 Video' : '[VIDEO]';
        else if (messageType === 'document') content = mediaUrl ? '📄 Document' : '[DOCUMENT]';
        else if (messageType === 'audio') content = mediaUrl ? '🎵 Audio' : '[AUDIO]';
      }
    }
  } else if (msg.type === 'interactive') {
    messageType = 'interactive';
    content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || 'Interactive response';
  } else {
    content = `[${msg.type.toUpperCase()}]`;
  }

  // Resolve WhatsApp quote/reply context (customer replied to a specific message)
  let replyTo = undefined;
  const repliedWamid = msg.context?.id || msg.context?.message_id || '';
  if (repliedWamid) {
    const original = await Message.findOne({
      tenantId: tenant._id,
      conversationId: conversation._id,
      wamid: repliedWamid
    });
    const origOutbound =
      original?.direction === 'outbound' ||
      original?.senderType === 'agent' ||
      original?.senderType === 'bot';
    replyTo = {
      messageId: original?._id || null,
      wamid: repliedWamid,
      content: original?.content || '',
      messageType: original?.messageType || 'text',
      mediaUrl: original?.mediaUrl || '',
      direction: original?.direction || '',
      senderType: original?.senderType || '',
      senderName: origOutbound
        ? original?.senderType === 'bot'
          ? 'Chatbot'
          : 'You'
        : contact?.name || 'Customer'
    };
  }

  // 4. Save Inbound Message
  const savedMessage = await Message.create({
    tenantId: tenant._id,
    conversationId: conversation._id,
    contactId: contact._id,
    wamid,
    direction: 'inbound',
    senderType: 'customer',
    messageType,
    content,
    mediaUrl,
    mediaType: mediaType || undefined,
    replyTo,
    status: 'delivered',
    sentAt: new Date(parseInt(msg.timestamp) * 1000 || Date.now())
  });

  conversation.lastMessageText = content;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  console.log(`[Webhook] Inbound WhatsApp message from "${msg.from}" (${profileName}): "${content}". Matched contact: "${contact.name}" (${contact.phone}). Conversation ${conversation._id} 24h window ACTIVATED.`);

  // Real-time socket broadcast to client dashboard
  socket.emitToConversation(conversation._id, 'new_message', savedMessage);
  socket.emitToTenant(tenant._id, 'conversation_message', {
    conversationId: conversation._id,
    message: savedMessage,
    contact: { id: contact._id, name: contact.name, phone: contact.phone }
  });
  socket.emitToTenant(tenant._id, 'conversation_updated', {
    conversationId: conversation._id,
    status: conversation.status,
    unreadCount: conversation.unreadCount,
    isWindowOpen: true,
    hasCustomerMessaged: true,
    sessionStatus: 'ACTIVE',
    windowExpiresInHours: 24,
    lastCustomerMessageAt: conversation.lastCustomerMessageAt,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageText: conversation.lastMessageText
  });

  // 5. Check Opt-out Rule: "STOP" or "UNSUBSCRIBE" (PL-02)
  const cleanUpper = content.trim().toUpperCase();
  if (['STOP', 'UNSUBSCRIBE', 'CANCEL'].includes(cleanUpper)) {
    contact.optInStatus = false;
    contact.optOutDate = new Date();
    await contact.save();

    // Auto-reply confirming opt-out
    await sendBotReply(
      waba,
      tenant,
      conversation,
      contact,
      'You have been unsubscribed from receiving promotional messages. Reply START to resubscribe.'
    );
    return;
  }

  // 6. Check Bot Automation (CL-30, CL-31, CL-34)
  if (conversation.isBotPaused) {
    // Human hand-off is active: do not trigger automated replies
    return;
  }

  const token = cryptoUtils.decrypt(waba.encryptedToken);

  // Check Keyword Rules
  const rules = await ChatbotRule.find({ tenantId: tenant._id, isActive: true }).sort({ priority: -1 });
  let matchedRule = null;

  for (const rule of rules) {
    if (rule.triggerType === 'keyword') {
      const match = rule.keywords.some((kw) => {
        const textLower = content.toLowerCase();
        if (rule.matchType === 'exact') return textLower === kw;
        if (rule.matchType === 'starts_with') return textLower.startsWith(kw);
        return textLower.includes(kw);
      });
      if (match) {
        matchedRule = rule;
        break;
      }
    }
  }

  if (matchedRule) {
    // Execute rule actions
    if (matchedRule.actions?.addTag && !contact.tags.includes(matchedRule.actions.addTag)) {
      contact.tags.push(matchedRule.actions.addTag);
      await contact.save();
    }
    if (matchedRule.actions?.updateLeadStage) {
      contact.leadStage = matchedRule.actions.updateLeadStage;
      await contact.save();
    }

    // Human Hand-off trigger
    if (matchedRule.responseType === 'hand_off' || matchedRule.actions?.pauseBot) {
      conversation.isBotPaused = true;
      conversation.handedOffAt = new Date();
      conversation.status = 'open';
      if (matchedRule.actions?.assignAgentId) {
        conversation.assignedAgentId = matchedRule.actions.assignAgentId;
      }
      await conversation.save();

      socket.emitToTenant(tenant._id, 'lead_handed_off', {
        conversationId: conversation._id,
        contact: { id: contact._id, name: contact.name, phone: contact.phone }
      });
    }

    // Send automated response if configured
    if (matchedRule.responseText) {
      await sendBotReply(waba, tenant, conversation, contact, matchedRule.responseText);
    }
    return;
  }

  // If first-time inbound lead, check Welcome Message rule
  if (isFirstTimeLead) {
    const welcomeRule = await ChatbotRule.findOne({
      tenantId: tenant._id,
      triggerType: 'welcome',
      isActive: true
    });
    if (welcomeRule && welcomeRule.responseText) {
      await sendBotReply(waba, tenant, conversation, contact, welcomeRule.responseText);
      return;
    }
  }

  // Check Away Message rule if outside working hours
  if (tenant.workingHours?.enabled) {
    const isOutsideHours = checkIfOutsideWorkingHours(tenant.workingHours);
    if (isOutsideHours) {
      const awayRule = await ChatbotRule.findOne({
        tenantId: tenant._id,
        triggerType: 'away',
        isActive: true
      });
      if (awayRule && awayRule.responseText) {
        await sendBotReply(waba, tenant, conversation, contact, awayRule.responseText);
      }
    }
  }
}

/**
 * Send automated bot response
 */
async function sendBotReply(waba, tenant, conversation, contact, replyText) {
  try {
    const token = cryptoUtils.decrypt(waba.encryptedToken);
    const recipientPhone = contact.phone.replace(/[^\d]/g, '');

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: replyText }
    };

    const metaRes = await MetaGraphApi.sendMessage(waba.phoneNumberId, token, metaPayload);
    const wamid = metaRes?.messages?.[0]?.id || `wamid.bot_${Date.now()}`;

    const botMessage = await Message.create({
      tenantId: tenant._id,
      conversationId: conversation._id,
      contactId: contact._id,
      wamid,
      direction: 'outbound',
      senderType: 'bot',
      messageType: 'text',
      content: replyText,
      status: 'sent',
      sentAt: new Date()
    });

    conversation.lastMessageText = replyText;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    socket.emitToConversation(conversation._id, 'new_message', botMessage);
    socket.emitToTenant(tenant._id, 'conversation_message', {
      conversationId: conversation._id,
      message: botMessage
    });
  } catch (err) {
    console.error('[Webhook] Failed to send bot reply:', err.message);
  }
}

/**
 * Process delivery / read / failed status update
 */
async function processMessageStatus(statusObj) {
  const wamid = statusObj.id;
  const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'

  const message = await Message.findOne({ wamid });
  if (!message) return;

  message.status = status;
  if (status === 'delivered') message.deliveredAt = new Date();
  if (status === 'read') message.readAt = new Date();
  if (status === 'failed' && statusObj.errors) {
    message.errorCode = String(statusObj.errors[0]?.code || '');
    message.errorMessage =
      statusObj.errors[0]?.error_data?.details ||
      statusObj.errors[0]?.title ||
      statusObj.errors[0]?.message ||
      'Message delivery failed';
    console.error(
      `[Webhook] Message FAILED wamid=${wamid} code=${message.errorCode} msg=${message.errorMessage}`,
      JSON.stringify(statusObj.errors)
    );
  }

  await message.save();

  socket.emitToTenant(message.tenantId, 'message_status_updated', {
    messageId: message._id,
    wamid,
    status: message.status,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage
  });
}

/**
 * Process Meta Template status update
 */
async function processTemplateStatus(value) {
  const metaTemplateId = value.message_template_id;
  const templateName = value.message_template_name ? value.message_template_name.toLowerCase() : null;
  const event = value.event; // 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'
  const reason = value.reason || '';

  const filter = {};
  if (metaTemplateId && templateName) {
    filter.$or = [{ metaTemplateId }, { name: templateName }];
  } else if (metaTemplateId) {
    filter.metaTemplateId = metaTemplateId;
  } else if (templateName) {
    filter.name = templateName;
  } else {
    return;
  }

  const updated = await Template.findOneAndUpdate(
    filter,
    {
      metaTemplateId: metaTemplateId || undefined,
      status: event,
      rejectionReason: reason
    },
    { new: true }
  );

  if (updated) {
    console.log(`[Webhook] Meta template "${updated.name}" is now ${event} for tenant ${updated.tenantId}`);
    socket.emitToTenant(updated.tenantId, 'template_status_updated', {
      templateId: updated._id,
      metaTemplateId: updated.metaTemplateId,
      name: updated.name,
      status: updated.status,
      rejectionReason: updated.rejectionReason
    });
  }
}

/**
 * Utility: check if current time is outside working hours
 */
function checkIfOutsideWorkingHours(workingHours) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  if (workingHours.days && !workingHours.days.includes(currentDay)) {
    return true;
  }

  const [startH, startM] = (workingHours.start || '09:00').split(':').map(Number);
  const [endH, endM] = (workingHours.end || '18:00').split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes < startMinutes || currentMinutes > endMinutes;
}

module.exports = {
  verifyWebhook,
  handleWebhook
};
