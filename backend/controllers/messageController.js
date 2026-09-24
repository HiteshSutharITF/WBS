const ApiResponse = require('../utils/apiResponse');
const { Conversation, Message, Contact, Template, WabaAccount } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const socket = require('../config/socket');
const env = require('../config/env');

// Helper to get decrypted token for tenant
const getTenantWabaContext = async (tenantId) => {
  const waba = await WabaAccount.findOne({ tenantId });
  if (!waba || waba.status === 'disconnected') {
    throw new Error('WhatsApp Business Account is not connected. Please connect via Onboarding.');
  }
  const token = cryptoUtils.decrypt(waba.encryptedToken);
  return {
    wabaId: waba.wabaId,
    phoneNumberId: waba.phoneNumberId,
    token
  };
};

const sendTextMessage = async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;

    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId }).populate('contactId');
    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    const contact = conversation.contactId;
    if (!contact || !contact.phone) {
      return ApiResponse.badRequest(res, 'Cannot send WhatsApp message: recipient has no valid phone number.');
    }

    // Enforce 24-hour customer window rule (Meta Cloud API Policy)
    const now = Date.now();
    const hasCustomerMessaged = Boolean(conversation.lastCustomerMessageAt);
    let isWindowOpen = false;

    if (hasCustomerMessaged) {
      const lastCustTime = new Date(conversation.lastCustomerMessageAt).getTime();
      const elapsedHours = (now - lastCustTime) / (1000 * 60 * 60);
      isWindowOpen = elapsedHours >= 0 && elapsedHours <= 24;
    }

    if (!isWindowOpen && !env.ENABLE_MOCK_FALLBACK) {
      const errorMsg = !hasCustomerMessaged
        ? 'Cannot send free-form text: This contact has not sent an inbound message yet. Meta WhatsApp policy strictly requires sending an approved Template Message to initiate the conversation.'
        : 'The 24-hour customer service window has expired. Meta WhatsApp policy requires sending an approved Template Message to re-open the conversation.';
      return ApiResponse.badRequest(res, errorMsg);
    }

    const { phoneNumberId, token } = await getTenantWabaContext(req.tenantId);

    // Format Meta API payload
    const recipientPhone = contact.phone.replace(/[^\d]/g, '');
    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: content }
    };

    let metaRes;
    try {
      metaRes = await MetaGraphApi.sendMessage(phoneNumberId, token, metaPayload);
    } catch (metaErr) {
      return ApiResponse.badRequest(res, `Failed to send WhatsApp message: ${metaErr.message}`);
    }

    const wamid = metaRes?.messages?.[0]?.id || `wamid.local_${Date.now()}`;

    // Store message
    const message = await Message.create({
      tenantId: req.tenantId,
      conversationId: conversation._id,
      contactId: contact._id,
      wamid,
      direction: 'outbound',
      senderType: 'agent',
      senderId: req.user._id,
      messageType: 'text',
      content,
      status: 'sent',
      sentAt: new Date()
    });

    // Update conversation
    conversation.lastMessageText = content;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Real-time broadcast
    socket.emitToConversation(conversation._id, 'new_message', message);
    socket.emitToTenant(req.tenantId, 'conversation_message', {
      conversationId: conversation._id,
      message
    });

    return ApiResponse.success(res, 'Message sent successfully.', message, 201);
  } catch (error) {
    next(error);
  }
};

