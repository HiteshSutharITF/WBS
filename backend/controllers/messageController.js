const fs = require('fs');
const path = require('path');
const ApiResponse = require('../utils/apiResponse');
const { Conversation, Message, Contact, Template, WabaAccount } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const socket = require('../config/socket');
const env = require('../config/env');
const {
  sanitizeMediaReference,
  toAbsolutePublicUrl,
  resolveLocalFilePath,
  guessMimeType,
  countBodyPlaceholders,
  isMetaHostedSampleUrl,
  isLocalUploadPath
} = require('../utils/mediaHelpers');

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

/**
 * Resolve template/media header into Meta-ready media object.
 * ALWAYS prefer media id upload. Never send WhatsApp CDN sample URLs as link
 * (Meta accepts then fails delivery → orange failed icon in inbox).
 */
const resolveHeaderMediaForMeta = async ({
  rawMediaRef,
  headerFormat,
  phoneNumberId,
  token,
  sampleFileName,
  fallbackMediaRef
}) => {
  // Prefer a usable ref; if client sent a WhatsApp CDN sample URL, try template local file
  let sanitized = sanitizeMediaReference(rawMediaRef);
  if (!sanitized && fallbackMediaRef) {
    sanitized = sanitizeMediaReference(fallbackMediaRef);
  }

  if (!sanitized) {
    const hint = isMetaHostedSampleUrl(rawMediaRef) || isMetaHostedSampleUrl(fallbackMediaRef)
      ? ' The selected image is a WhatsApp sample CDN URL and cannot be used when sending. Please upload the logo/image file again.'
      : ' Upload a file or provide a public HTTPS URL hosted on your server.';
    return {
      mediaObject: null,
      displayUrl: null,
      error: `This template requires a ${String(headerFormat || 'IMAGE').toLowerCase()} header.${hint}`
    };
  }

  const displayUrl = toAbsolutePublicUrl(sanitized) || sanitized;
  const localPath = resolveLocalFilePath(sanitized);

  // Prefer Meta media id (required for reliability; Meta does not need to fetch our host)
  if (localPath) {
    try {
      const fileBuffer = fs.readFileSync(localPath);
      const mimeType = guessMimeType(localPath, headerFormat);
      const mediaId = await MetaGraphApi.uploadMediaForMessaging(phoneNumberId, token, {
        fileBuffer,
        mimeType,
        fileName: sampleFileName || path.basename(localPath)
      });
      return {
        mediaObject: { id: mediaId },
        displayUrl: isLocalUploadPath(sanitized) ? toAbsolutePublicUrl(sanitized) : displayUrl,
        error: null
      };
    } catch (uploadErr) {
      console.warn('[messageController] Media id upload failed:', uploadErr.message);
      // Only fall back to link if it is OUR public LIVE_URL (not Meta CDN)
      const publicLink = toAbsolutePublicUrl(sanitized);
      if (
        publicLink &&
        /^https:\/\//i.test(publicLink) &&
        !isMetaHostedSampleUrl(publicLink) &&
        env.LIVE_URL &&
        publicLink.startsWith(env.LIVE_URL)
      ) {
        return { mediaObject: { link: publicLink }, displayUrl: publicLink, error: null };
      }
      return {
        mediaObject: null,
        displayUrl: null,
        error: `Failed to upload header media to Meta: ${uploadErr.message}`
      };
    }
  }

  // Remote public HTTPS that is NOT Meta-hosted — Meta will fetch it
  if (/^https:\/\//i.test(sanitized) && !isMetaHostedSampleUrl(sanitized)) {
    // Best effort: download and re-upload as media id so Meta does not depend on third-party fetch
    try {
      const axios = require('axios');
      const dl = await axios.get(sanitized, {
        responseType: 'arraybuffer',
        timeout: 20000,
        maxContentLength: 16 * 1024 * 1024
      });
      const mimeType =
        dl.headers['content-type']?.split(';')[0] || guessMimeType(sanitized, headerFormat);
      const mediaId = await MetaGraphApi.uploadMediaForMessaging(phoneNumberId, token, {
        fileBuffer: Buffer.from(dl.data),
        mimeType,
        fileName: sampleFileName || path.basename(new URL(sanitized).pathname) || 'header.bin'
      });
      return { mediaObject: { id: mediaId }, displayUrl: sanitized, error: null };
    } catch (dlErr) {
      console.warn('[messageController] Download+reupload failed, using link:', dlErr.message);
      return { mediaObject: { link: sanitized }, displayUrl: sanitized, error: null };
    }
  }

  return {
    mediaObject: null,
    displayUrl: null,
    error:
      'Header media must be an uploaded file or a public HTTPS URL. WhatsApp sample CDN links cannot be used when sending.'
  };
};

