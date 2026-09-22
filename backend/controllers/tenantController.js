const ApiResponse = require('../utils/apiResponse');
const { Tenant, WabaAccount, Template, AuditLog } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const env = require('../config/env');

const getTenantProfile = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const wabaAccount = await WabaAccount.findOne({ tenantId: req.tenantId }).select('-encryptedToken -encryptedPin');

    return ApiResponse.success(res, 'Tenant profile fetched successfully.', {
      tenant,
      wabaAccount: wabaAccount || null,
      metaConfig: {
        appId: env.META_APP_ID,
        configId: env.META_CONFIG_ID,
        graphVersion: env.META_GRAPH_API_VERSION
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateWorkingHours = async (req, res, next) => {
  try {
    const { enabled, start, end, timezone, days } = req.body;
    const tenant = await Tenant.findById(req.tenantId);

    if (enabled !== undefined) tenant.workingHours.enabled = enabled;
    if (start) tenant.workingHours.start = start;
    if (end) tenant.workingHours.end = end;
    if (timezone) tenant.workingHours.timezone = timezone;
    if (days) tenant.workingHours.days = days;

    await tenant.save();

    return ApiResponse.success(res, 'Business working hours updated successfully.', tenant.workingHours);
  } catch (error) {
    next(error);
  }
};

/**
 * Complete WhatsApp Embedded Signup Onboarding
 * Exchanges 30-second authorization code for business token,
 * subscribes app to WABA webhooks, registers phone with 6-digit PIN,
 * fetches phone number metadata and saves encrypted token.
 */
const completeWhatsAppOnboarding = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { code, waba_id, phone_number_id, business_id, direct_token, redirect_uri } = req.body;
    let accessToken = direct_token;
    let tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

    // 1. If authorization code received from Embedded Signup, exchange within 30s
    if (code) {
      const exchangeResult = await MetaGraphApi.exchangeCodeForToken(code, redirect_uri);
      accessToken = exchangeResult.access_token;
      if (exchangeResult.expires_in) {
        tokenExpiry = new Date(Date.now() + exchangeResult.expires_in * 1000);
      }
    }

    if (!accessToken) {
      return ApiResponse.badRequest(res, 'Missing authorization code or access token from Meta.');
    }

    const effectiveWabaId = waba_id || env.META_TEST_WABA_ID;
    const effectivePhoneId = phone_number_id || env.META_TEST_PHONE_NUMBER_ID;

    // Check uniqueness: ensure phone_number_id is not already linked to another tenant
    // (allows the official test sandbox phone number to be reassigned during testing)
    const existingWaba = await WabaAccount.findOne({
      phoneNumberId: effectivePhoneId,
      tenantId: { $ne: tenantId }
    });
    if (existingWaba && effectivePhoneId !== env.META_TEST_PHONE_NUMBER_ID) {
      return ApiResponse.badRequest(res, 'This phone number is already connected to another tenant account.');
    }

    // 2. Subscribe app to client WABA webhooks
    try {
      await MetaGraphApi.subscribeAppToWaba(effectiveWabaId, accessToken);
    } catch (subErr) {
      console.warn('[Onboarding] Webhook subscription notice:', subErr.message);
    }

    // 3. Register phone number if needed (gracefully handles error 133005 if already registered or 2SV PIN active)
    let registrationPin = req.body.pin || '';
    try {
      const pinToTry = registrationPin || '123456';
      await MetaGraphApi.registerPhoneNumber(effectivePhoneId, pinToTry, accessToken);
      registrationPin = pinToTry;
    } catch (regErr) {
      console.warn('[Onboarding] Phone registration notice (number already active or 2SV PIN set on Meta):', regErr.message);
      // Note: Error 133005 confirms the number already has an existing Two-Step Verification PIN on Meta
    }

    // 4. Fetch phone number details and limits
    const phoneDetails = await MetaGraphApi.fetchPhoneNumberDetails(effectivePhoneId, accessToken);

    // 5. Encrypt token and PIN with AES-256-GCM
    const encryptedToken = cryptoUtils.encrypt(accessToken);
    const encryptedPin = cryptoUtils.encrypt(registrationPin);

    // 6. Upsert WabaAccount
    const wabaAccount = await WabaAccount.findOneAndUpdate(
      { tenantId },
      {
        tenantId,
        wabaId: effectiveWabaId,
        phoneNumberId: effectivePhoneId,
        displayPhoneNumber: phoneDetails.display_phone_number || '',
        verifiedName: phoneDetails.verified_name || '',
        businessId: business_id || env.META_BUSINESS_PORTFOLIO_ID,
        encryptedToken,
        encryptedPin,
        tokenExpiresAt: tokenExpiry,
        qualityRating: phoneDetails.quality_rating || 'GREEN',
        messagingLimit: phoneDetails.whatsapp_business_manager_messaging_limit || 'TIER_250',
        status: 'connected',
        subscribedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 7. Audit log
    await AuditLog.create({
      tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'WHATSAPP_CONNECTED',
      details: {
        wabaId: effectiveWabaId,
        phoneNumberId: effectivePhoneId,
        displayPhoneNumber: phoneDetails.display_phone_number
      },
      ipAddress: req.ip
    });

    // 8. Auto-fetch and import any existing approved templates from Meta WABA
    try {
      const metaTemplates = await MetaGraphApi.listMessageTemplates(effectiveWabaId, accessToken);
      if (metaTemplates && Array.isArray(metaTemplates.data)) {
        for (const item of metaTemplates.data) {
          const { header, body, footer, buttons } = MetaGraphApi.parseMetaTemplateComponents(item.components);
          await Template.findOneAndUpdate(
            { tenantId, name: item.name.toLowerCase() },
            {
              tenantId,
              metaTemplateId: item.id,
              name: item.name.toLowerCase(),
              category: item.category || 'MARKETING',
              language: item.language || 'en_US',
              status: item.status || 'APPROVED',
              rejectionReason: item.rejected_reason || '',
              header,
              body: body?.text ? body : { text: item.name },
              footer,
              buttons
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      }
    } catch (tmplErr) {
      console.warn('[Onboarding] Template auto-fetch notice:', tmplErr.message);
    }

    return ApiResponse.success(res, 'WhatsApp Business Account successfully connected!', {
      wabaId: wabaAccount.wabaId,
      phoneNumberId: wabaAccount.phoneNumberId,
      displayPhoneNumber: wabaAccount.displayPhoneNumber,
      verifiedName: wabaAccount.verifiedName,
      qualityRating: wabaAccount.qualityRating,
      messagingLimit: wabaAccount.messagingLimit,
      status: wabaAccount.status
    });
  } catch (error) {
    next(error);
  }
};

const disconnectWhatsApp = async (req, res, next) => {
  try {
    const waba = await WabaAccount.findOne({ tenantId: req.tenantId });
    if (!waba) {
      return ApiResponse.notFound(res, 'No connected WhatsApp account found.');
    }

    waba.status = 'disconnected';
    await waba.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'WHATSAPP_DISCONNECTED',
      details: { wabaId: waba.wabaId, phoneNumberId: waba.phoneNumberId },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, 'WhatsApp account disconnected successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTenantProfile,
  updateWorkingHours,
  completeWhatsAppOnboarding,
  disconnectWhatsApp
};