const sendMediaMessage = async (req, res, next) => {
  try {
    const { conversationId, caption, mediaType } = req.body;

    if (!req.file) {
      return ApiResponse.badRequest(res, 'Please upload a media file.');
    }

    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId }).populate('contactId');
    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    const contact = conversation.contactId;
    if (!contact || !contact.phone) {
      return ApiResponse.badRequest(res, 'Recipient phone number is missing.');
    }

    // Enforce 24-hour customer window rule (Meta Cloud API Policy)
    const now = Date.now();
    const hasCustomerMessaged = Boolean(conversation.lastCustomerMessageAt);
    let isWindowOpen = false;

    if (hasCustomerMessaged) {
      const lastCustTime = new Date(conversation.lastCustomerMessageAt).getTime();
      const elapsedHours = (now - lastCustTime) / (1000 * 60 * 60);
      isWindowOpen = elapsedHours >= 0 && elapsedHours <= 24;
    }

    if (!isWindowOpen && !env.ENABLE_MOCK_FALLBACK) {
      const errorMsg = !hasCustomerMessaged
        ? 'Cannot send free-form media: This contact has not sent an inbound message yet. Meta WhatsApp policy strictly requires sending an approved Template Message to initiate the conversation.'
        : 'The 24-hour customer service window has expired. Meta WhatsApp policy requires sending an approved Template Message to re-open the conversation.';
      return ApiResponse.badRequest(res, errorMsg);
    }

    const relativeMediaUrl = `uploads/media/${req.file.filename}`;
    const fullMediaUrl = `${env.HOST}/${relativeMediaUrl}`;
    const { phoneNumberId, token } = await getTenantWabaContext(req.tenantId);

    const type = mediaType || (req.file.mimetype.startsWith('image/') ? 'image' : 'document');
    const recipientPhone = contact.phone.replace(/[^\d]/g, '');

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type,
      [type]: {
        link: fullMediaUrl,
        caption: caption || ''
      }
    };

    let metaRes;
    try {
      metaRes = await MetaGraphApi.sendMessage(phoneNumberId, token, metaPayload);
    } catch (metaErr) {
      return ApiResponse.badRequest(res, `Failed to send media message: ${metaErr.message}`);
    }

    const wamid = metaRes?.messages?.[0]?.id || `wamid.local_${Date.now()}`;

    const message = await Message.create({
      tenantId: req.tenantId,
      conversationId: conversation._id,
      contactId: contact._id,
      wamid,
      direction: 'outbound',
      senderType: 'agent',
      senderId: req.user._id,
      messageType: type,
      content: caption || req.file.originalname,
      mediaUrl: relativeMediaUrl,
      mediaType: req.file.mimetype,
      status: 'sent',
      sentAt: new Date()
    });

    conversation.lastMessageText = caption || `[${type.toUpperCase()}]`;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    socket.emitToConversation(conversation._id, 'new_message', message);
    socket.emitToTenant(req.tenantId, 'conversation_message', {
      conversationId: conversation._id,
      message
    });

    return ApiResponse.success(res, 'Media message sent successfully.', message, 201);
  } catch (error) {
    next(error);
  }
};

const uploadMediaAsset = async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.badRequest(res, 'No file was uploaded.');
    }
    const relativePath = `/uploads/media/${req.file.filename}`;
    const fullUrl = `${env.LIVE_URL}${relativePath}`;
    return ApiResponse.success(res, 'Media uploaded successfully.', {
      url: relativePath,
      fullUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    next(error);
  }
};

