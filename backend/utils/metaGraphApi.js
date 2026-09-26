const axios = require('axios');
const env = require('../config/env');

const BASE_URL = env.META_GRAPH_URL || 'https://graph.facebook.com/v25.0';

// Custom Axios instance with interceptors for detailed Meta Graph API logging
const metaClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000
});

// Request Logger Interceptor
metaClient.interceptors.request.use(
  (config) => {
    const timestamp = new Date().toISOString();
    console.log(`\n==================== [META GRAPH API REQUEST] ====================`);
    console.log(`[${timestamp}] Method: ${config.method?.toUpperCase()}`);
    console.log(`Endpoint: ${config.baseURL || ''}${config.url || ''}`);
    if (config.params) {
      const safeParams = { ...config.params };
      if (safeParams.client_secret) safeParams.client_secret = '••••••••';
      if (safeParams.access_token) safeParams.access_token = `${safeParams.access_token.slice(0, 15)}...`;
      console.log(`Query Params:`, JSON.stringify(safeParams, null, 2));
    }
    if (config.data) {
      if (Buffer.isBuffer(config.data)) {
        console.log(`Request Body: [Binary Buffer: ${config.data.length} bytes]`);
      } else {
        console.log(`Request Body:`, JSON.stringify(config.data, null, 2));
      }
    }
    console.log(`==================================================================\n`);
    return config;
  },
  (error) => {
    console.error('[MetaGraphApi Request Error]', error.message);
    return Promise.reject(error);
  }
);

// Response & Error Logger Interceptor
metaClient.interceptors.response.use(
  (response) => {
    const timestamp = new Date().toISOString();
    console.log(`\n==================== [META GRAPH API RESPONSE] ====================`);
    console.log(`[${timestamp}] Status: ${response.status} ${response.statusText}`);
    console.log(`Endpoint: ${response.config.method?.toUpperCase()} ${response.config.url || ''}`);
    console.log(`Response Body:`, JSON.stringify(response.data, null, 2));
    console.log(`===================================================================\n`);
    return response;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    console.error(`\n!!!!!!!!!!!!!!!!!!!! [META GRAPH API ERROR] !!!!!!!!!!!!!!!!!!!!`);
    console.error(`[${timestamp}] Endpoint: ${error.config?.method?.toUpperCase()} ${error.config?.baseURL || ''}${error.config?.url || ''}`);
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`Meta Error Details:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`Network/Client Error: ${error.message}`);
    }
    console.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`);
    return Promise.reject(error);
  }
);

class MetaGraphApi {
  /**
   * Exchange Embedded Signup code for a Business Access Token
   * Note: The one-time code expires in 30 seconds!
   */
  static async exchangeCodeForToken(code, redirectUri) {
    if (code && (code.startsWith('mock_') || code.startsWith('simulated_'))) {
      return {
        access_token: `mock_access_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        token_type: 'bearer',
        expires_in: 5184000
      };
    }

    if (!env.META_APP_SECRET || env.META_APP_SECRET.includes('here')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        console.warn('[MetaGraphApi] META_APP_SECRET is empty in .env. Mock fallback generated demo token.');
        return {
          access_token: `mock_access_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          token_type: 'bearer',
          expires_in: 5184000
        };
      }
      throw new Error('META_APP_SECRET is missing in backend/.env. Cannot exchange authorization code with Meta.');
    }