const buildHeaderMediaParameter = (headerFormat, mediaObject, sampleFileName) => {
  if (headerFormat === 'IMAGE') {
    return { type: 'image', image: mediaObject };
  }
  if (headerFormat === 'VIDEO') {
    return { type: 'video', video: mediaObject };
  }
  if (headerFormat === 'DOCUMENT') {
    return {
      type: 'document',
      document: {
        ...mediaObject,
        filename: sampleFileName || 'document.pdf'
      }
    };
  }
  return null;
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
    const fullMediaUrl = `${env.LIVE_URL}/${relativeMediaUrl}`;
    const { phoneNumberId, token } = await getTenantWabaContext(req.tenantId);

    const type = mediaType || (req.file.mimetype.startsWith('image/') ? 'image' : 'document');
    const recipientPhone = contact.phone.replace(/[^\d]/g, '');

    // Prefer Meta media id so Meta does not need to fetch our host
    let mediaPayload;
    try {
      const mediaId = await MetaGraphApi.uploadMediaForMessaging(phoneNumberId, token, {
        fileBuffer: fs.readFileSync(req.file.path),
        mimeType: req.file.mimetype,
        fileName: req.file.originalname
      });
      mediaPayload = { id: mediaId, caption: caption || '' };
    } catch (uploadErr) {
      console.warn('[messageController] Free-form media id upload failed, using public link:', uploadErr.message);
      if (!/^https:\/\//i.test(fullMediaUrl)) {
        return ApiResponse.badRequest(
          res,
          `Failed to upload media to Meta and no public HTTPS URL is available: ${uploadErr.message}`
        );
      }
      mediaPayload = { link: fullMediaUrl, caption: caption || '' };
    }

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type,
      [type]: mediaPayload
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

    // Validate body variables against template placeholders
    const requiredBodyCount = countBodyPlaceholders(template.body?.text || '');
    const bodyParams = Array.isArray(parameters) ? parameters.map((p) => (p == null ? '' : String(p))) : [];
    if (requiredBodyCount > 0) {
      if (bodyParams.length < requiredBodyCount) {
        return ApiResponse.badRequest(
          res,
          `This template requires ${requiredBodyCount} body variable(s). Please fill all {{1}}…{{${requiredBodyCount}}} fields before sending.`
        );
      }
      for (let i = 0; i < requiredBodyCount; i += 1) {
        if (!bodyParams[i] || !String(bodyParams[i]).trim()) {
          return ApiResponse.badRequest(res, `Body variable {{${i + 1}}} is required and cannot be empty.`);
        }
      }
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
        const rawMediaRef =
          headerMediaUrl ||
          headerMedia?.link ||
          (typeof headerMedia === 'string' ? headerMedia : null) ||
          template.header?.mediaUrl;

        const { mediaObject, displayUrl, error: mediaError } = await resolveHeaderMediaForMeta({
          rawMediaRef,
          fallbackMediaRef: template.header?.mediaUrl,
          headerFormat,
          phoneNumberId,
          token,
          sampleFileName: template.header?.sampleFileName
        });

        if (mediaError) {
          return ApiResponse.badRequest(res, mediaError);
        }

        if (!mediaObject) {
          return ApiResponse.badRequest(
            res,
            `This template requires a ${headerFormat.toLowerCase()} header. Upload your logo/image file (WhatsApp sample CDN links cannot be used when sending).`
          );
        }

        resolvedHeaderMediaUrl = displayUrl;
        const headerParam = buildHeaderMediaParameter(
          headerFormat,
          mediaObject,
          template.header?.sampleFileName
        );
        if (headerParam) {
          components.push({
            type: 'header',
            parameters: [headerParam]
          });
        }
      } else if (headerFormat === 'TEXT') {
        const headerVars = (template.header?.text || '').match(/\{\{(\d+)\}\}/g);
        if (headerVars && headerVars.length > 0) {
          const textVal = headerText != null && String(headerText).trim() !== '' ? headerText : null;
          if (!textVal) {
            return ApiResponse.badRequest(res, 'This template requires a header text variable.');
          }
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
    if (requiredBodyCount > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.slice(0, requiredBodyCount).map((param) => ({
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
    bodyParams.forEach((val, idx) => {
      renderedText = renderedText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
    });

    // Store relative /uploads path when possible so the inbox can preview locally
    let storedMediaUrl;
    if (resolvedHeaderMediaUrl) {
      if (resolvedHeaderMediaUrl.startsWith(env.LIVE_URL)) {
        storedMediaUrl = resolvedHeaderMediaUrl.slice(env.LIVE_URL.length) || resolvedHeaderMediaUrl;
      } else {
        storedMediaUrl = resolvedHeaderMediaUrl;
      }
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
      mediaUrl: storedMediaUrl,
      templateId: template._id,
      templateData: {
        name: template.name,
        parameters: bodyParams,
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