const sendTemplateMessage = async (req, res, next) => {
  try {
    const {
      conversationId,
      templateId,
      parameters,
      headerMediaUrl,
      headerMedia,
      headerText,
      buttonParameters
    } = req.body;

    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId }).populate('contactId');
    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    const contact = conversation.contactId;
    if (!contact || !contact.phone) {
      return ApiResponse.badRequest(res, 'Recipient phone number is missing.');
    }

    // Check opt-in status per Meta policy PL-01
    if (!contact.optInStatus) {
      return ApiResponse.badRequest(res, 'This contact has opted out of marketing/template messages.');
    }

    const template = await Template.findOne({ _id: templateId, tenantId: req.tenantId });
    if (!template) {
      return ApiResponse.notFound(res, 'Template not found.');
    }

    if (template.status !== 'APPROVED' && !env.ENABLE_MOCK_FALLBACK) {
      return ApiResponse.badRequest(res, `Template is currently ${template.status}. Only APPROVED templates can be sent.`);
    }

    const { phoneNumberId, token } = await getTenantWabaContext(req.tenantId);
    const recipientPhone = contact.phone.replace(/[^\d]/g, '');

    // Format components for Meta Template API
    const components = [];
    let resolvedHeaderMediaUrl = null;

    // 1. HEADER Component (Required by Meta if template was created with an Image, Video, Document, or Text variable)
    const headerFormat = template.header?.format;
    if (headerFormat && headerFormat !== 'NONE') {
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
        let mediaUrl = headerMediaUrl || headerMedia?.link || (typeof headerMedia === 'string' ? headerMedia : null) || template.header?.mediaUrl;

        // If local upload path, prepend public live URL
        if (mediaUrl && (mediaUrl.startsWith('/uploads') || mediaUrl.startsWith('uploads'))) {
          const cleanPath = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
          mediaUrl = `${env.LIVE_URL}${cleanPath}`;
        }

        // Reliable fallback placeholder so Meta 132012 never occurs if URL was omitted
        if (!mediaUrl) {
          if (headerFormat === 'IMAGE') {
            mediaUrl = 'https://images.unsplash.com/photo-1579208575657-c595a053b977?w=1000&auto=format&fit=crop&q=80';
          } else if (headerFormat === 'DOCUMENT') {
            mediaUrl = `${env.LIVE_URL}/uploads/sample.pdf`;
          } else if (headerFormat === 'VIDEO') {
            mediaUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
          }
        }

        resolvedHeaderMediaUrl = mediaUrl;

        if (headerFormat === 'IMAGE') {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { link: mediaUrl }
              }
            ]
          });
        } else if (headerFormat === 'VIDEO') {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'video',
                video: { link: mediaUrl }
              }
            ]
          });
        } else if (headerFormat === 'DOCUMENT') {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: {
                  link: mediaUrl,
                  filename: template.header?.sampleFileName || 'document.pdf'
                }
              }
            ]
          });
        }
      } else if (headerFormat === 'TEXT') {
        const headerVars = (template.header?.text || '').match(/\{\{(\d+)\}\}/g);
        if (headerVars && headerVars.length > 0) {
          const textVal = headerText || 'Notification';
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'text',
                text: String(textVal)
              }
            ]
          });
        }
      }
    }

    // 2. BODY Component (Meta parameters for {{1}}, {{2}}, etc.)
    if (parameters && Array.isArray(parameters) && parameters.length > 0) {
      components.push({
        type: 'body',
        parameters: parameters.map((param) => ({
          type: 'text',
          text: String(param)
        }))
      });
    }

    // 3. BUTTONS Component (Dynamic URL parameters if required)
    if (buttonParameters && Array.isArray(buttonParameters) && buttonParameters.length > 0) {
      buttonParameters.forEach((btnParam, idx) => {
        components.push({
          type: 'button',
          sub_type: btnParam.sub_type || 'url',
          index: btnParam.index !== undefined ? String(btnParam.index) : String(idx),
          parameters: [
            {
              type: 'text',
              text: String(btnParam.text)
            }
          ]
        });
      });
    }

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language || 'en_US' },
        components: components.length > 0 ? components : undefined
      }
    };

    let metaRes;
    try {
      metaRes = await MetaGraphApi.sendMessage(phoneNumberId, token, metaPayload);
    } catch (metaErr) {
      return ApiResponse.badRequest(res, `Failed to send template message: ${metaErr.message}`);
    }

    const wamid = metaRes?.messages?.[0]?.id || `wamid.tmpl_${Date.now()}`;

    // Render template body for local preview
    let renderedText = template.body.text;
    if (parameters && Array.isArray(parameters)) {
      parameters.forEach((val, idx) => {
        renderedText = renderedText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
      });
    }

    const message = await Message.create({
      tenantId: req.tenantId,
      conversationId: conversation._id,
      contactId: contact._id,
      wamid,
      direction: 'outbound',
      senderType: 'agent',
      senderId: req.user._id,
      messageType: 'template',
      content: renderedText,
      mediaUrl: resolvedHeaderMediaUrl || undefined,
      templateId: template._id,
      templateData: {
        name: template.name,
        parameters,
        headerMediaUrl: resolvedHeaderMediaUrl,
        headerFormat: template.header?.format
      },
      status: 'sent',
      sentAt: new Date()
    });

    conversation.lastMessageText = `[Template: ${template.name}] ${renderedText}`;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    socket.emitToConversation(conversation._id, 'new_message', message);
    socket.emitToTenant(req.tenantId, 'conversation_message', {
      conversationId: conversation._id,
      message
    });

    return ApiResponse.success(res, 'Template message sent successfully.', message, 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  uploadMediaAsset
};