    try {
      const params = {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        code
      };
      if (redirectUri) {
        params.redirect_uri = redirectUri;
      }
      const response = await metaClient.get('/oauth/access_token', { params });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        console.warn('[MetaGraphApi] Code exchange failed with live API, falling back to mock mode:', error.response?.data || error.message);
        return {
          access_token: `mock_fallback_token_${Date.now()}`,
          token_type: 'bearer',
          expires_in: 5184000
        };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Confirm token validity and permissions
   */
  static async debugToken(inputToken) {
    if (env.ENABLE_MOCK_FALLBACK && (!env.META_APP_SECRET || env.META_APP_SECRET.includes('here'))) {
      return {
        data: {
          app_id: env.META_APP_ID,
          is_valid: true,
          expires_at: Math.floor(Date.now() / 1000) + 5184000,
          granular_scopes: [
            { scope: 'whatsapp_business_messaging', target_ids: [env.META_TEST_WABA_ID] },
            { scope: 'whatsapp_business_management', target_ids: [env.META_TEST_WABA_ID] }
          ]
        }
      };
    }

    try {
      const appToken = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
      const response = await metaClient.get('/debug_token', {
        params: {
          input_token: inputToken,
          access_token: appToken
        }
      });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          data: {
            app_id: env.META_APP_ID,
            is_valid: true,
            expires_at: Math.floor(Date.now() / 1000) + 5184000
          }
        };
      }
      const metaErr = error.response?.data?.error;
      throw new Error(metaErr ? `[Meta ${metaErr.code}] ${metaErr.message}` : error.message);
    }
  }

  /**
   * Subscribe Meta App to client WABA to receive incoming webhooks
   */
  static async subscribeAppToWaba(wabaId, businessToken) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) return { success: true };
      throw new Error('Cannot subscribe webhooks: Account has a demo/mock token.');
    }

    try {
      const response = await metaClient.post(
        `/${wabaId}/subscribed_apps`,
        {},
        {
          headers: { Authorization: `Bearer ${businessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return { success: true };
      }
      const metaErr = error.response?.data?.error;
      throw new Error(metaErr ? `[Meta ${metaErr.code}] ${metaErr.message}` : error.message);
    }
  }

  /**
   * Register Phone Number with a 6-digit PIN
   */
  static async registerPhoneNumber(phoneNumberId, pin, businessToken) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) return { success: true };
      throw new Error('Cannot register phone: Account has a demo/mock token.');
    }

    try {
      const response = await metaClient.post(
        `/${phoneNumberId}/register`,
        {
          messaging_product: 'whatsapp',
          pin
        },
        {
          headers: { Authorization: `Bearer ${businessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return { success: true };
      }
      const metaErr = error.response?.data?.error;
      throw new Error(metaErr ? `[Meta ${metaErr.code}] ${metaErr.message}` : error.message);
    }
  }

  /**
   * Fetch connected Phone Number details and limits
   */
  static async fetchPhoneNumberDetails(phoneNumberId, businessToken) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          display_phone_number: env.META_TEST_PHONE_NUMBER,
          verified_name: 'ITFuturz Business Solution',
          status: 'CONNECTED',
          quality_rating: 'GREEN',
          code_verification_status: 'VERIFIED',
          account_mode: 'LIVE',
          is_official_business_account: false,
          whatsapp_business_manager_messaging_limit: 'TIER_250'
        };
      }
      throw new Error('Cannot fetch phone details: Account has a demo/mock token.');
    }

    try {
      const fields = [
        'display_phone_number',
        'verified_name',
        'status',
        'quality_rating',
        'code_verification_status',
        'account_mode',
        'is_official_business_account',
        'whatsapp_business_manager_messaging_limit'
      ].join(',');

      const response = await metaClient.get(`/${phoneNumberId}`, {
        params: { fields },
        headers: { Authorization: `Bearer ${businessToken}` }
      });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          display_phone_number: env.META_TEST_PHONE_NUMBER,
          verified_name: 'ITFuturz Business Solution',
          status: 'CONNECTED',
          quality_rating: 'GREEN',
          code_verification_status: 'VERIFIED',
          whatsapp_business_manager_messaging_limit: 'TIER_250'
        };
      }
      const metaErr = error.response?.data?.error;
      throw new Error(metaErr ? `[Meta ${metaErr.code}] ${metaErr.message}` : error.message);
    }
  }

  /**
   * Send WhatsApp message (Text, Media, Template, Interactive)
   */
  static async sendMessage(phoneNumberId, businessToken, messagePayload) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        const mockWamid = `wamid.HBgL${Date.now()}A${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        return {
          messaging_product: 'whatsapp',
          contacts: [{ input: messagePayload.to, wa_id: messagePayload.to.replace(/\D/g, '') }],
          messages: [{ id: mockWamid, message_status: 'accepted' }]
        };
      }
      throw new Error('Cannot send WhatsApp message: Account has a demo/mock token.');
    }

    try {
      const response = await metaClient.post(
        `/${phoneNumberId}/messages`,
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        const mockWamid = `wamid.HBgL${Date.now()}A${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        return {
          messaging_product: 'whatsapp',
          contacts: [{ input: messagePayload.to, wa_id: messagePayload.to.replace(/\D/g, '') }],
          messages: [{ id: mockWamid, message_status: 'accepted' }]
        };
      }
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Create template on Meta WABA
   */
  static async createMessageTemplate(wabaId, businessToken, templatePayload) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          id: `mock_tmpl_${Date.now()}`,
          status: 'PENDING',
          category: templatePayload.category
        };
      }
      throw new Error('Your WhatsApp account is using a demo/mock token. Please connect with your real Meta credentials or enter a valid Meta System User Token (EAA...) in Onboarding to submit templates to Meta.');
    }

    try {
      const response = await metaClient.post(
        `/${wabaId}/message_templates`,
        templatePayload,
        {
          headers: {
            Authorization: `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      const errData = error.response?.data?.error;
      const errorMsg = errData
        ? `[Meta ${errData.code}] ${errData.message}${errData.error_user_msg ? ` (${errData.error_user_msg})` : ''}`
        : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Fetch all message templates from Meta WABA
   */
  static async listMessageTemplates(wabaId, businessToken) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return { data: [] };
      }
      throw new Error('Your WhatsApp account is using a demo/mock token. Please connect with your real Meta credentials or enter a valid Meta System User Token (EAA...) in Onboarding to fetch templates from Meta.');
    }

    try {
      const response = await metaClient.get(`/${wabaId}/message_templates`, {
        params: { limit: 250 },
        headers: { Authorization: `Bearer ${businessToken}` }
      });
      return response.data;
    } catch (error) {
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Delete message template on Meta WABA
   */
  static async deleteMessageTemplate(wabaId, businessToken, templateName) {
    if (businessToken && businessToken.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) return { success: true };
      throw new Error('Cannot delete template: Account has a demo/mock token.');
    }

    try {
      const response = await metaClient.delete(`/${wabaId}/message_templates`, {
        params: { name: templateName },
        headers: { Authorization: `Bearer ${businessToken}` }
      });
      return response.data;
    } catch (error) {
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Upload media for messaging (template headers / image messages).
   * POST /{phone-number-id}/media → returns media id usable as image.id / video.id / document.id
   * Prefer this over public link URLs — Meta does not need to fetch your server.
   */
  static async uploadMediaForMessaging(phoneNumberId, token, { fileBuffer, mimeType, fileName }) {
    if (!token || token.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return `mock_media_${Date.now()}`;
      }
      throw new Error('Meta API token is required to upload media for messaging.');
    }

    if (!phoneNumberId) {
      throw new Error('phoneNumberId is required to upload media for messaging.');
    }

    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mimeType || 'application/octet-stream');
      form.append('file', fileBuffer, {
        filename: fileName || 'media.bin',
        contentType: mimeType || 'application/octet-stream'
      });

      const response = await metaClient.post(`/${phoneNumberId}/media`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const mediaId = response.data?.id;
      if (!mediaId) {
        throw new Error('Meta media upload succeeded but did not return a media id.');
      }
      return mediaId;
    } catch (error) {
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Upload sample media for Message Templates via Meta Resumable Upload API
   * Step 1: POST /v25.0/{appId}/uploads?file_length=...&file_type=...&file_name=...
   * Step 2: POST /v25.0/{uploadId} with binary data and file_offset: 0
   * Returns handle: string (h)
   */
  static async uploadMediaSample({ appId, token, fileBuffer, fileType, fileName }) {
    if (!token || token.startsWith('mock_')) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return `4:mock_handle_${Date.now()}`;
      }
      throw new Error('Meta API token is required to upload media sample.');
    }

    try {
      // Step 1: Create an upload session
      const sessionRes = await metaClient.post(`/${appId}/uploads`, null, {
        params: {
          file_length: fileBuffer.length,
          file_type: fileType,
          file_name: fileName,
          access_token: token
        }
      });

      const uploadId = sessionRes.data?.id;
      if (!uploadId) {
        throw new Error('Meta did not return an upload session ID.');
      }

      // Step 2: Upload file binary to the session
      const uploadRes = await metaClient.post(`/${uploadId}`, fileBuffer, {
        headers: {
          Authorization: `OAuth ${token}`,
          file_offset: 0,
          'Content-Type': fileType || 'application/octet-stream'
        }
      });

      const handle = uploadRes.data?.h;
      if (!handle) {
        throw new Error('Meta upload succeeded but did not return a media handle (h).');
      }

      return handle;
    } catch (error) {
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Parse Meta template components into local schema format
   */
  static parseMetaTemplateComponents(components = []) {
    let header = { format: 'NONE', text: '', mediaUrl: '' };
    let body = { text: '', sampleVariables: [] };
    let footer = { text: '' };
    let buttons = [];

    for (const comp of components) {
      if (comp.type === 'HEADER') {
        // header_handle is a Meta resumable-upload handle (e.g. "4:...").
        // It is ONLY valid for template creation — never as image.link when sending.
        const sampleHandle = comp.example?.header_handle?.[0] || '';
        header = {
          format: comp.format || 'NONE',
          text: comp.text || '',
          mediaUrl: '',
          headerHandle: sampleHandle
        };
      } else if (comp.type === 'BODY') {
        body = {
          text: comp.text || '',
          sampleVariables: comp.example?.body_text?.[0] || []
        };
      } else if (comp.type === 'FOOTER') {
        footer = {
          text: comp.text || ''
        };
      } else if (comp.type === 'BUTTONS') {
        buttons = (comp.buttons || []).map((btn) => ({
          type: btn.type || 'QUICK_REPLY',
          text: btn.text || '',
          value: btn.url || btn.phone_number || ''
        }));
      }
    }

    return { header, body, footer, buttons };
  }
}

module.exports = MetaGraphApi;
